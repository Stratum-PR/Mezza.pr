import sharp from "sharp";

export const MENU_IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png" } as const;
export const MAX_MENU_BYTES = 15 * 1024 * 1024;

/** Read the uploaded picture, never a generated fixture. Account for phone EXIF rotation. */
export async function menuImageSize(bytes: Buffer, mimeType: string) {
  if (bytes.length === 0 || bytes.length > MAX_MENU_BYTES) throw new Error("invalid image size");
  const image = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
  const metadata = await image.metadata();
  const expected = mimeType === "image/jpeg" ? "jpeg" : mimeType === "image/png" ? "png" : null;
  if (
    !expected ||
    metadata.format !== expected ||
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1
  ) {
    throw new Error("menu must be a JPEG or PNG image");
  }
  // Decode to detect corrupt files before publishing their storage path.
  await image.stats();
  const rotated = (metadata.orientation ?? 1) >= 5;
  return {
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height,
  };
}
