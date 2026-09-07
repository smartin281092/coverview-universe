import { createConnection } from "node:net";
import type { DocumentConfig } from "./document.config.js";

export class ProcessingError extends Error {
  constructor(
    public code: string,
    public retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "ProcessingError";
  }
}
export async function scanDocument(bytes: Buffer, config: DocumentConfig): Promise<string> {
  async function request(command: string, content?: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = createConnection({ host: config.CLAMAV_HOST, port: config.CLAMAV_PORT });
      let result = "";
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        if (error) reject(error);
        else resolve(result.replace(/\0$/u, ""));
      };
      const timer = setTimeout(
        () => finish(new ProcessingError("antivirus_unavailable", true)),
        45000,
      );
      socket.on("error", (error) =>
        finish(new ProcessingError("antivirus_unavailable", true, { cause: error })),
      );
      socket.on("end", () => finish());
      socket.on("data", (data) => {
        result += data.toString("utf8");
        if (result.length > 2048) finish(new ProcessingError("antivirus_invalid_response", true));
        else if (result.includes("\0")) finish();
      });
      socket.on("connect", () => {
        socket.write(`z${command}\0`);
        if (!content) return;
        // Bound upload: ClamAV INSTREAM parses the same immutable bytes read back from storage.
        for (let offset = 0; offset < content.length; offset += 65536) {
          const chunk = content.subarray(offset, offset + 65536);
          const length = Buffer.alloc(4);
          length.writeUInt32BE(chunk.length);
          socket.write(length);
          socket.write(chunk);
        }
        socket.write(Buffer.alloc(4));
      });
    });
  }
  const version = await request("VERSION");
  if (!version.startsWith("ClamAV ")) throw new ProcessingError("antivirus_invalid_response", true);
  const result = await request("INSTREAM", bytes);
  if (result === "stream: OK") return version.slice(0, 200);
  if (result.endsWith(" FOUND")) throw new ProcessingError("malware_detected", false);
  throw new ProcessingError("antivirus_unavailable", true);
}
