"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, ExternalLink, ListChecks, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentAction, AgentActionResult } from "@/lib/ai-actions";
import { cn } from "@/lib/utils";

/** Proposals that use "ref:<name>" of another proposal depend on it. */
function dependencies(actions: AgentAction[]) {
  const byRef = new Map(actions.filter((a) => a.ref).map((a) => [a.ref!, a.id]));
  const needs = new Map<string, string[]>();
  for (const a of actions) {
    const used = [...JSON.stringify(a.input).matchAll(/"ref:([A-Za-z0-9_-]{1,40})"/g)].map((m) => byRef.get(m[1])).filter((x): x is string => !!x && x !== a.id);
    needs.set(a.id, used);
  }
  return needs;
}

/**
 * Changes the AI proposed in one answer. Nothing is written until "Áp dụng": then the
 * chosen ones run in order through the normal API with the person's permissions.
 */
export function ActionsCard({
  actions,
  results,
  dismissed,
  pending,
  applying,
  progress,
  onApply,
  onDismiss,
}: {
  actions: AgentAction[];
  results?: AgentActionResult[];
  dismissed?: boolean;
  /** Claude is still answering: more proposals may come. */
  pending: boolean;
  applying: boolean;
  /** Large sets are applied in batches. */
  progress?: { done: number; total: number } | null;
  onApply: (ids: string[]) => void;
  onDismiss: () => void;
}) {
  const needs = useMemo(() => dependencies(actions), [actions]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const byId = useMemo(() => new Map((results ?? []).map((r) => [r.id, r])), [results]);
  const done = !!results;
  const chosen = actions.filter((a) => !off.has(a.id));

  // Unticking an item also unticks what needs it; ticking it ticks what it needs.
  const toggle = (id: string) =>
    setOff((prev) => {
      const next = new Set(prev);
      const walk = (start: string, turnOff: boolean) => {
        const stack = [start];
        while (stack.length) {
          const cur = stack.pop()!;
          if (turnOff) {
            if (next.has(cur) && cur !== start) continue;
            next.add(cur);
            for (const [other, deps] of needs) if (deps.includes(cur) && !next.has(other)) stack.push(other);
          } else {
            next.delete(cur);
            for (const dep of needs.get(cur) ?? []) if (next.has(dep)) stack.push(dep);
          }
        }
      };
      walk(id, !prev.has(id));
      return next;
    });

  const okCount = (results ?? []).filter((r) => r.ok).length;

  return (
    <section className="mt-3 overflow-hidden rounded-xl border border-primary/30 bg-primary/[0.03]" aria-label="Đề xuất thay đổi">
      <header className="flex flex-wrap items-center gap-2 border-b border-primary/20 px-3 py-2">
        <ListChecks className="h-4 w-4 text-primary" />
        <p className="text-sm font-medium">Đề xuất thay đổi ({actions.length})</p>
        <p className="ml-auto text-xs text-muted-foreground">
          {done ? `Đã áp dụng ${okCount}/${results!.length}` : dismissed ? "Đã bỏ qua, dữ liệu chưa thay đổi" : "Chưa có gì thay đổi cho đến khi bạn bấm Áp dụng"}
        </p>
      </header>
      <ol className="divide-y">
        {actions.map((a, i) => {
          const r = byId.get(a.id);
          return (
            <li key={a.id} className={cn("flex gap-2.5 px-3 py-2.5 text-sm", !done && off.has(a.id) && "opacity-50")}>
              {done ? (
                r ? (
                  r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Đã áp dụng" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-label="Lỗi" />
                ) : (
                  <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full border" aria-label="Không áp dụng" />
                )
              ) : (
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]"
                  checked={!off.has(a.id)}
                  disabled={dismissed || applying}
                  onChange={() => toggle(a.id)}
                  aria-label={`Chọn đề xuất ${i + 1}: ${a.title} ${a.target}`}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words">
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{a.title}</span>
                  <span className="font-medium">{a.target}</span>
                </p>
                {a.lines.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {a.lines.map((line, k) => (
                      <li key={k} className="break-words">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
                {r && (
                  <p className={cn("mt-1 flex flex-wrap items-center gap-x-2 text-xs", r.ok ? "text-success" : "text-danger")}>
                    {r.message}
                    {r.ok && r.link && (
                      <Link href={r.link} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
                        Mở <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {!done && !dismissed && (
        <footer className="flex flex-wrap items-center gap-2 border-t border-primary/20 px-3 py-2">
          {pending ? (
            <p className="text-xs text-muted-foreground">Claude đang chuẩn bị thêm…</p>
          ) : applying && progress && progress.total > progress.done ? (
            <p role="status" className="text-xs text-muted-foreground">
              Đang áp dụng… {progress.done}/{progress.total}
            </p>
          ) : (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <CircleAlert className="h-3.5 w-3.5" /> Kiểm tra từng mục; thay đổi chạy theo quyền của bạn và được ghi vào nhật ký.
            </p>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={onDismiss} disabled={pending || applying}>
              Bỏ qua
            </Button>
            <Button size="sm" onClick={() => onApply(chosen.map((a) => a.id))} disabled={pending || !chosen.length} loading={applying}>
              Áp dụng {chosen.length === actions.length ? `tất cả (${chosen.length})` : `${chosen.length} mục`}
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}
