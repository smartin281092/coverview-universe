import { Worker } from "node:worker_threads";
import { z } from "zod";

const resultSchema = z.object({
  partial: z.boolean(),
  annotations: z
    .array(
      z.object({
        page: z.number().int().min(1).max(20),
        rectangle: z.array(z.number().finite()).length(4),
        text: z.string().min(1).max(2000),
      }),
    )
    .max(500),
});

export async function pdfAnnotationText(
  bytes: Buffer,
  signal: AbortSignal,
): Promise<{ text?: string; failed: boolean }> {
  signal.throwIfAborted();
  if (!bytes.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return { failed: true };
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL(
        import.meta.url.endsWith(".ts")
          ? "./document.pdf-annotations-worker.ts"
          : "./document.pdf-annotations-worker.js",
        import.meta.url,
      ),
      {
        workerData: bytes,
        resourceLimits: { maxOldGenerationSizeMb: 128 },
        stdout: true,
        stderr: true,
      },
    );
    // Parser output may contain source text. Never forward it to application logs.
    worker.stdout.resume();
    worker.stderr.resume();
    let done = false;
    const finish = (value: { text?: string; failed: boolean }, aborted = false) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      if (aborted)
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error("Document annotation reading aborted"),
        );
      else resolve(value);
    };
    const abort = () => finish({ failed: true }, true);
    const timeout = setTimeout(() => finish({ failed: true }), 15000);
    signal.addEventListener("abort", abort, { once: true });
    worker.once("error", () => finish({ failed: true }));
    worker.once("exit", () => finish({ failed: true }));
    worker.once("message", (message: unknown) => {
      const parsed = resultSchema.safeParse(message);
      if (!parsed.success) return finish({ failed: true });
      if (!parsed.data.annotations.length) return finish({ failed: parsed.data.partial });
      finish({ failed: parsed.data.partial, text: JSON.stringify(parsed.data.annotations) });
    });
    if (signal.aborted) abort();
  });
}
