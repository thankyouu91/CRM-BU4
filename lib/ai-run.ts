// Run one Claude answer and stream it to the browser as NDJSON (lib/ai-stream.ts).
// Shared by the report route (app/api/ai/report) and the chat route
// (app/api/ai/chat): streaming, tool steps, stop handling, refusals, errors, and
// one audit row per answer (its token counts feed the daily limit and usage).

import type Anthropic from "@anthropic-ai/sdk";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { isWorkers } from "./prisma";
import { audit } from "./audit";
import { anthropicClient, describeAnthropicError, type AiRuntime } from "./ai-settings";
import { encodeEvent, type AiStreamEvent } from "./ai-stream";
import type { AuditAction } from "./audit-actions";
import type { AgentAction } from "./ai-actions";

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
  /** Shown to the person before the answer (e.g. a file sent only in part). */
  notices?: string[];
  /**
   * Tools for a multi-step answer (lib/ai-agent.ts): each tool call is run and its
   * result sent back until Claude finishes. Proposed changes go to the browser as
   * "action" events; nothing here writes data.
   */
  tools?: {
    definitions: Anthropic.Beta.BetaTool[];
    run: (call: { id: string; name: string; input: unknown }) => Promise<{ content: string; isError?: boolean; action?: AgentAction }>;
  };
}

/** Claude requests per answer when it uses tools (each step is one request). */
const MAX_TOOL_STEPS = 8;

export function streamClaudeAnswer(r: ClaudeStreamRequest): Response {
  const client = anthropicClient(r.runtime.apiKey);
  const open = (messages: Anthropic.Beta.BetaMessageParam[]) =>
    client.beta.messages.stream({
      model: r.runtime.model,
      max_tokens: 16000,
      output_config: { effort: r.effort },
      system: r.system,
      messages,
      metadata: { user_id: r.actor.id },
      ...(r.tools ? { tools: r.tools.definitions } : {}),
      ...(r.cacheConversation || r.tools ? { cache_control: { type: "ephemeral" as const } } : {}),
      ...(FALLBACK_MODELS.has(r.runtime.model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });
  let stream = open(r.messages);

  let cancelled = false;
  let recorded = false;
  let model = r.runtime.model as string;
  // Finished steps, plus the one streaming now (known only from its events until it ends).
  const totals = { input: 0, output: 0 };
  const step = { input: 0, output: 0 };
  let steps = 0;
  let actions = 0;
  const usage = () => ({ model, inputTokens: totals.input + step.input, outputTokens: totals.output + step.output });
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
      details: { ...r.record.details, ...usage(), stopReason, ...(r.tools ? { steps, actions } : {}) },
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
      for (const message of r.notices ?? []) send({ t: "notice", message });
      let messages = r.messages;
      let tail = "";
      for (;;) {
        steps++;
        let firstText = true;
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            // Text from a later step starts a new paragraph.
            if (firstText && tail && !tail.endsWith("\n\n")) send({ t: "text", v: tail.endsWith("\n") ? "\n" : "\n\n" });
            firstText = false;
            send({ t: "text", v: event.delta.text });
            tail = (tail + event.delta.text).slice(-2);
          } else if (event.type === "message_start") {
            const u = event.message.usage;
            model = event.message.model;
            step.input = u.input_tokens + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
          } else if (event.type === "message_delta") step.output = event.usage.output_tokens;
        }
        const final = await stream.finalMessage();
        model = final.model;
        totals.input += final.usage.input_tokens + (final.usage.cache_creation_input_tokens ?? 0) + (final.usage.cache_read_input_tokens ?? 0);
        totals.output += final.usage.output_tokens;
        step.input = 0;
        step.output = 0;

        const calls = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        const more = r.tools && final.stop_reason === "tool_use" && calls.length > 0;
        if (more && steps >= MAX_TOOL_STEPS) {
          send({ t: "text", v: `${tail ? "\n\n" : ""}_Trợ lý đã dừng sau ${MAX_TOOL_STEPS} bước tra cứu. Hãy hỏi tiếp để hoàn tất._` });
        }
        if (!more || steps >= MAX_TOOL_STEPS) {
          await record(final.stop_reason);
          if (final.stop_reason === "refusal") {
            send({ t: "refused", message: r.refusedMessage });
          } else {
            send({ t: "done", ...usage(), truncated: final.stop_reason === "max_tokens", remaining: Math.max(0, r.runtime.dailyLimit - r.used - 1) });
          }
          break;
        }

        const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
        for (const call of calls) {
          const out = await r.tools!.run(call);
          if (out.action) {
            actions++;
            send({ t: "action", action: out.action });
          }
          results.push({ type: "tool_result", tool_use_id: call.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
        }
        if (cancelled) throw new Error("cancelled");
        messages = [...messages, { role: "assistant", content: final.content }, { role: "user", content: results }];
        stream = open(messages);
      }
    } catch (err) {
      if (cancelled) {
        await record("aborted").catch((e) => console.error("[ai] audit failed", e));
      } else {
        console.error("[ai] generation failed", err);
        // Counted only when Claude had started answering.
        if (usage().inputTokens) await record("error").catch((e) => console.error("[ai] audit failed", e));
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
