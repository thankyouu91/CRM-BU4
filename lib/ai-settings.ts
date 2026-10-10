// Built-in AI settings (admins only): the Claude API key, model, per-person daily
// limit and on/off switch, kept in AppSetting "ai". The key is sealed with
// lib/secret-box.ts and never leaves the server; the UI only sees its hint.

import Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { openSecret, sealSecret } from "./secret-box";
import { resolvePeriod } from "./period";
import { DEFAULT_AI_DAILY_LIMIT, DEFAULT_AI_MODEL, estimateCostUsd, isAiModel, keyHint, type AiModelId } from "./ai-models";

const SETTING_KEY = "ai";

interface StoredKey {
  sealed: string;
  hint: string;
  setAt: string;
  setBy: string;
}

interface StoredAi {
  enabled: boolean;
  model: AiModelId;
  dailyLimit: number;
  apiKey: StoredKey | null;
}

export interface AiSettingsView {
  enabled: boolean;
  model: AiModelId;
  dailyLimit: number;
  /** Never the key itself. `readable` is false when the server secret changed since it was saved. */
  key: { hint: string; setAt: string; setBy: string; readable: boolean } | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** What the generation route needs; null when AI is off or has no usable key. */
export interface AiRuntime {
  apiKey: string;
  model: AiModelId;
  dailyLimit: number;
}

function parseStored(value: unknown): StoredAi {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const k = v.apiKey as Partial<StoredKey> | null | undefined;
  return {
    enabled: v.enabled === true,
    model: isAiModel(v.model) ? v.model : DEFAULT_AI_MODEL,
    dailyLimit: typeof v.dailyLimit === "number" && v.dailyLimit >= 1 ? Math.floor(v.dailyLimit) : DEFAULT_AI_DAILY_LIMIT,
    apiKey: k && typeof k.sealed === "string" ? { sealed: k.sealed, hint: k.hint ?? "sk-ant-…", setAt: k.setAt ?? "", setBy: k.setBy ?? "" } : null,
  };
}

async function readRow() {
  return prisma.appSetting.findUnique({ where: { key: SETTING_KEY }, include: { updatedBy: { select: { name: true } } } });
}

export async function getAiSettings(): Promise<AiSettingsView> {
  const row = await readRow();
  const s = parseStored(row?.value);
  return {
    enabled: s.enabled,
    model: s.model,
    dailyLimit: s.dailyLimit,
    key: s.apiKey ? { hint: s.apiKey.hint, setAt: s.apiKey.setAt, setBy: s.apiKey.setBy, readable: (await openSecret(s.apiKey.sealed)) !== null } : null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedBy: row?.updatedBy?.name ?? null,
  };
}

export async function getAiRuntime(): Promise<AiRuntime | null> {
  const s = parseStored((await readRow())?.value);
  if (!s.enabled || !s.apiKey) return null;
  const apiKey = await openSecret(s.apiKey.sealed);
  return apiKey ? { apiKey, model: s.model, dailyLimit: s.dailyLimit } : null;
}

/** The stored key, decrypted; `present` without `apiKey` means it can no longer be read. */
export async function storedApiKey(): Promise<{ present: boolean; apiKey: string | null; model: AiModelId }> {
  const s = parseStored((await readRow())?.value);
  return { present: !!s.apiKey, apiKey: s.apiKey ? await openSecret(s.apiKey.sealed) : null, model: s.model };
}

export interface AiSettingsPatch {
  /** A new key, or null to remove the stored one; omit to keep it. */
  apiKey?: string | null;
  model?: AiModelId;
  enabled?: boolean;
  dailyLimit?: number;
}

/** Save the settings; returns the new view and what changed (for the audit log, without the key). */
export async function saveAiSettings(actor: { id: string; name: string }, patch: AiSettingsPatch) {
  const current = parseStored((await readRow())?.value);
  const next: StoredAi = {
    enabled: patch.enabled ?? current.enabled,
    model: patch.model ?? current.model,
    dailyLimit: patch.dailyLimit ?? current.dailyLimit,
    apiKey:
      patch.apiKey === undefined
        ? current.apiKey
        : patch.apiKey === null
          ? null
          : { sealed: await sealSecret(patch.apiKey), hint: keyHint(patch.apiKey), setAt: new Date().toISOString(), setBy: actor.name },
  };
  // AI cannot stay on without a key.
  if (!next.apiKey) next.enabled = false;

  const value = next as unknown as Prisma.InputJsonValue;
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value, updatedById: actor.id },
    update: { value, updatedById: actor.id },
  });

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (next.enabled !== current.enabled) changes.enabled = { from: current.enabled, to: next.enabled };
  if (next.model !== current.model) changes.model = { from: current.model, to: next.model };
  if (next.dailyLimit !== current.dailyLimit) changes.dailyLimit = { from: current.dailyLimit, to: next.dailyLimit };
  if (patch.apiKey !== undefined) changes.apiKey = { from: current.apiKey?.hint ?? null, to: next.apiKey?.hint ?? null };
  return { view: await getAiSettings(), changes };
}

export function anthropicClient(apiKey: string) {
  return new Anthropic({ apiKey, maxRetries: 2, timeout: 5 * 60 * 1000 });
}

/** Turn an Anthropic SDK error into a Vietnamese message for the UI. */
export function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "API key không đúng hoặc đã bị thu hồi.";
  if (err instanceof Anthropic.PermissionDeniedError) return "API key không có quyền dùng model này.";
  if (err instanceof Anthropic.NotFoundError) return "Tài khoản Anthropic chưa dùng được model này.";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic đang giới hạn số yêu cầu của tài khoản này. Hãy thử lại sau ít phút.";
  if (err instanceof Anthropic.BadRequestError) return `Anthropic từ chối yêu cầu: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return "Không kết nối được tới Anthropic. Hãy thử lại.";
  if (err instanceof Anthropic.APIError) return `Lỗi từ Anthropic (${err.status ?? "?"}). Hãy thử lại sau.`;
  return "Không gọi được Claude. Hãy thử lại.";
}

/** Check that a key works for a model without spending tokens (reads the model's metadata). */
export async function verifyAnthropicKey(apiKey: string, model: AiModelId): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await anthropicClient(apiKey).models.retrieve(model);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: describeAnthropicError(err) };
  }
}

/** Audit actions that each count as one AI use (a written report or a chat answer). */
const AI_USE_ACTIONS = ["ai.generate", "ai.chat"];

/** AI answers one person has used today (Vietnam time), for the daily limit. */
export async function aiUsedToday(userId: string): Promise<number> {
  const { from } = resolvePeriod("day");
  return prisma.auditLog.count({ where: { action: { in: AI_USE_ACTIONS }, actorId: userId, createdAt: { gte: from } } });
}

export interface AiUsage {
  days: number;
  reports: number;
  people: number;
  inputTokens: number;
  outputTokens: number;
  /** Estimate from list prices; the Anthropic Console bill is authoritative. */
  costUsd: number;
}

/** Use over the last `days` days, from the audit log entries the generation route writes. */
export async function aiUsage(days = 30): Promise<AiUsage> {
  const rows = await prisma.auditLog.findMany({
    where: { action: { in: AI_USE_ACTIONS }, createdAt: { gte: new Date(Date.now() - days * 86_400_000) } },
    select: { actorId: true, details: true },
  });
  const usage: AiUsage = { days, reports: rows.length, people: new Set(rows.map((r) => r.actorId)).size, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  for (const r of rows) {
    const d = (r.details ?? {}) as { model?: string; inputTokens?: number; outputTokens?: number };
    const input = Number(d.inputTokens) || 0;
    const output = Number(d.outputTokens) || 0;
    usage.inputTokens += input;
    usage.outputTokens += output;
    usage.costUsd += estimateCostUsd(d.model ?? DEFAULT_AI_MODEL, input, output);
  }
  return usage;
}
