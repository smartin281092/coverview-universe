export const maximumDocumentBytes = 20 * 1024 * 1024;
export const maximumDocumentPhotos = 20;
export const photoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export class DocumentPreparationError extends Error {
  constructor(public readonly code: "size" | "photosOnly" | "photoCount" | "image") {
    super(code);
  }
}

async function pngBytes(file: File, signal: AbortSignal): Promise<ArrayBuffer> {
  if (file.type === "image/png") {
    const bytes = await file.arrayBuffer();
    const header = new DataView(bytes);
    if (bytes.byteLength < 24 || header.getUint32(16) * header.getUint32(20) > 40_000_000)
      throw new DocumentPreparationError("image");
    return bytes;
  }
  // The browser applies camera orientation; PNG preserves the decoded pixels without a JPEG re-encode.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    signal.throwIfAborted();
    if (bitmap.width * bitmap.height > 40_000_000) throw new DocumentPreparationError("image");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new DocumentPreparationError("image");
    context.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new DocumentPreparationError("image"))),
        "image/png",
      );
    });
    canvas.width = 0;
    canvas.height = 0;
    return blob.arrayBuffer();
  } finally {
    bitmap.close();
  }
}

export async function prepareDocumentFile(
  files: readonly File[],
  name: string,
  signal: AbortSignal,
): Promise<File> {
  signal.throwIfAborted();
  if (
    !files.length ||
    files.some((file) => !file.size) ||
    files.reduce((sum, file) => sum + file.size, 0) > maximumDocumentBytes
  )
    throw new DocumentPreparationError("size");
  if (files.length > maximumDocumentPhotos) throw new DocumentPreparationError("photoCount");
  const first = files[0];
  if (files.length === 1 && first) return first;
  if (files.some((file) => !photoTypes.has(file.type)))
    throw new DocumentPreparationError("photosOnly");
  const { PDFDocument } = await import("@cantoo/pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.setProducer("CoverView");
  pdf.setCreator("CoverView");
  for (const [index, file] of files.entries()) {
    signal.throwIfAborted();
    const original = await file.arrayBuffer();
    let image;
    try {
      image = await pdf.embedPng(await pngBytes(file, signal));
    } catch {
      signal.throwIfAborted();
      throw new DocumentPreparationError("image");
    }
    const scale = Math.min(1, 842 / Math.max(image.width, image.height));
    const page = pdf.addPage([image.width * scale, image.height * scale]);
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
    // The rendered pages are a derivative. Exact source files remain recoverable as PDF attachments.
    await pdf.attach(original, `${index + 1}-${file.name}`, {
      mimeType: file.type,
      modificationDate: new Date(file.lastModified),
    });
  }
  const bytes = await pdf.save();
  signal.throwIfAborted();
  if (bytes.byteLength > maximumDocumentBytes) throw new DocumentPreparationError("size");
  return new File([Uint8Array.from(bytes)], `${name.replace(/\.pdf$/i, "")}.pdf`, {
    type: "application/pdf",
  });
}
