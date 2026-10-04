import { io } from "socket.io-client";
import {
  actionReadEvent,
  actionReadInputSchema,
  actionReadResultSchema,
  actionSocketPath,
  type ActionReadInput,
  type ActionCardDetails,
  type ApiErrorCode,
} from "@coverview/contracts";

export type ActionStreamOptions = { csrfToken: string; onReconnect: () => void };
export function createActionStream(
  origin: string,
  options: ActionStreamOptions,
  error: (code: ApiErrorCode, status: number) => Error,
) {
  const socket = io(origin, {
    path: actionSocketPath,
    transports: ["websocket"],
    withCredentials: true,
    auth: { csrfToken: options.csrfToken },
    autoConnect: false,
    timeout: 8000,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  let connectedOnce = false;
  let unavailable = false;
  let closed = false;
  const lifetime = new AbortController();
  socket.on("connect", () => {
    unavailable = false;
    if (connectedOnce) options.onReconnect();
    connectedOnce = true;
  });
  socket.on("connect_error", () => {
    unavailable = true;
  });
  socket.on("disconnect", (reason) => {
    unavailable = true;
    if (reason === "io server disconnect") options.onReconnect();
  });
  socket.connect();
  return {
    close() {
      closed = true;
      lifetime.abort();
      socket.disconnect();
      socket.removeAllListeners();
    },
    read(input: ActionReadInput, signal?: AbortSignal): Promise<ActionCardDetails> {
      const payload = actionReadInputSchema.parse(input);
      return new Promise((resolve, reject) => {
        const aborted = () => finish(new DOMException("Aborted", "AbortError"));
        const disconnected = () => finish(error("PLATFORM_INTERNAL_ERROR", 0));
        const failed = (cause: Error & { data?: unknown }) => {
          const parsed = actionReadResultSchema.safeParse(cause.data);
          finish(
            parsed.success && !parsed.data.ok
              ? error(parsed.data.code, parsed.data.status)
              : error("PLATFORM_INTERNAL_ERROR", 0),
          );
        };
        const timer = setTimeout(disconnected, 10000);
        let settled = false;
        function finish(cause?: unknown, data?: ActionCardDetails) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          socket.off("connect", send);
          socket.off("connect_error", failed);
          socket.off("disconnect", disconnected);
          signal?.removeEventListener("abort", aborted);
          lifetime.signal.removeEventListener("abort", aborted);
          if (cause) reject(cause instanceof Error ? cause : new Error("Invalid action response"));
          else if (data) resolve(data);
        }
        function send() {
          socket
            .timeout(8000)
            .emit(actionReadEvent, payload, (timeout: Error | null, result: unknown) => {
              if (timeout) {
                disconnected();
                return;
              }
              try {
                const parsed = actionReadResultSchema.parse(result);
                if (parsed.ok) finish(undefined, parsed.data);
                else finish(error(parsed.code, parsed.status));
              } catch (cause) {
                finish(cause);
              }
            });
        }
        if (closed || signal?.aborted) {
          aborted();
          return;
        }
        if (unavailable && !socket.connected) {
          disconnected();
          return;
        }
        signal?.addEventListener("abort", aborted, { once: true });
        lifetime.signal.addEventListener("abort", aborted, { once: true });
        socket.once("connect_error", failed);
        socket.once("disconnect", disconnected);
        if (socket.connected) send();
        else socket.once("connect", send);
      });
    },
  };
}
