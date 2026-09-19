import { PDFDocument } from "@cantoo/pdf-lib";
import type { AuthorizationReceipt } from "@coverview/contracts";

type TextLine = { text: string; size: number; weight: number; y: number };
type PageLayout = { lines: TextLine[]; signatureY?: number };

export async function downloadAuthorization(
  receipt: AuthorizationReceipt,
  labels: {
    signed: string;
    signer: string;
    place: string;
    accepted: string;
    integrity: string;
    fields: Record<string, string>;
  },
) {
  // Browser font fallback preserves names and legal text beyond WinAnsi. The
  // immutable JSON remains attached because raster pages are not searchable text.
  const family = getComputedStyle(document.documentElement)
    .getPropertyValue("--cv-font-sans")
    .trim();
  await Promise.all([400, 600].map((weight) => document.fonts.load(`${weight} 10px ${family}`)));
  await document.fonts.ready;
  const width = 595.28;
  const height = 841.89;
  const margin = 52;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * 2);
  canvas.height = Math.ceil(height * 2);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Authorization rendering unavailable");
  context.scale(2, 2);
  const font = (size: number, weight: number) => `${weight} ${size}px ${family}`;
  const pages: PageLayout[] = [{ lines: [] }];
  let layout = pages[0]!;
  let y = margin;
  const ensureSpace = (space: number) => {
    if (y + space <= height - margin) return;
    layout = { lines: [] };
    pages.push(layout);
    y = margin;
  };
  const draw = (text: string, size: number, weight: number) => {
    ensureSpace(size * 1.55);
    layout.lines.push({ text, size, weight, y });
    y += size * 1.55;
  };
  const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const line = (text: string, size = 10, weight = 400) => {
    context.font = font(size, weight);
    const available = width - 2 * margin;
    for (const paragraph of text.split("\n")) {
      const wrapped: string[] = [];
      let current = "";
      for (const word of paragraph.match(/\S+|\s+/gu) ?? []) {
        if (context.measureText(current + word).width <= available) {
          current += word;
          continue;
        }
        if (current) wrapped.push(current.trimEnd());
        current = "";
        if (!word.trim()) continue;
        // Long identifiers and scripts without spaces wrap at grapheme boundaries.
        for (const { segment } of graphemes.segment(word)) {
          if (current && context.measureText(current + segment).width > available) {
            wrapped.push(current);
            current = "";
          }
          current += segment;
        }
      }
      wrapped.push(current);
      for (const [index, textLine] of wrapped.entries()) {
        if (index === wrapped.length - 2) ensureSpace(size * 3.1);
        draw(textLine, size, weight);
      }
    }
    y += 8;
  };
  line(receipt.document.title, 20, 600);
  line(receipt.document.organization);
  for (const [key, value] of Object.entries(receipt.document.values))
    line(`${labels.fields[key] ?? key} : ${value}`);
  for (const section of receipt.document.sections) {
    ensureSpace(65);
    line(section.title, 12, 600);
    line(section.text);
  }
  ensureSpace(200);
  line(`${labels.signed} : ${receipt.signedAt}`, 11, 600);
  line(`${labels.signer} : ${receipt.signerName}`);
  line(`${labels.place} : ${receipt.place}`);
  line(labels.accepted);
  ensureSpace(145);
  layout.signatureY = y;
  y += 145;
  line(`${labels.integrity} : ${receipt.integrityHash}`, 8);
  line(receipt.id, 8);

  const pdf = await PDFDocument.create();
  pdf.setTitle(receipt.document.title);
  pdf.setSubject(receipt.id);
  pdf.setCreationDate(new Date(receipt.signedAt));
  await pdf.attach(new TextEncoder().encode(JSON.stringify(receipt)), "authorization.json", {
    mimeType: "application/json",
    description: receipt.document.version,
  });
  try {
    for (const [index, current] of pages.entries()) {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#1f1f26";
      context.textBaseline = "top";
      for (const item of current.lines) {
        context.font = font(item.size, item.weight);
        context.fillText(item.text, margin, item.y);
      }
      if (current.signatureY !== undefined) {
        context.strokeStyle = "#1f1f26";
        context.lineWidth = 1.2;
        context.lineCap = "round";
        context.lineJoin = "round";
        for (const stroke of receipt.drawing) {
          context.beginPath();
          stroke.forEach(([x, pointY], point) => {
            const coords = [margin + x * 360, current.signatureY! + pointY * 120] as const;
            if (point === 0) context.moveTo(...coords);
            else context.lineTo(...coords);
          });
          context.stroke();
        }
      }
      context.font = font(8, 400);
      context.fillStyle = "#66666f";
      context.fillText(receipt.document.version, margin, height - 30);
      const pageNumber = `${index + 1} / ${pages.length}`;
      context.fillText(
        pageNumber,
        width - margin - context.measureText(pageNumber).width,
        height - 30,
      );
      const png = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Authorization page unavailable"))),
          "image/png",
        );
      });
      const image = await pdf.embedPng(await png.arrayBuffer());
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    }
    const bytes = await pdf.save();
    const url = URL.createObjectURL(
      new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${receipt.document.kind}-${receipt.id}.pdf`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
