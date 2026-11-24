import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_SOURCE_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  prepareImageUpload,
} from "../lib/image-upload.ts";

test("small uploads stay unchanged and oversized originals are rejected", async () => {
  const small = new File(["photo"], "artist.jpg", { type: "image/jpeg" });
  assert.equal(await prepareImageUpload(small), small);
  const tooLarge = new File(
    [new Uint8Array(MAX_IMAGE_SOURCE_BYTES + 1)],
    "large.jpg",
    {
      type: "image/jpeg",
    },
  );
  await assert.rejects(prepareImageUpload(tooLarge), /50 MB/);
});

test("large images are resized and compressed before upload", async () => {
  const originalBitmap = Object.getOwnPropertyDescriptor(
    globalThis,
    "createImageBitmap",
  );
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  let closed = false;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: () => {} }),
    toBlob: (callback: (blob: Blob) => void) =>
      callback(new Blob(["compressed"], { type: "image/webp" })),
  };
  Object.defineProperty(globalThis, "createImageBitmap", {
    configurable: true,
    value: async () => ({
      width: 6000,
      height: 4000,
      close: () => {
        closed = true;
      },
    }),
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { createElement: () => canvas },
  });
  try {
    const file = new File(
      [new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)],
      "artist.jpg",
      {
        type: "image/jpeg",
      },
    );
    const result = await prepareImageUpload(file);
    assert.equal(result.name, "artist.jpg");
    assert.equal(result.type, "image/webp");
    assert.ok(result.size <= MAX_IMAGE_UPLOAD_BYTES);
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1067);
    assert.equal(closed, true);
    closed = false;
    canvas.toBlob = (callback: (blob: Blob) => void) =>
      callback(new Blob(["unsupported"], { type: "image/png" }));
    await assert.rejects(prepareImageUpload(file), /No se pudo comprimir/);
    assert.equal(closed, true);
  } finally {
    if (originalBitmap)
      Object.defineProperty(globalThis, "createImageBitmap", originalBitmap);
    else Reflect.deleteProperty(globalThis, "createImageBitmap");
    if (originalDocument)
      Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("large animated GIFs are rejected rather than silently flattened", async () => {
  const header = Buffer.from("47494638396101000100800000000000ffffff", "hex");
  const frame = Buffer.from("2c0000000001000100000202440100", "hex");
  const file = new File(
    [header, frame, frame, new Uint8Array(MAX_IMAGE_UPLOAD_BYTES + 1)],
    "animated.gif",
    { type: "image/gif" },
  );
  await assert.rejects(prepareImageUpload(file), /GIF animados/);
});
