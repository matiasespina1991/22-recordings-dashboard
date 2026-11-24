#!/usr/bin/env node

/**
 * Re-compress an existing image to reduce file size
 * Usage: npx ts-node scripts/recompress-image.ts <media-id>
 */

import { applicationDefault, cert, getApps } from "firebase-admin/app";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import sharp from "sharp";

const projectId = process.env.FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;

if (!projectId || !storageBucket) {
  console.error(
    "FIREBASE_PROJECT_ID and FIREBASE_STORAGE_BUCKET environment variables are required",
  );
  process.exit(1);
}

const existing = getApps().find((app) => app.name === "recompress");
const app =
  existing ||
  initializeApp(
    {
      projectId,
      credential:
        process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
          ? cert({
              projectId,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.split(
                String.fromCharCode(92) + "n",
              ).join(String.fromCharCode(10)),
            })
          : applicationDefault(),
      storageBucket,
    },
    "recompress",
  );

const storage = getStorage(app);
const db = getFirestore(app);

async function recompressImage(mediaId: string) {
  try {
    console.log(`📸 Recompressing image: ${mediaId}`);

    // Try collections in order: media_assets, media, assets
    let media;
    for (const collectionName of ["media_assets", "media", "assets"]) {
      const doc = await db.collection(collectionName).doc(mediaId).get();
      if (doc.exists) {
        media = doc.data();
        console.log(`   Found in collection: ${collectionName}`);
        break;
      }
    }

    if (!media) {
      console.error("❌ Image not found in any media collection");
      process.exit(1);
    }

    const imagePath = media.path;

    if (!imagePath) {
      console.error("❌ Image path not found in metadata");
      process.exit(1);
    }

    // Download existing image
    console.log("⬇️  Downloading image from storage...");
    const [buffer] = await storage.bucket().file(imagePath).download();
    const originalSize = buffer.length;
    console.log(`   Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // Re-compress with lower quality
    console.log("🔨 Re-compressing with quality 65...");
    const recompressed = await sharp(buffer)
      .webp({ quality: 65 })
      .toBuffer();

    const newSize = recompressed.length;
    console.log(
      `   New size: ${(newSize / 1024 / 1024).toFixed(2)} MB (${(
        ((originalSize - newSize) / originalSize) *
        100
      ).toFixed(1)}% reduction)`,
    );

    // Also recompress thumbnail
    console.log("🔨 Re-compressing thumbnail with quality 60...");
    const thumbnailPath = media.thumbnailPath;
    if (thumbnailPath) {
      const [thumbBuffer] = await storage.bucket().file(thumbnailPath).download();
      const thumbOriginalSize = thumbBuffer.length;

      const recompressedThumb = await sharp(thumbBuffer)
        .webp({ quality: 60 })
        .toBuffer();

      const thumbNewSize = recompressedThumb.length;
      console.log(
        `   Thumbnail - Original: ${(thumbOriginalSize / 1024).toFixed(2)} KB, New: ${(
          thumbNewSize / 1024
        ).toFixed(2)} KB`,
      );

      // Upload recompressed thumbnail
      console.log("⬆️  Uploading recompressed thumbnail...");
      await storage.bucket().file(thumbnailPath).save(recompressedThumb, {
        resumable: false,
        metadata: { contentType: "image/webp" },
      });
    }

    // Upload recompressed image
    console.log("⬆️  Uploading recompressed image...");
    await storage.bucket().file(imagePath).save(recompressed, {
      resumable: false,
      metadata: { contentType: "image/webp" },
    });

    // Update metadata - try all possible collections
    let updated = false;
    for (const collectionName of ["media_assets", "media", "assets"]) {
      try {
        await db.collection(collectionName).doc(mediaId).update({
          bytes: newSize,
          recompressedAt: new Date().toISOString(),
        });
        updated = true;
        console.log(`   Updated in collection: ${collectionName}`);
        break;
      } catch {
        // Try next collection
      }
    }

    if (!updated) {
      console.error("❌ Could not update metadata in any collection");
      process.exit(1);
    }

    console.log(
      `\n✅ Image recompressed successfully!\n   ${(newSize / 1024).toFixed(2)} KB (was ${(
        originalSize / 1024
      ).toFixed(2)} KB)`,
    );
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

const mediaId = process.argv[2];
if (!mediaId) {
  console.error("Usage: npx ts-node scripts/recompress-image.ts <media-id>");
  console.error("Example: npx ts-node scripts/recompress-image.ts mv9ph9st-10e3a645-215d-471f-8283-99889c0cefd7");
  process.exit(1);
}

recompressImage(mediaId);

