// Claude models the admin can choose for the built-in AI (no server-only imports).
// Prices are Anthropic's list prices in USD per million tokens, used only to
// estimate spend in Settings; the Anthropic Console bill is the source of truth.

export const AI_MODELS = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    note: "Mặc định · chất lượng cao nhất",
    inputPerMTok: 4,
    outputPerMTok: 20,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    note: "Nhanh, chi phí bằng một nửa",
    inputPerMTok: 2,
    outputPerMTok: 10,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    note: "Rẻ nhất, phù hợp báo cáo ngắn",
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
  },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export const DEFAULT_AI_MODEL: AiModelId = "claude-opus-5-5";
export const DEFAULT_AI_DAILY_LIMIT = 30;
export const MAX_AI_DAILY_LIMIT = 500;

export function isAiModel(id: unknown): id is AiModelId {
  return AI_MODELS.some((m) => m.id === id);
}

export function aiModelInfo(id: string) {
  return AI_MODELS.find((m) => m.id === id) ?? AI_MODELS[0];
}

/** Estimated USD cost of a token count on a model. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const m = aiModelInfo(model);
  return (inputTokens * m.inputPerMTok + outputTokens * m.outputPerMTok) / 1_000_000;
}

/** Anthropic API keys look like "sk-ant-api03-…": printable, no spaces, long. */
export function looksLikeAnthropicKey(key: string): boolean {
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key);
}

/** What the UI may show of a key: its prefix and last 4 characters. */
export function keyHint(key: string): string {
  return `sk-ant-…${key.slice(-4)}`;
}
