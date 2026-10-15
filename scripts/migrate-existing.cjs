const {
  initializeApp,
  applicationDefault,
  deleteApp,
} = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const sharp = require("sharp");
const { randomUUID, createHash } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

async function main() {
  const apply = process.argv.includes("--apply");
  const app = initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    credential: applicationDefault(),
  });
  try {
    const db = getFirestore(app),
      bucket = getStorage(app).bucket();
    const [state, about, artists, events] = await Promise.all([
      db.doc("content_state/site").get(),
      db.doc("content_pages/about").get(),
      db.collection("content_artists").get(),
      db.collection("content_events").get(),
    ]);
    if (state.data()?.dashboardSchema === 2) {
      console.log("Dashboard migration already applied; no changes.");
      return;
    }
    if (
      !about.data()?.content ||
      artists.docs.some((d) => !d.data().content) ||
      events.docs.some((d) => !d.data().content)
    )
      throw Error("Unexpected source schema; refusing conversion");
    const source = {
      state: state.data(),
      about: about.data(),
      artists: artists.docs.map((d) => ({ id: d.id, ...d.data() })),
      events: events.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        artists: artists.size,
        events: events.size,
        about: true,
      }),
    );
    if (!apply) return;
    const backup = path.join(
      process.cwd(),
      ".local",
      "migration",
      `${Date.now()}-before-dashboard.json`,
    );
    await fs.mkdir(path.dirname(backup), { recursive: true });
    await fs.writeFile(backup, JSON.stringify(source, null, 2));
    const photos = [
      source.about.content.photo,
      ...source.artists.flatMap((a) => a.content.photos),
      ...source.events.map((e) => e.content.photo),
    ];
    const media = new Map();
    for (const photo of photos) {
      if (media.has(photo.url)) continue;
      const url = new URL(photo.url);
      const prefix = `/v0/b/${bucket.name}/o/`;
      if (
        url.hostname !== "firebasestorage.googleapis.com" ||
        !url.pathname.startsWith(prefix)
      )
        throw Error("Only existing project Storage assets may be imported");
      const object = decodeURIComponent(url.pathname.slice(prefix.length));
      const [bytes] = await bucket.file(object).download();
      const id = `${Date.now().toString(36)}-${randomUUID()}`;
      const image = await sharp(bytes)
        .rotate()
        .webp({ lossless: true })
        .toBuffer();
      const pixels = await sharp(bytes).rotate().raw().toBuffer();
      const convertedPixels = await sharp(image).raw().toBuffer();
      if (!pixels.equals(convertedPixels))
        throw Error("Lossless migration changed image pixels");
      const thumbnail = await sharp(image)
        .resize(320, 320, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const meta = await sharp(image).metadata();
      const originalPath = `media/${id}/image.webp`,
        thumbnailPath = `media/${id}/thumbnail.webp`;
      await bucket
        .file(originalPath)
        .save(image, {
          resumable: false,
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType: "image/webp" },
        });
      await bucket
        .file(thumbnailPath)
        .save(thumbnail, {
          resumable: false,
          preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType: "image/webp" },
        });
      media.set(photo.url, {
        id,
        name: "About — shared mock photograph",
        originalFilename: "cruz-marine.jpg",
        alt: photo.alt,
        path: originalPath,
        thumbnailPath,
        width: meta.width,
        height: meta.height,
        bytes: image.length,
        sha256: createHash("sha256").update(image).digest("hex"),
        createdAt: new Date().toISOString(),
        createdBy: "dashboard-migration",
        references: [],
        status: "ready",
      });
    }
    const now = new Date().toISOString();
    const envelope = (content, published = true) => ({
      schemaVersion: 1,
      revision: 1,
      draft: content,
      published: published ? content : null,
      publishedAt: published ? now : null,
      updatedAt: now,
      updatedBy: "dashboard-migration",
    });
    const pic = (photo, ref, published) => {
      const asset = media.get(photo.url);
      asset.references.push(`${ref}:draft`);
      if (published) asset.references.push(`${ref}:published`);
      return { id: asset.id, alt: photo.alt };
    };
    const a = source.about.content;
    const main = pic(a.photo, "about", true);
    const convertedAbout = envelope({
      title: a.title,
      intro: a.paragraphs[0] || "",
      body: a.paragraphs.slice(1).join("\n\n"),
      bodyFormat: "text",
      imageId: main.id,
      imageAlt: main.alt,
      seoDescription: "22 Recordings — independent record label and agency.",
    });
    const convertedArtists = source.artists.map((doc, i) => {
      const c = doc.content;
      const photos = c.photos.map((p) =>
        pic(p, `artists:${c.slug}`, c.published),
      );
      const principal = c.photos.findIndex((p) => p.id === c.primaryPhotoId);
      return envelope(
        {
          kind: "artists",
          slug: c.slug,
          title: c.name,
          summary: c.bio.slice(0, 1000),
          body: c.bio,
          bodyFormat: "text",
          cover: photos[principal] || photos[0],
          gallery: photos.filter((_, n) => n !== principal),
          seoDescription: "",
          residence: c.residence,
          live: c.live,
          rosterOrder: doc.order ?? i,
          links: c.links,
        },
        c.published,
      );
    });
    const convertedEvents = source.events.map((doc) => {
      const c = doc.content;
      return envelope(
        {
          kind: "events",
          slug: c.slug,
          title: c.title,
          summary: c.body.slice(0, 1000),
          body: c.body,
          bodyFormat: "text",
          cover: pic(c.photo, `events:${c.slug}`, c.published),
          gallery: [],
          seoDescription: "",
          startsAt: c.startsAt,
          endsAt: c.endsAt,
          timeZone: c.timeZone,
          venue: c.venue,
          address: "",
          city: c.city,
          region: "",
          postalCode: "",
          country: "Spain",
          lineup: c.lineup,
          eventType: "Club night",
          ticketStatus: c.ticketUrl ? "available" : "free",
          ticketUrl: c.ticketUrl,
          price: "",
          websiteUrl: "",
          facebookUrl: "",
          contactEmail: "",
        },
        c.published,
      );
    });
    await db.runTransaction(async (tx) => {
      const current = await tx.get(state.ref);
      if (
        current.data()?.revision !== state.data()?.revision ||
        current.data()?.dashboardSchema === 2
      )
        throw Error(
          "Source changed during migration; no documents overwritten",
        );
      tx.set(about.ref, convertedAbout);
      for (const doc of [...convertedArtists, ...convertedEvents]) {
        tx.set(db.doc(`content_${doc.draft.kind}/${doc.draft.slug}`), doc);
        if (doc.published)
          tx.set(db.doc(`published_${doc.draft.kind}/${doc.draft.slug}`), {
            content: doc.published,
            ...(doc.draft.kind === "events"
              ? { sortDate: doc.draft.endsAt }
              : { sortOrder: doc.draft.rosterOrder }),
            updatedAt: now,
          });
      }
      for (const asset of media.values()) {
        asset.references = [...new Set(asset.references)];
        tx.create(db.doc(`media_assets/${asset.id}`), asset);
      }
      tx.set(state.ref, {
        ...state.data(),
        dashboardSchema: 2,
        updatedAt: now,
      });
    });
    for (const asset of media.values()) {
      const [bytes] = await bucket.file(asset.path).download();
      if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256)
        throw Error("Media verification failed");
    }
    console.log(
      "Migrated envelopes, published snapshots, media library and references. Backup preserved locally.",
    );
  } finally {
    await deleteApp(app);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
