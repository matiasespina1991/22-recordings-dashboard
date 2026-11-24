export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGE_SOURCE_BYTES = 50 * 1024 * 1024;

function isAnimatedGif(bytes: Uint8Array): boolean {
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if ((header !== "GIF87a" && header !== "GIF89a") || bytes.length < 13) {
    throw new Error("El archivo GIF no es válido.");
  }
  let offset = 13;
  const globalFlags = bytes[10];
  if (globalFlags === undefined)
    throw new Error("El archivo GIF no es válido.");
  if (globalFlags & 0x80) offset += 3 * 2 ** ((globalFlags & 7) + 1);
  let frames = 0;
  const readByte = () => {
    const byte = bytes[offset++];
    if (byte === undefined) throw new Error("El archivo GIF no es válido.");
    return byte;
  };
  const skipBlocks = () => {
    while (offset < bytes.length) {
      const length = readByte();
      if (length === 0) return;
      offset += length;
    }
    throw new Error("El archivo GIF no es válido.");
  };
  while (offset < bytes.length) {
    const block = readByte();
    if (block === 0x3b) return false;
    if (block === 0x21) {
      offset++;
      skipBlocks();
    } else if (block === 0x2c) {
      if (offset + 9 > bytes.length) break;
      const flags = bytes[offset + 8];
      if (flags === undefined) break;
      offset += 9;
      if (flags & 0x80) offset += 3 * 2 ** ((flags & 7) + 1);
      offset++;
      if (++frames > 1) return true;
      skipBlocks();
    } else {
      break;
    }
  }
  throw new Error("El archivo GIF no es válido.");
}

export async function prepareImageUpload(file: File): Promise<File> {
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error("La imagen supera el límite de 50 MB.");
  }
  if (file.size <= MAX_IMAGE_UPLOAD_BYTES) return file;
  const signature = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  const format = String.fromCharCode(...signature);
  if (
    (format === "GIF87a" || format === "GIF89a") &&
    isAnimatedGif(new Uint8Array(await file.arrayBuffer()))
  ) {
    throw new Error("Los GIF animados no están permitidos.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(
      "No se pudo comprimir esta imagen en el navegador. Probá convertirla a JPG o PNG.",
    );
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("No se pudo preparar la imagen para subirla.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (
      !blob ||
      blob.type !== "image/webp" ||
      blob.size > MAX_IMAGE_UPLOAD_BYTES
    ) {
      throw new Error("No se pudo comprimir la imagen a menos de 5 MB.");
    }
    return new File([blob], file.name, {
      type: blob.type,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
