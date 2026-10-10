import { describe, expect, it } from "vitest";
import {
  CHAT_AUDIENCES,
  CHAT_LENGTHS,
  CHAT_MAX_CHARS,
  CHAT_MAX_MESSAGES,
  CHAT_TEMPLATES,
  CHAT_TEMPLATE_GROUPS,
  chatHistoryForApi,
  chatStyleInstruction,
  chatTemplatesFor,
} from "@/lib/ai-chat";
import { aiChatSchema } from "@/lib/validations";

const options = { includeData: true, projectId: null, period: "month", length: "balanced", audience: "general" } as const;

describe("chat request validation", () => {
  it("accepts a first question and a follow-up", () => {
    expect(aiChatSchema.safeParse({ messages: [{ role: "user", content: "Tóm tắt" }], options }).success).toBe(true);
    const turns = [
      { role: "user", content: "Tóm tắt" },
      { role: "assistant", content: "…" },
      { role: "user", content: "Chi tiết hơn" },
    ];
    expect(aiChatSchema.safeParse({ messages: turns, options }).success).toBe(true);
  });

  it("rejects a conversation that does not start and end with the user", () => {
    expect(aiChatSchema.safeParse({ messages: [{ role: "assistant", content: "x" }, { role: "user", content: "y" }], options }).success).toBe(false);
    expect(aiChatSchema.safeParse({ messages: [{ role: "user", content: "x" }, { role: "assistant", content: "y" }], options }).success).toBe(false);
  });

  it("rejects two turns in a row from the same side", () => {
    const m = [
      { role: "user", content: "a" },
      { role: "user", content: "b" },
    ];
    expect(aiChatSchema.safeParse({ messages: m, options }).success).toBe(false);
  });

  it("enforces the size limits", () => {
    expect(aiChatSchema.safeParse({ messages: [], options }).success).toBe(false);
    expect(aiChatSchema.safeParse({ messages: [{ role: "user", content: "   " }], options }).success).toBe(false);
    expect(aiChatSchema.safeParse({ messages: [{ role: "user", content: "x".repeat(CHAT_MAX_CHARS + 1) }], options }).success).toBe(false);
    const tooMany = Array.from({ length: CHAT_MAX_MESSAGES + 1 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x" }));
    expect(aiChatSchema.safeParse({ messages: tooMany, options }).success).toBe(false);
  });

  it("only accepts known answer styles", () => {
    const m = [{ role: "user", content: "x" }];
    expect(aiChatSchema.safeParse({ messages: m, options: { ...options, length: "huge" } }).success).toBe(false);
    expect(aiChatSchema.safeParse({ messages: m, options: { ...options, audience: "everyone" } }).success).toBe(false);
  });
});

describe("chat history sent to the server", () => {
  it("keeps completed pairs and drops a question whose answer failed", () => {
    const h = chatHistoryForApi([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1", status: "done" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "Không gọi được trợ lý AI", status: "error" },
      { role: "user", content: "q3" },
      { role: "assistant", content: "", status: "stopped" },
      { role: "user", content: "q4" },
      { role: "assistant", content: "a4 (stopped part way)", status: "stopped" },
    ]);
    expect(h).toEqual([
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q4" },
      { role: "assistant", content: "a4 (stopped part way)" },
    ]);
  });

  it("always leaves room for the new question, in whole pairs", () => {
    const long = Array.from({ length: 60 }, (_, i) => ({ role: (i % 2 ? "assistant" : "user") as "user" | "assistant", content: `m${i}`, status: "done" }));
    const h = chatHistoryForApi(long);
    expect(h.length).toBe(CHAT_MAX_MESSAGES - 2);
    expect(h[0].role).toBe("user");
    expect(h[h.length - 1]).toEqual({ role: "assistant", content: "m59" });
    // With the new question appended the request is still valid.
    const req = { messages: [...h, { role: "user", content: "new" }], options };
    expect(aiChatSchema.safeParse(req).success).toBe(true);
  });

  it("trims very long turns to the accepted size", () => {
    const h = chatHistoryForApi([
      { role: "user", content: "x".repeat(CHAT_MAX_CHARS + 50) },
      { role: "assistant", content: "y".repeat(CHAT_MAX_CHARS + 50) },
    ]);
    expect(h.every((m) => m.content.length === CHAT_MAX_CHARS)).toBe(true);
  });
});

describe("chat templates and style", () => {
  it("hides finance templates from people without the finance permission", () => {
    expect(chatTemplatesFor(false).some((t) => t.finance)).toBe(false);
    expect(chatTemplatesFor(true)).toHaveLength(CHAT_TEMPLATES.length);
  });

  it("has unique ids, known groups and non-empty prompts", () => {
    expect(new Set(CHAT_TEMPLATES.map((t) => t.id)).size).toBe(CHAT_TEMPLATES.length);
    for (const t of CHAT_TEMPLATES) {
      expect(Object.keys(CHAT_TEMPLATE_GROUPS)).toContain(t.group);
      expect(t.prompt.length).toBeGreaterThan(20);
      expect(t.prompt.length).toBeLessThanOrEqual(CHAT_MAX_CHARS);
      if (t.length) expect(Object.keys(CHAT_LENGTHS)).toContain(t.length);
      if (t.audience) expect(Object.keys(CHAT_AUDIENCES)).toContain(t.audience);
    }
  });

  it("the slide template asks for the outline format the deck parser reads", () => {
    expect(CHAT_TEMPLATES.find((t) => t.id === "slides")?.prompt).toContain("## Slide 1:");
  });

  it("the client-facing style keeps internal money out", () => {
    expect(chatStyleInstruction({ length: "short", audience: "client" })).toContain(CHAT_AUDIENCES.client.instruction);
    expect(CHAT_AUDIENCES.client.instruction).toMatch(/không nêu chi phí/);
    expect(chatStyleInstruction({ length: "detailed", audience: "general" })).toContain(CHAT_LENGTHS.detailed.instruction);
  });
});
