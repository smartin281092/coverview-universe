import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import {
  actionSocketAuthSchema,
  actionSocketPath,
  actionReadEvent,
  actionReadInputSchema,
  actionReadResultSchema,
  actionReadErrorSchema,
  type ActionReadResult,
} from "@coverview/contracts";
import type { createActionCenterRepository } from "./document.action-center.repository.js";

export type RealtimeIdentity = {
  authenticateRealtime(
    headers: IncomingHttpHeaders,
    csrf: string,
    remote?: boolean,
  ): Promise<{ id: string; userId: string }>;
};
function failure(error: unknown): Extract<ActionReadResult, { ok: false }> {
  const value = error as { code?: unknown; statusCode?: unknown } | null;
  const code = actionReadErrorSchema.safeParse(value?.code);
  return {
    ok: false,
    code: code.success ? code.data : "PLATFORM_INTERNAL_ERROR",
    status:
      typeof value?.statusCode === "number" && value.statusCode >= 400 && value.statusCode <= 599
        ? value.statusCode
        : 500,
  };
}
export function registerActionRealtime(
  app: FastifyInstance,
  repository: Pick<ReturnType<typeof createActionCenterRepository>, "details">,
  identity: RealtimeIdentity,
  origins: { wallet: string; api: string },
) {
  const io = new Server<
    {
      [actionReadEvent]: (payload: unknown, acknowledge: (value: ActionReadResult) => void) => void;
    },
    Record<string, never>,
    Record<string, never>,
    { actor: { id: string; userId: string }; csrf: string }
  >(app.server, {
    path: actionSocketPath,
    transports: ["websocket"],
    serveClient: false,
    maxHttpBufferSize: 8192,
    connectTimeout: 10000,
    cors: { origin: origins.wallet, credentials: true },
    allowRequest: (request, done) =>
      done(
        null,
        request.headers.origin === origins.wallet &&
          request.headers.host === new URL(origins.api).host &&
          io.engine.clientsCount < 128,
      ),
  });
  const sessions = new Map<string, number>();
  io.use((socket, next) => {
    const authenticate = async () => {
      try {
        const auth = actionSocketAuthSchema.parse(socket.handshake.auth);
        const actor = await identity.authenticateRealtime(
          socket.handshake.headers,
          auth.csrfToken,
          true,
        );
        if ((sessions.get(actor.id) ?? 0) >= 4) {
          next(new Error("IDENTITY_RATE_LIMITED"));
          return;
        }
        socket.data.actor = actor;
        socket.data.csrf = auth.csrfToken;
        next();
      } catch (error) {
        next(Object.assign(new Error("Action connection refused"), { data: failure(error) }));
      }
    };
    void authenticate();
  });
  io.on("connection", (socket) => {
    const actor = socket.data.actor;
    sessions.set(actor.id, (sessions.get(actor.id) ?? 0) + 1);
    let count = 0;
    let windowStart = Date.now();
    let active = 0;
    let validating = false;
    const authorize = async (remote = false) => {
      const current = await identity.authenticateRealtime(
        socket.handshake.headers,
        socket.data.csrf,
        remote,
      );
      if (current.id !== actor.id || current.userId !== actor.userId)
        throw Object.assign(new Error("Session changed"), {
          code: "IDENTITY_UNAUTHENTICATED",
          statusCode: 401,
        });
      return current;
    };
    const timer = setInterval(() => {
      if (validating) return;
      validating = true;
      void authorize(true)
        .catch(() => socket.disconnect(true))
        .finally(() => {
          validating = false;
        });
    }, 30000);
    timer.unref();
    socket.on(actionReadEvent, (payload, acknowledge) => {
      const read = async () => {
        if (typeof acknowledge !== "function") return;
        const reply = (value: ActionReadResult) => {
          if (socket.connected) acknowledge(value);
        };
        if (Date.now() - windowStart > 60000) {
          count = 0;
          windowStart = Date.now();
        }
        if (++count > 120 || active >= 3) {
          reply({ ok: false, code: "IDENTITY_RATE_LIMITED", status: 429 });
          return;
        }
        const input = actionReadInputSchema.safeParse(payload);
        if (!input.success) {
          reply({ ok: false, code: "PLATFORM_INVALID_REQUEST", status: 400 });
          return;
        }
        active++;
        try {
          const current = await authorize();
          const data = await repository.details(
            current.userId,
            input.data.id,
            input.data.profileId,
          );
          await authorize();
          reply(actionReadResultSchema.parse({ ok: true, data }));
        } catch (error) {
          const result = failure(error);
          reply(result);
          if (result.status === 401 || result.status === 403) socket.disconnect(true);
        } finally {
          active--;
        }
      };
      void read().catch(() => socket.disconnect(true));
    });
    socket.on("disconnect", () => {
      clearInterval(timer);
      const remaining = (sessions.get(actor.id) ?? 1) - 1;
      if (remaining > 0) sessions.set(actor.id, remaining);
      else sessions.delete(actor.id);
    });
  });
  app.addHook("preClose", (done) => {
    io.disconnectSockets(true);
    void io.close(() => done());
  });
}
