import { describe, expect, it } from "vitest";
import { openSecret, sealSecret } from "@/lib/secret-box";
import { DEFAULT_AI_MODEL, aiModelInfo, estimateCostUsd, isAiModel, keyHint, looksLikeAnthropicKey } from "@/lib/ai-models";
import { encodeEvent, parseEvents, type AiStreamEvent } from "@/lib/ai-stream";
import { aiSettingsSchema } from "@/lib/validations";

const SECRET = "a-test-secret-that-is-at-least-32-characters-long";
const OTHER = "another-test-secret-at-least-32-characters-long!!";
const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789_-ABCD";

describe("secret box", () => {
  it("round-trips a value", async () => {
    const sealed = await sealSecret(KEY, SECRET);
    expect(sealed.startsWith("v1.")).toBe(true);
    expect(sealed).not.toContain(KEY);
    expect(await openSecret(sealed, SECRET)).toBe(KEY);
  });
  it("uses a fresh IV each time", async () => {
    expect(await sealSecret(KEY, SECRET)).not.toBe(await sealSecret(KEY, SECRET));
  });
  it("cannot be opened with another secret", async () => {
    expect(await openSecret(await sealSecret(KEY, SECRET), OTHER)).toBeNull();
  });
  it("rejects a tampered or malformed value", async () => {
    const [v, iv, ct] = (await sealSecret(KEY, SECRET)).split(".");
    const flipped = ct.slice(0, -2) + (ct.at(-2) === "A" ? "B" : "A") + ct.at(-1);
    expect(await openSecret(`${v}.${iv}.${flipped}`, SECRET)).toBeNull();
    expect(await openSecret(`v2.${iv}.${ct}`, SECRET)).toBeNull();
    expect(await openSecret("not-sealed", SECRET)).toBeNull();
    expect(await openSecret("", SECRET)).toBeNull();
  });
});

describe("AI models and keys", () => {
  it("knows the selectable models", () => {
    expect(isAiModel(DEFAULT_AI_MODEL)).toBe(true);
    expect(isAiModel("claude-sonnet-5-5")).toBe(true);
    expect(isAiModel("gpt-4")).toBe(false);
    expect(isAiModel(undefined)).toBe(false);
    expect(aiModelInfo("unknown").id).toBe(DEFAULT_AI_MODEL);
  });
  it("estimates cost from list prices", () => {
    // Opus 5.5: $4 in, $20 out per million tokens.
    expect(estimateCostUsd("claude-opus-5-5", 1_000_000, 100_000)).toBeCloseTo(6);
    expect(estimateCostUsd("claude-haiku-5-5", 2_000_000, 0)).toBeCloseTo(0.2);
  });
  it("accepts only key-shaped input", () => {
    expect(looksLikeAnthropicKey(KEY)).toBe(true);
    expect(looksLikeAnthropicKey("sk-ant-short")).toBe(false);
    expect(looksLikeAnthropicKey(`${KEY} `)).toBe(false);
    expect(looksLikeAnthropicKey("sk-proj-abcdefghijklmnopqrstuvwxyz")).toBe(false);
  });
  it("shows only the last 4 characters", () => {
    expect(keyHint(KEY)).toBe("sk-ant-…ABCD");
  });
  it("validates the settings patch", () => {
    expect(aiSettingsSchema.parse({ apiKey: `  ${KEY}  ` }).apiKey).toBe(KEY);
    expect(aiSettingsSchema.parse({ apiKey: null }).apiKey).toBeNull();
    expect(aiSettingsSchema.safeParse({ apiKey: "hello" }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ model: "claude-2" }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ dailyLimit: 0 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ dailyLimit: 501 }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ dailyLimit: 2.5 }).success).toBe(false);
    expect(aiSettingsSchema.parse({ enabled: true, dailyLimit: 10, model: "claude-haiku-5-5" })).toEqual({ enabled: true, dailyLimit: 10, model: "claude-haiku-5-5" });
  });
});

describe("AI stream events", () => {
  const events: AiStreamEvent[] = [
    { t: "text", v: "## Tổng quan\nDòng có\nxuống dòng" },
    { t: "done", model: "claude-opus-5-5", inputTokens: 10, outputTokens: 20, truncated: false, remaining: 4 },
  ];
  const wire = events.map(encodeEvent).join("");

  it("parses whole lines and keeps a partial one", () => {
    const cut = wire.length - 5;
    const first = parseEvents(wire.slice(0, cut));
    expect(first.events).toEqual([events[0]]);
    const second = parseEvents(first.rest + wire.slice(cut));
    expect(second.events).toEqual([events[1]]);
    expect(second.rest).toBe("");
  });
  it("survives chunks split anywhere", () => {
    const out: AiStreamEvent[] = [];
    let rest = "";
    for (const ch of wire) {
      const r = parseEvents(rest + ch);
      out.push(...r.events);
      rest = r.rest;
    }
    expect(out).toEqual(events);
  });
  it("skips lines it cannot read", () => {
    expect(parseEvents(`garbage\n{"x":1}\n\n${encodeEvent(events[0])}`).events).toEqual([events[0]]);
  });
});
