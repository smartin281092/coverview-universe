import { afterEach, expect, it, vi } from "vitest";
import { ApiError } from "./index.js";
import { createActionStream } from "./action-stream.js";

const fake = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const socket = {
    connected: true,
    on: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
    }),
    once: vi.fn((name: string, listener: (...args: unknown[]) => void) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name)!.add(listener);
    }),
    off: vi.fn((name: string, listener: (...args: unknown[]) => void) =>
      listeners.get(name)?.delete(listener),
    ),
    connect: vi.fn(),
    disconnect: vi.fn(),
    removeAllListeners: vi.fn(() => listeners.clear()),
    timeout: vi.fn(),
    emit: vi.fn(),
  };
  socket.timeout.mockReturnValue(socket);
  return { socket, listeners };
});
vi.mock("socket.io-client", () => ({ io: () => fake.socket }));
afterEach(() => {
  vi.clearAllMocks();
  fake.listeners.clear();
  fake.socket.connected = true;
});
const input = { id: `act_${"a".repeat(32)}`, profileId: "self" };
const open = (onReconnect = vi.fn()) =>
  createActionStream(
    "http://isolated.test",
    {
      csrfToken: "isolated",
      onReconnect,
    },
    (code, status) => new ApiError(code, status),
  );

it("cancels pending reads on scope disposal and ignores late replies", async () => {
  const stream = open();
  const result = stream.read(input);
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  const acknowledge = fake.socket.emit.mock.calls[0]![2] as (error: null, data: unknown) => void;
  stream.close();
  await rejected;
  acknowledge(null, { ok: false, code: "DOCUMENT_NOT_FOUND", status: 404 });
  expect(fake.socket.disconnect).toHaveBeenCalledOnce();
  expect(fake.listeners.size).toBe(0);
});

it("propagates authorization errors without retrying or buffering another read", async () => {
  const stream = open();
  const result = stream.read(input);
  const rejected = expect(result).rejects.toMatchObject({
    code: "IDENTITY_UNAUTHENTICATED",
    status: 401,
  });
  const acknowledge = fake.socket.emit.mock.calls[0]![2] as (error: null, data: unknown) => void;
  acknowledge(null, { ok: false, code: "IDENTITY_UNAUTHENTICATED", status: 401 });
  await rejected;
  expect(fake.socket.emit).toHaveBeenCalledOnce();
  stream.close();
});

it("resynchronizes after reconnect and rejects unavailable reads immediately", async () => {
  const resync = vi.fn();
  const stream = open(resync);
  const emit = (name: string, ...args: unknown[]) => {
    for (const listener of fake.listeners.get(name) ?? []) listener(...args);
  };
  emit("connect");
  expect(resync).not.toHaveBeenCalled();
  fake.socket.connected = false;
  emit("disconnect", "transport close");
  await expect(stream.read(input)).rejects.toMatchObject({ status: 0 });
  expect(fake.socket.emit).not.toHaveBeenCalled();
  fake.socket.connected = true;
  emit("connect");
  expect(resync).toHaveBeenCalledOnce();
  stream.close();
});
