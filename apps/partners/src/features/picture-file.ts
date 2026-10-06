import { profileImageMaxBytes } from "@coverview/contracts/partner-profiles";

export const pictureTypes = ["image/jpeg", "image/png", "image/webp"];
export class PictureError extends Error {
  constructor(public readonly code: "type" | "image" | "size") {
    super(code);
  }
}
export type PreparedPicture = {
  blob: Blob;
  url: string;
  input: { name: string; mime: "image/jpeg" | "image/png"; size: number; checksum: string };
};

/**
 * Redraws the image in the browser (C8c): camera orientation applied, size bounded, and only the
 * pixels re-encoded, so no camera or location metadata leaves the device. A photo becomes a
 * JPEG on white; a logo stays a PNG to keep its transparency.
 */
export async function preparePicture(file: File, kind: "photo" | "logo"): Promise<PreparedPicture> {
  if (!pictureTypes.includes(file.type)) throw new PictureError("type");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PictureError("image");
  }
  try {
    const longest = kind === "photo" ? 1024 : 512;
    const scale = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PictureError("image");
    const mime = kind === "photo" ? "image/jpeg" : "image/png";
    if (mime === "image/jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new PictureError("image"))),
        mime,
        0.88,
      );
    });
    canvas.width = 0;
    canvas.height = 0;
    if (blob.size > profileImageMaxBytes) throw new PictureError("size");
    const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    const checksum = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    return {
      blob,
      url: URL.createObjectURL(blob),
      input: {
        name: kind === "photo" ? "photo.jpg" : "logo.png",
        mime,
        size: blob.size,
        checksum,
      },
    };
  } finally {
    bitmap.close();
  }
}
