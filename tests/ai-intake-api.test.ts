import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ auth: vi.fn(), runtime: vi.fn(), used: vi.fn(), create: vi.fn(), audit: vi.fn() }));
vi.mock("../lib/session", () => ({ getCurrentUser: mock.auth }));
vi.mock("../lib/ai-settings", () => ({ getAiRuntime: mock.runtime, aiUsedToday: mock.used, anthropicClient: () => ({ beta: { messages: { create: mock.create } } }), describeAnthropicError: () => "AI không phản hồi" }));
vi.mock("../lib/audit", () => ({ audit: mock.audit }));
import { POST } from "../app/api/ai/intake/route";
const body = { attachments: [{ name: "a.txt", data: Buffer.from("Dự án A, hợp đồng 001").toString("base64") }] };
const request = (value: unknown = body) => POST(new NextRequest("http://local/api/ai/intake", { method: "POST", body: JSON.stringify(value) }));
beforeEach(() => {
  vi.clearAllMocks(); mock.auth.mockResolvedValue({ id: "me", name: "Me" }); mock.runtime.mockResolvedValue({ apiKey: "test-only", model: "test", dailyLimit: 10 }); mock.used.mockResolvedValue(2);
  mock.create.mockResolvedValue({ model: "test", usage: { input_tokens: 10, output_tokens: 20 }, stop_reason: "tool_use", content: [{ type: "tool_use", name: "prepare_intake", input: { summary: "Dữ liệu từ file", proposals: [{ kind: "project", fields: { name: "Dự án A" }, warnings: [], evidence: [{ field: "name", file: "a.txt", location: "Dòng 1", quote: "Dự án A" }] }] } }] });
});
it("requires login, configured AI and remaining quota before any provider call", async () => {
  mock.auth.mockResolvedValueOnce(null); expect((await request()).status).toBe(401);
  mock.runtime.mockResolvedValueOnce(null); expect((await request()).status).toBe(400);
  mock.used.mockResolvedValueOnce(10); expect((await request()).status).toBe(429);
  expect(mock.create).not.toHaveBeenCalled();
});
it("rejects missing and malformed attachments without calling the provider", async () => {
  expect((await request({ attachments: [] })).status).toBe(400);
  expect((await request({ attachments: [{ name: "fake.pdf", data: "QUJDRA==" }] })).status).toBe(400);
  expect(mock.create).not.toHaveBeenCalled();
});
it("returns a sourced draft, binds cancellation, audits usage without raw file contents and disables caching", async () => {
  const res = await request(); expect(res.status).toBe(200); expect(res.headers.get("Cache-Control")).toBe("private, no-store");
  const result = await res.json(); expect(result.remaining).toBe(7); expect(result.proposals[0].fields.name).toBe("Dự án A");
  const [params, options] = mock.create.mock.calls[0]; expect(params.tool_choice.name).toBe("prepare_intake"); expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(JSON.stringify(mock.audit.mock.calls)).not.toContain(body.attachments[0].data);
  expect(mock.audit.mock.calls[0][1].details.kind).toBe("file-intake");
});
it("rejects truncated, refused and malformed AI output instead of offering incomplete form values", async () => {
  const normal = await mock.create(); mock.create.mockClear();
  mock.create.mockResolvedValueOnce({ ...normal, stop_reason: "max_tokens" }); expect((await request()).status).toBe(400);
  mock.create.mockResolvedValueOnce({ ...normal, content: [] }); expect((await request()).status).toBe(400);
  mock.create.mockResolvedValueOnce({ ...normal, content: [{ type: "tool_use", name: "prepare_intake", input: { proposals: "bad" } }] }); expect((await request()).status).toBe(400);
});
