import { describe, expect, it } from "vitest";
import { createHub, bindWebSocket } from "@/petdex/server/hub.js";

// The park's realtime hub (petdex/server/hub.js): socket.io's surface over plain WebSocket frames.

type Socket = { id: string; data: Record<string, unknown>; handshake: { auth: Record<string, unknown> }; on(event: string, fn: (payload: unknown) => void): Socket; emit(event: string, payload?: unknown): void; join(room: string): void; to(room: string): { emit(event: string, payload?: unknown): void }; disconnect(close?: boolean): void };

function transport() {
  const sent: [string, unknown][] = [];
  let closed = false;
  return { sent, isClosed: () => closed, send: (text: string) => sent.push(JSON.parse(text)), close: () => void (closed = true) };
}

function parkHub() {
  const hub = createHub();
  hub.use((socket: Socket, next: (err?: Error) => void) => (socket.handshake.auth.token === "ok" ? next() : next(new Error("Bạn cần đăng nhập."))));
  hub.on("connection", (socket: Socket) => {
    socket.on("join", () => {
      socket.join("park");
      socket.emit("state", { you: socket.id });
      socket.to("park").emit("joined", { id: socket.id });
    });
    socket.on("chat", (p: unknown) => hub.to("park").emit("chat", { id: socket.id, text: (p as { text: string }).text }));
    socket.on("disconnect", () => hub.to("park").emit("left", { id: socket.id }));
  });
  return hub;
}

describe("petdex hub", () => {
  it("rejects a bad token with connect_error and closes", () => {
    const hub = parkHub();
    const t = transport();
    expect(hub.connect(t, { token: "no" })).toBeNull();
    expect(t.sent).toEqual([["connect_error", { message: "Bạn cần đăng nhập." }]]);
    expect(t.isClosed()).toBe(true);
  });

  it("routes events, rooms and broadcasts like socket.io", () => {
    const hub = parkHub();
    const a = transport();
    const b = transport();
    const sa = hub.connect(a, { token: "ok" })!;
    const sb = hub.connect(b, { token: "ok" })!;
    expect(a.sent[0][0]).toBe("connect");
    hub.message(sa, JSON.stringify(["join", {}]));
    hub.message(sb, JSON.stringify(["join", {}]));
    // a got its own state and b's arrival; b did not get its own "joined"
    expect(a.sent.map(([e]) => e)).toEqual(["connect", "state", "joined"]);
    expect(b.sent.map(([e]) => e)).toEqual(["connect", "state"]);
    hub.message(sb, JSON.stringify(["chat", { text: "hi" }]));
    expect(a.sent.at(-1)).toEqual(["chat", { id: sb.id, text: "hi" }]);
    expect(b.sent.at(-1)).toEqual(["chat", { id: sb.id, text: "hi" }]);
    expect(hub.sockets.sockets.size).toBe(2);
    sb.disconnect();
    expect(b.isClosed()).toBe(true);
    expect(a.sent.at(-1)).toEqual(["left", { id: sb.id }]);
    expect(hub.sockets.sockets.size).toBe(1);
    // garbage frames are ignored
    hub.message(sa, "not json");
    hub.message(sa, JSON.stringify({ event: "x" }));
    expect(a.sent.length).toBe(5); // connect, state, joined, chat, left
  });

  it("binds a WebSocket: first frame authenticates, later frames are events, close cleans up", () => {
    const hub = parkHub();
    const listeners: Record<string, (ev: { data: string }) => void> = {};
    const sent: string[] = [];
    const ws = { addEventListener: (ev: string, fn: (e: { data: string }) => void) => void (listeners[ev] = fn), send: (t: string) => sent.push(t), close: () => {} };
    bindWebSocket(hub, ws);
    listeners.message({ data: JSON.stringify(["auth", { token: "ok" }]) });
    expect(JSON.parse(sent[0])[0]).toBe("connect");
    listeners.message({ data: JSON.stringify(["join", {}]) });
    expect(JSON.parse(sent[1])[0]).toBe("state");
    expect(hub.sockets.sockets.size).toBe(1);
    listeners.close({ data: "" });
    expect(hub.sockets.sockets.size).toBe(0);
  });
});
