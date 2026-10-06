import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { menuImageSize } from "./image";

describe("actual menu image validation", () => {
  it("reads a PNG's own dimensions", async () => {
    const bytes = await sharp({ create: { width: 37, height: 61, channels: 3, background: "red" } })
      .png()
      .toBuffer();
    expect(await menuImageSize(bytes, "image/png")).toEqual({ width: 37, height: 61 });
  });
  it("uses the displayed dimensions of an EXIF-rotated phone photo", async () => {
    const bytes = await sharp({ create: { width: 37, height: 61, channels: 3, background: "blue" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    expect(await menuImageSize(bytes, "image/jpeg")).toEqual({ width: 61, height: 37 });
  });
  it("rejects a MIME mismatch and PDF content instead of substituting sample data", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } })
      .png()
      .toBuffer();
    await expect(menuImageSize(bytes, "image/jpeg")).rejects.toThrow();
    await expect(menuImageSize(Buffer.from("%PDF-1.4"), "application/pdf")).rejects.toThrow();
  });
  it("rejects corrupt and empty image data", async () => {
    await expect(menuImageSize(Buffer.from("not an image"), "image/jpeg")).rejects.toThrow();
    await expect(menuImageSize(Buffer.alloc(0), "image/png")).rejects.toThrow();
  });
});
