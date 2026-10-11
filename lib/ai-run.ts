// Run one Claude request and stream its answer to the browser as NDJSON
// (lib/ai-stream.ts). Shared by the report route (app/api/ai/report) and the
// chat route (app/api/ai/chat): streaming, stop handling, refusals, errors, and
// one audit row per generation (its token counts feed the daily limit and usage).

import type Anthropic from "@anthropic-ai/sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isWorkers } from "./prisma";
import { audit } from "./audit";
import { anthropicClient, describeAnthropicError, type AiRuntime } from "./ai-settings";
import { encodeEvent, type AiStreamEvent } from "./ai-stream";
import type { AuditAction } from "./audit-actions";

// Server-side fallback on a policy decline: available for Opus 5.5 and Sonnet 5.5 on the Claude API, not for Haiku 5.5.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

/**
 * On Workers, a request's work stops when the browser disconnects (the person pressed
 * "Dừng"); waitUntil lets the generation finish recording itself first. No-op in Node.
 */
function keepAlive(work: Promise<unknown>) {
  if (isWorkers) (getCloudflareContext().ctx as { waitUntil(p: Promise<unknown>): void }).waitUntil(work);
}

export interface ClaudeStreamRequest {
  actor: { id: string; name: string };
  runtime: AiRuntime;
  /** Generations this person already used today (for the "remaining" count). */
  used: number;
  system: string | Anthropic.Beta.BetaTextBlockParam[];
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: "low" | "medium" | "high";
  /** Also cache the conversation so far (multi-turn chat). */
  cacheConversation?: boolean;
  record: { action: Extract<AuditAction, "ai.generate" | "ai.chat">; entityType: string; entityId: string | null; summary: string; details: Record<string, unknown> };
  refusedMessage: string;
}

export function streamClaudeAnswer(r: ClaudeStreamRequest): Response {
  const stream = anthropicClient(r.runtime.apiKey).beta.messages.stream({
    model: r.runtime.model,
    max_tokens: 16000,
    output_config: { effort: r.effort },
    system: r.system,
    messages: r.messages,
    metadata: { user_id: r.actor.id },
    ...(r.cacheConversation ? { cache_control: { type: "ephemeral" as const } } : {}),
    ...(FALLBACK_MODELS.has(r.runtime.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  let cancelled = false;
  let recorded = false;
  const usage = { model: r.runtime.model as string, inputTokens: 0, outputTokens: 0 };
  // One audit row per generation, also when it is stopped part way (tokens were
  // still spent), so the daily limit and the usage figures count it.
  const record = async (stopReason: string | null) => {
    if (recorded) return;
    recorded = true;
    await audit(r.actor, {
      action: r.record.action,
      entityType: r.record.entityType,
      entityId: r.record.entityId,
      summary: r.record.summary,
      details: { ...r.record.details, ...usage, stopReason },
    });
  };

  const enc = new TextEncoder();
  const run = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    const send = (e: AiStreamEvent) => {
      if (cancelled) return;
      try {
        controller.enqueue(enc.encode(encodeEvent(e)));
      } catch {
        // The browser went away without the stream being cancelled: stop Claude too.
        cancelled = true;
        stream.abort();
      }
    };
    try {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") send({ t: "text", v: event.delta.text });
        else if (event.type === "message_start") {
          const u = event.message.usage;
          usage.model = event.message.model;
          usage.inputTokens = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
        } else if (event.type === "message_delta") usage.outputTokens = event.usage.output_tokens;
      }
      const final = await stream.finalMessage();
      usage.model = final.model;
      usage.inputTokens = final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0);
      usage.outputTokens = final.usage.output_tokens;
      await record(final.stop_reason);
      if (final.stop_reason === "refusal") {
        send({ t: "refused", message: r.refusedMessage });
      } else {
        send({ t: "done", ...usage, truncated: final.stop_reason === "max_tokens", remaining: Math.max(0, r.runtime.dailyLimit - r.used - 1) });
      }
    } catch (err) {
      if (cancelled) {
        await record("aborted").catch((e) => console.error("[ai] audit failed", e));
      } else {
        console.error("[ai] generation failed", err);
        // Counted only when Claude had started answering.
        if (usage.inputTokens) await record("error").catch((e) => console.error("[ai] audit failed", e));
        send({ t: "error", message: describeAnthropicError(err) });
      }
    } finally {
      if (!cancelled) controller.close();
    }
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const work = run(controller);
      keepAlive(work);
      return work;
    },
    cancel() {
      cancelled = true;
      stream.abort();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
