import { describe, expect, it } from "vitest";
import { Router, handleFetch } from "@/petdex/server/router.js";

// The game's Express-compatible router shim (petdex/server/router.js).

type Req = { method: string; path: string; params: Record<string, string>; query: Record<string, string>; body?: unknown; user?: unknown; get(name: string): string | undefined };
type Res = { status(code: number): Res; json(value: unknown): Res; send(body?: string): Res };

function app() {
  const api = Router();
  const inner = Router();
  inner.use((req: Req & { seen?: boolean }, _res: Res, next: () => void) => {
    req.seen = true;
    next();
  });
  inner.get("/inner/:id", (req: Req & { seen?: boolean }, res: Res) => res.json({ inner: req.params.id, seen: req.seen }));
  api.get("/items/:id", (req: Req, res: Res) => res.json({ id: req.params.id, q: req.query.range ?? null }));
  api.post("/items", (req: Req, res: Res) => res.status(201).json({ body: req.body }));
  api.get("/boom", () => {
    throw new Error("kaboom");
  });
  api.get("/async", async (_req: Req, res: Res) => {
    await new Promise((r) => setTimeout(r, 5));
    res.json({ ok: true });
  });
  api.use(inner);
  api.use("/{*rest}", (_req: Req, res: Res) => res.status(404).json({ error: "Không tìm thấy." }));
  // Error handlers are told apart by arity (4 parameters), as in Express.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  api.use((err: Error, _req: Req, res: Res, _next: () => void) => res.status(500).json({ error: err.message }));
  return api;
}

const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await handleFetch(app(), new Request(`http://x${path}`, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) }), { prefix: "/api" });
  return { status: res.status, data: await res.json() };
};

describe("petdex router", () => {
  it("matches params and query, strips the mount prefix", async () => {
    expect(await call("GET", "/api/items/42?range=week")).toEqual({ status: 200, data: { id: "42", q: "week" } });
  });
  it("parses JSON bodies and keeps the handler's status", async () => {
    expect(await call("POST", "/api/items", { name: "Boba" })).toEqual({ status: 201, data: { body: { name: "Boba" } } });
  });
  it("rejects bodies that are not JSON or too large", async () => {
    expect((await call("POST", "/api/items", "{nope")).status).toBe(400);
    expect((await call("POST", "/api/items", "x".repeat(20_000))).status).toBe(413);
  });
  it("runs nested routers with their middleware", async () => {
    expect(await call("GET", "/api/inner/7")).toEqual({ status: 200, data: { inner: "7", seen: true } });
  });
  it("falls through to the catch-all 404", async () => {
    expect(await call("GET", "/api/nothing/here")).toEqual({ status: 404, data: { error: "Không tìm thấy." } });
    expect((await call("POST", "/api/items/1")).status).toBe(404);
  });
  it("hands thrown errors to the error handler", async () => {
    expect(await call("GET", "/api/boom")).toEqual({ status: 500, data: { error: "kaboom" } });
  });
  it("awaits async handlers", async () => {
    expect(await call("GET", "/api/async")).toEqual({ status: 200, data: { ok: true } });
  });
});
