import type { OutgoingHttpHeaders } from "node:http";
import type { FastifyBaseLogger, FastifyReply } from "fastify";
import type { Notification, Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  liveEvents,
  liveLeadChangedSchema,
  liveNotificationsChangedSchema,
} from "@coverview/contracts/partner-live";
import { fail, visible, type PartnerActor } from "./partner.policy.js";

type Connection = {
  actor: PartnerActor;
  reply: FastifyReply;
  sequence: number;
  timers: NodeJS.Timeout[];
};
const payloadSchema = z.union([
  z
    .object({
      lead: z.string().min(1).max(100),
      audience: z.enum(["private", "assigned", "client", "coverview"]),
    })
    .strict(),
  z
    .object({
      notification: z.literal(true),
      recipient: z.string().nullable(),
      audience: z.enum(["partner", "wallet", "coverview"]),
    })
    .strict(),
]);
const perUser = 4,
  perSurface = 256,
  debounceMs = 250,
  heartbeatMs = 25000,
  verifyMs = 60000;

// Live gateway (RT-10): producers only commit; triggers notify after commit and this hub decides,
// connection by connection, who may learn that a Lead changed. Nothing about the content is sent.
export function createLiveHub(pool: Pool, logger: FastifyBaseLogger) {
  const connections = new Set<Connection>();
  const pending = new Map<string, { timer: NodeJS.Timeout; audiences: Set<string> }>();
  let listener: PoolClient | null = null,
    stopped = false,
    listened = false,
    retry: NodeJS.Timeout | undefined;

  function send(connection: Connection, type: string, data: unknown) {
    if (!connections.has(connection) || connection.reply.raw.writableEnded) return;
    connection.sequence += 1;
    connection.reply.raw.write(
      `id: ${connection.sequence}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`,
    );
  }
  // RT-07: membership of a stream never grants an event; the current visibility rule does.
  // The audience mirrors the Lead activity a reader can see: Wallet the client audience, members
  // also assigned work, CoverView events for administrators only; private notes reach nobody.
  async function leadChanged(leadId: string, audiences: Set<string>) {
    const at = new Date().toISOString(),
      decided = new Map<string, boolean>();
    for (const connection of [...connections]) {
      const { actor } = connection;
      const readable =
        audiences.has("client") ||
        (!actor.wallet &&
          (audiences.has("assigned") || (audiences.has("coverview") && actor.administrator)));
      if (!readable) continue;
      // Several tabs of one reader share a single visibility check per change.
      const reader = `${actor.userId}:${actor.wallet ? "wallet" : "partner"}:${actor.administrator}`;
      try {
        let allowed = decided.get(reader);
        if (allowed === undefined) {
          allowed = !!(
            await pool.query(`select 1 from partner_leads l where l.id=$2 and ${visible(actor)}`, [
              actor.userId,
              leadId,
            ])
          ).rowCount;
          decided.set(reader, allowed);
        }
        if (allowed)
          send(connection, liveEvents.leadChanged, liveLeadChangedSchema.parse({ leadId, at }));
      } catch {
        logger.warn({ dependency: "partner_live" }, "Live visibility check failed");
      }
    }
  }
  function notificationsChanged(recipient: string | null, audience: string) {
    const at = new Date().toISOString();
    for (const connection of connections) {
      const { actor } = connection;
      const own =
        !!recipient &&
        actor.userId === recipient &&
        (audience === "wallet" ? !!actor.wallet : !actor.wallet);
      const coverview =
        !recipient && audience === "coverview" && actor.administrator && !actor.wallet;
      if (own || coverview)
        send(
          connection,
          liveEvents.notificationsChanged,
          liveNotificationsChangedSchema.parse({ at }),
        );
    }
  }
  function received(message: Notification) {
    let parsed: z.infer<typeof payloadSchema>;
    try {
      parsed = payloadSchema.parse(JSON.parse(message.payload ?? ""));
    } catch {
      return;
    }
    if ("lead" in parsed) {
      const leadId = parsed.lead,
        current = pending.get(leadId);
      if (parsed.audience === "private") return;
      if (current) {
        current.audiences.add(parsed.audience);
        return;
      }
      const audiences = new Set([parsed.audience]);
      pending.set(leadId, {
        audiences,
        timer: setTimeout(() => {
          pending.delete(leadId);
          void leadChanged(leadId, audiences);
        }, debounceMs),
      });
    } else notificationsChanged(parsed.recipient, parsed.audience);
  }
  function lost(client: PoolClient) {
    // Only the active listener is handled, and only once; startup failures release in listen().
    if (listener !== client) return;
    listener = null;
    logger.warn({ dependency: "partner_live" }, "Live listener lost");
    client.release(true);
    schedule();
  }
  async function listen() {
    if (stopped) return;
    let client: PoolClient | undefined;
    try {
      client = await pool.connect();
      const current = client;
      current.on("notification", received);
      current.on("error", () => lost(current));
      await current.query("listen partner_live");
      if (stopped) {
        current.release(true);
        return;
      }
      listener = current;
      // Changes committed while the listener was down are unknown: closing the streams makes
      // every browser reconnect and re-read through the API (RT-14).
      if (listened) for (const connection of [...connections]) close(connection);
      listened = true;
    } catch {
      logger.warn({ dependency: "partner_live" }, "Live listener unavailable");
      client?.release(true);
      schedule();
    }
  }
  function schedule() {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      void listen();
    }, 5000);
  }
  function close(connection: Connection) {
    if (!connections.delete(connection)) return;
    for (const timer of connection.timers) clearInterval(timer);
    connection.reply.raw.end();
  }
  return {
    start: () => listen(),
    async stop() {
      stopped = true;
      clearTimeout(retry);
      for (const item of pending.values()) clearTimeout(item.timer);
      pending.clear();
      for (const connection of [...connections]) close(connection);
      if (listener) {
        const client = listener;
        listener = null;
        await client.query("unlisten partner_live").catch(() => undefined);
        // Destroyed rather than pooled: its listeners must not follow it to another caller.
        client.release(true);
      }
    },
    // SSE stream (RT-01). The caller has authenticated the actor; "verify" re-checks the session
    // every minute so a revoked session stops receiving events (RT-11).
    open(reply: FastifyReply, actor: PartnerActor, verify: () => Promise<boolean>) {
      // Each surface has its own capacity: many Wallet owners never crowd out professionals.
      const surface = [...connections].filter((item) => !!item.actor.wallet === !!actor.wallet);
      const mine = surface.filter((item) => item.actor.userId === actor.userId);
      if (mine.length >= perUser || surface.length >= perSurface) fail("PARTNER_RATE_LIMITED", 429);
      reply.hijack();
      const raw = reply.raw;
      // The server cuts idle sockets after 10 s; a stream is quiet between heartbeats by design.
      raw.setTimeout(0);
      raw.writeHead(200, {
        ...(reply.getHeaders() as OutgoingHttpHeaders),
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      raw.write("retry: 5000\n\n");
      const connection: Connection = { actor, reply, sequence: 0, timers: [] };
      connections.add(connection);
      let verifying = false;
      const heartbeat = setInterval(() => {
        if (!raw.writableEnded) raw.write(": ping\n\n");
      }, heartbeatMs);
      const check = setInterval(() => {
        if (verifying) return;
        verifying = true;
        void verify()
          .then(
            (valid) => {
              if (!valid) close(connection);
            },
            () => close(connection),
          )
          .finally(() => {
            verifying = false;
          });
      }, verifyMs);
      heartbeat.unref();
      check.unref();
      connection.timers.push(heartbeat, check);
      // The response, not the request, reports a closed connection for a long-lived stream.
      raw.on("close", () => close(connection));
      raw.on("error", () => close(connection));
      return reply;
    },
    size: () => connections.size,
  };
}
