"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { fold } from "@/lib/wiki/fold";

export interface SearchEntry {
  href: string;
  title: string;
  emoji: string;
  summary: string;
  /** Every word of the article, folded (lib/wiki/fold.ts). */
  text: string;
}

/** Finds articles by title first, then by any word in them. Enter opens the first result. */
export function WikiSearch({ entries, large, className }: { entries: SearchEntry[]; large?: boolean; className?: string }) {
  const [q, setQ] = useState("");
  const listId = useId();
  const results = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return entries
      .map((e) => ({ e, title: words.every((w) => fold(e.title).includes(w)), body: words.every((w) => e.text.includes(w)) }))
      .filter((r) => r.title || r.body)
      .sort((a, b) => Number(b.title) - Number(a.title))
      .slice(0, 8)
      .map((r) => r.e);
  }, [q, entries]);
  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(ev) => {
        ev.preventDefault();
        if (results[0]) location.href = results[0].href;
      }}
    >
      <label className="sr-only" htmlFor={`${listId}-q`}>Tìm trong wiki</label>
      <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--pf-muted)]", large ? "left-5 h-6 w-6" : "left-3.5 h-4 w-4")} aria-hidden />
      <input
        id={`${listId}-q`}
        type="search"
        value={q}
        onChange={(ev) => setQ(ev.target.value)}
        placeholder={large ? "Tìm: cho ăn, lên bậc, trứng, vay xu…" : "Tìm trong wiki"}
        autoComplete="off"
        aria-controls={listId}
        className={cn(
          "w-full rounded-[14px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-ink)] placeholder:text-[var(--pf-muted)]",
          "focus:border-[var(--pf-accent)] focus:outline-none focus:ring-4 focus:ring-[var(--pf-ring)]",
          large ? "h-16 pl-14 pr-5 text-lg" : "h-10 pl-10 pr-3 text-[15px]",
        )}
      />
      {q.trim() && (
        <ul id={listId} className="absolute inset-x-0 top-full z-50 mt-2 max-h-[60vh] overflow-auto rounded-[18px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] p-2 shadow-[0_8px_24px_rgba(59,42,30,0.18)]">
          {results.length ? (
            results.map((r) => (
              <li key={r.href}>
                <a href={r.href} className="flex gap-3 rounded-[12px] px-3 py-2.5 hover:bg-[var(--pf-surface-2)] focus:bg-[var(--pf-surface-2)] focus:outline-none">
                  <span aria-hidden className="text-xl">{r.emoji}</span>
                  <span>
                    <span className="block font-[family-name:var(--pf-display)] font-bold">{r.title}</span>
                    <span className="line-clamp-2 text-sm text-[var(--pf-muted)]">{r.summary}</span>
                  </span>
                </a>
              </li>
            ))
          ) : (
            <li className="px-3 py-2.5 text-[var(--pf-muted)]">Chưa có bài nào khớp. Thử từ khác nhé.</li>
          )}
        </ul>
      )}
    </form>
  );
}
