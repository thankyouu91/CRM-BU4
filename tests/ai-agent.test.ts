import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mock = vi.hoisted(() => ({
  auth: vi.fn(),
  audit: vi.fn(),
  streams: [] as { events: unknown[]; final: Record<string, unknown> }[],
  requests: [] as Record<string, unknown>[],
  handlers: Object.fromEntries(
    ["projects", "projects/[id]", "projects/[id]/categories", "categories/[id]", "tasks", "tasks/[id]", "contracts", "contracts/[id]", "projects/[id]/notes"].map((r) => [r, vi.fn()]),
  ) as Record<string, ReturnType<typeof vi.fn>>,
}));
vi.mock("../lib/session", () => ({ getCurrentUser: mock.auth }));
vi.mock("../lib/audit", async (orig) => ({ ...(await orig<typeof import("../lib/audit")>()), audit: mock.audit }));
// A fake Claude: each stream() call plays the next scripted answer.
vi.mock("../lib/ai-settings", async (orig) => ({
  ...(await orig<typeof import("../lib/ai-settings")>()),
  anthropicClient: () => ({
    beta: {
      messages: {
        stream: (params: Record<string, unknown>) => {
          mock.requests.push(structuredClone(params));
          const next = mock.streams.shift()!;
          return {
            async *[Symbol.asyncIterator]() {
              for (const e of next.events) yield e;
            },
            finalMessage: async () => next.final,
            abort: () => {},
          };
        },
      },
    },
  }),
}));
// The normal API routes the apply endpoint calls.
vi.mock("../app/api/projects/route", () => ({ POST: mock.handlers["projects"] }));
vi.mock("../app/api/projects/[id]/route", () => ({ PATCH: mock.handlers["projects/[id]"] }));
vi.mock("../app/api/projects/[id]/categories/route", () => ({ POST: mock.handlers["projects/[id]/categories"] }));
vi.mock("../app/api/categories/[id]/route", () => ({ PATCH: mock.handlers["categories/[id]"] }));
vi.mock("../app/api/tasks/route", () => ({ POST: mock.handlers["tasks"] }));
vi.mock("../app/api/tasks/[id]/route", () => ({ PATCH: mock.handlers["tasks/[id]"] }));
vi.mock("../app/api/contracts/route", () => ({ POST: mock.handlers["contracts"] }));
vi.mock("../app/api/contracts/[id]/route", () => ({ PATCH: mock.handlers["contracts/[id]"] }));
vi.mock("../app/api/projects/[id]/notes/route", () => ({ POST: mock.handlers["projects/[id]/notes"] }));

import { actionRequest, dayToIso, ToolError } from "../lib/ai-agent";
import { actionsNote, type AgentAction } from "../lib/ai-actions";
import { streamClaudeAnswer } from "../lib/ai-run";
import { parseEvents } from "../lib/ai-stream";

const noRefs = (v: string) => {
  throw new ToolError(`no ref ${v}`);
};

describe("proposal → API request", () => {
  it("sends calendar days as the start or end of the day in Vietnam time", () => {
    expect(dayToIso("2026-11-02", "start")).toBe("2026-11-01T17:00:00.000Z");
    expect(dayToIso("2026-11-30", "end")).toBe("2026-11-30T16:59:59.000Z");
    const r = actionRequest("create_project", { ref: "p1", name: "Dự án A", startDate: "2026-11-02", dueDate: "2026-11-30", members: [{ userId: "u1" }] }, noRefs);
    expect(r).toEqual({
      method: "POST",
      route: "projects",
      body: { name: "Dự án A", startDate: "2026-11-01T17:00:00.000Z", dueDate: "2026-11-30T16:59:59.000Z", members: [{ userId: "u1", role: "MEMBER" }] },
    });
  });

  it("resolves refs to ids created earlier and keeps clearing (null) apart from leaving unchanged", () => {
    const resolve = (v: string) => ({ "ref:p1": "proj_1", "ref:c1": "cat_1" })[v] ?? noRefs(v);
    expect(actionRequest("create_task", { projectId: "ref:p1", categoryId: "ref:c1", title: "Việc", dueDate: "2026-11-06" }, resolve)).toEqual({
      method: "POST",
      route: "tasks",
      body: { projectId: "proj_1", categoryId: "cat_1", title: "Việc", dueDate: "2026-11-06T16:59:59.000Z" },
    });
    expect(actionRequest("update_task", { taskId: "t1", dueDate: null, status: "DONE" }, noRefs)).toEqual({ method: "PATCH", route: "task", id: "t1", body: { dueDate: null, status: "DONE" } });
    expect(actionRequest("create_category", { projectId: "ref:p1", name: "HM" }, resolve)).toMatchObject({ route: "projectCategories", id: "proj_1", body: { name: "HM" } });
    expect(() => actionRequest("create_task", { projectId: "ref:missing", title: "X" }, noRefs)).toThrow("no ref");
  });

  it("re-validates the input instead of trusting the browser", () => {
    expect(() => actionRequest("create_contract", { name: "HĐ", value: 1.5, performedAt: "2026-11-01" }, noRefs)).toThrow("Dữ liệu chưa hợp lệ");
    expect(() => actionRequest("update_task", { taskId: "t1", dueDate: "30/11/2026" }, noRefs)).toThrow("YYYY-MM-DD");
    // Fields the tools do not offer (e.g. replacing project members on update) are dropped.
    expect(actionRequest("update_project", { projectId: "p", memberIds: [], name: "Mới" }, noRefs).body).toEqual({ name: "Mới" });
  });
});

describe("history note", () => {
  const actions = [{ id: "a1", tool: "create_project", input: {}, title: "Tạo dự án", target: "“A”", lines: [] }] as AgentAction[];
  it("tells the next question what happened", () => {
    expect(actionsNote(actions, null, false)).toContain("đang chờ người dùng áp dụng");
    expect(actionsNote(actions, null, true)).toContain("chưa áp dụng");
    expect(actionsNote(actions, [{ id: "a1", ok: true, message: "Đã tạo dự án “A”", entityId: "p9" }], false)).toContain("Đã áp dụng: Đã tạo dự án “A” (id: p9)");
    expect(actionsNote([], null, false)).toBe("");
  });
});

const text = (t: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text: t } });
const final = (stop: string, content: unknown[], input = 100, output = 10) => ({ model: "claude-haiku-5-5", stop_reason: stop, content, usage: { input_tokens: input, output_tokens: output } });
const runtime = { apiKey: "k", model: "claude-haiku-5-5" as const, dailyLimit: 10 };
async function events(res: Response) {
  return parseEvents((await res.text()) + "\n").events;
}

describe("tool loop in the answer stream", () => {
  beforeEach(() => {
    mock.streams.length = 0;
    mock.requests.length = 0;
    mock.audit.mockReset();
  });

  it("runs tool calls, sends their results back, streams proposals and records one audit row", async () => {
    mock.streams.push(
      { events: [text("Tra cứu.")], final: final("tool_use", [{ type: "text", text: "Tra cứu." }, { type: "tool_use", id: "t1", name: "find_users", input: {} }]) },
      { events: [text("Đề xuất:")], final: final("tool_use", [{ type: "tool_use", id: "t2", name: "create_project", input: { name: "A" } }]) },
      { events: [text("Xong.")], final: final("end_turn", [{ type: "text", text: "Xong." }]) },
    );
    const run = vi.fn(async (call: { id: string; name: string }) =>
      call.name === "create_project" ? { content: "Đã ghi nhận đề xuất", action: { id: call.id, tool: "create_project", input: { name: "A" }, title: "Tạo dự án", target: "“A”", lines: [] } as AgentAction } : { content: '{"users":[]}' },
    );
    const res = streamClaudeAnswer({
      actor: { id: "u", name: "U" },
      runtime,
      used: 2,
      system: "s",
      messages: [{ role: "user", content: "Tạo dự án A" }],
      effort: "medium",
      record: { action: "ai.chat", entityType: "chat", entityId: null, summary: "x", details: {} },
      refusedMessage: "no",
      tools: { definitions: [{ name: "find_users", input_schema: { type: "object" } }], run },
    });
    const ev = await events(res);
    expect(ev.filter((e) => e.t === "text").map((e) => (e as { v: string }).v).join("")).toBe("Tra cứu.\n\nĐề xuất:\n\nXong.");
    expect(ev.filter((e) => e.t === "action")).toHaveLength(1);
    expect(ev.at(-1)).toMatchObject({ t: "done", inputTokens: 300, outputTokens: 30, remaining: 7 });
    expect(run).toHaveBeenCalledTimes(2);
    expect(mock.requests).toHaveLength(3);
    expect(mock.requests.every((r) => Array.isArray(r.tools) && r.tool_choice === undefined)).toBe(true);
    // Step 2 carries the assistant turn and the tool result, appended (never edited).
    const second = mock.requests[1].messages as { role: string; content: unknown }[];
    expect(second.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(second[2].content).toEqual([{ type: "tool_result", tool_use_id: "t1", content: '{"users":[]}' }]);
    expect(mock.requests[2].messages).toHaveLength(5);
    expect(mock.audit).toHaveBeenCalledTimes(1);
    expect(mock.audit.mock.calls[0][1].details).toMatchObject({ steps: 3, actions: 1, inputTokens: 300, stopReason: "end_turn" });
  });

  it("stops after 8 steps and says so", async () => {
    for (let i = 0; i < 9; i++) mock.streams.push({ events: [], final: final("tool_use", [{ type: "tool_use", id: `t${i}`, name: "find_users", input: {} }]) });
    const res = streamClaudeAnswer({
      actor: { id: "u", name: "U" },
      runtime,
      used: 0,
      system: "s",
      messages: [{ role: "user", content: "?" }],
      effort: "low",
      record: { action: "ai.chat", entityType: "chat", entityId: null, summary: "x", details: {} },
      refusedMessage: "no",
      tools: { definitions: [], run: async () => ({ content: "{}" }) },
    });
    const ev = await events(res);
    expect(mock.requests).toHaveLength(8);
    expect(ev.some((e) => e.t === "text" && (e as { v: string }).v.includes("dừng sau 8 bước"))).toBe(true);
    expect(ev.at(-1)?.t).toBe("done");
  });

  it("without tools, a tool_use stop ends the answer (reports keep their old behaviour)", async () => {
    mock.streams.push({ events: [text("A")], final: final("end_turn", [{ type: "text", text: "A" }]) });
    const res = streamClaudeAnswer({
      actor: { id: "u", name: "U" },
      runtime,
      used: 0,
      system: "s",
      messages: [{ role: "user", content: "?" }],
      effort: "low",
      record: { action: "ai.generate", entityType: "report", entityId: null, summary: "x", details: {} },
      refusedMessage: "no",
    });
    await events(res);
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].tools).toBeUndefined();
  });
});

describe("applying approved changes", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  beforeEach(() => {
    mock.auth.mockResolvedValue({ id: "me", name: "Me", role: "ADMIN", permissions: [] });
    for (const fn of Object.values(mock.handlers)) fn.mockReset();
  });
  const apply = async (actions: unknown[]) => {
    const { POST } = await import("../app/api/ai/actions/route");
    const res = await POST(new NextRequest("http://local/api/ai/actions", { method: "POST", body: JSON.stringify({ actions }) }));
    return { status: res.status, body: (await res.json()) as { results: { id: string; ok: boolean; message: string; link?: string; entityId?: string }[] } };
  };

  it("runs in order through the normal routes, resolving refs to the ids just created", async () => {
    mock.handlers["projects"].mockResolvedValue(json(201, { project: { id: "p1", name: "Dự án A" } }));
    mock.handlers["projects/[id]/categories"].mockResolvedValue(json(201, { category: { id: "c1", name: "HM", projectId: "p1" } }));
    mock.handlers["tasks"].mockResolvedValue(json(201, { task: { id: "t1", title: "Việc", projectId: "p1" } }));
    const { status, body } = await apply([
      { id: "a1", tool: "create_project", input: { ref: "p", name: "Dự án A" } },
      { id: "a2", tool: "create_category", input: { ref: "c", projectId: "ref:p", name: "HM" } },
      { id: "a3", tool: "create_task", input: { projectId: "ref:p", categoryId: "ref:c", title: "Việc" } },
    ]);
    expect(status).toBe(200);
    expect(body.results.map((r) => [r.ok, r.message, r.link])).toEqual([
      [true, "Đã tạo dự án “Dự án A”", "/projects/p1"],
      [true, "Đã thêm hạng mục “HM”", "/projects/p1"],
      [true, "Đã thêm công việc “Việc”", "/projects/p1"],
    ]);
    const [req, ctx] = mock.handlers["projects/[id]/categories"].mock.calls[0];
    expect(await ctx.params).toEqual({ id: "p1" });
    expect(await (req as NextRequest).json()).toEqual({ name: "HM" });
    expect(await (mock.handlers["tasks"].mock.calls[0][0] as NextRequest).json()).toEqual({ projectId: "p1", categoryId: "c1", title: "Việc" });
  });

  it("reports the route's own refusal and does not run what depends on a failed item", async () => {
    mock.handlers["projects"].mockResolvedValue(json(403, { error: "Bạn chưa được cấp quyền tạo dự án." }));
    const { body } = await apply([
      { id: "a1", tool: "create_project", input: { ref: "p", name: "Dự án A" } },
      { id: "a2", tool: "add_note", input: { projectId: "ref:p", content: "x" } },
    ]);
    expect(body.results.map((r) => [r.ok, r.message])).toEqual([
      [false, "Bạn chưa được cấp quyền tạo dự án."],
      [false, "Cần mục “p” được tạo trước (đề xuất đó chưa được chọn hoặc bị lỗi)."],
    ]);
    expect(mock.handlers["projects/[id]/notes"]).not.toHaveBeenCalled();
  });

  it("shows field errors and refuses unknown tools and empty requests", async () => {
    mock.handlers["contracts"].mockResolvedValue(json(400, { error: "Dữ liệu không hợp lệ", fields: { performedAt: "Chọn ngày thực hiện" } }));
    const { body } = await apply([{ id: "a1", tool: "create_contract", input: { name: "HĐ", value: 1, performedAt: "2026-11-01" } }]);
    expect(body.results[0]).toMatchObject({ ok: false, message: "Dữ liệu không hợp lệ: Chọn ngày thực hiện" });
    expect((await apply([{ id: "x", tool: "delete_project", input: {} }])).status).toBe(400);
    expect((await apply([])).status).toBe(400);
    mock.auth.mockResolvedValueOnce(null);
    expect((await apply([{ id: "a", tool: "add_note", input: { projectId: "p", content: "x" } }])).status).toBe(401);
  });
});
