import { cn } from "@/lib/utils";
import { wikiHref } from "@/lib/wiki/base";
import { CATEGORIES, articlesIn } from "@/lib/wiki";

/** Every article, by category; the current one is marked. */
export function WikiNav({ base, current }: { base: string; current?: string }) {
  return (
    <nav aria-label="Các bài trong wiki" className="space-y-6">
      {CATEGORIES.map((c) => (
        <div key={c.key}>
          <p className="mb-1.5 font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.12em] text-[var(--pf-accent)]">
            <span aria-hidden>{c.emoji}</span> {c.title}
          </p>
          <ul className="space-y-0.5">
            {articlesIn(c.key).map((a) => (
              <li key={a.slug}>
                <a
                  href={wikiHref(base, a.slug)}
                  aria-current={a.slug === current ? "page" : undefined}
                  className={cn(
                    "block rounded-[10px] px-3 py-1.5 text-[15px] font-semibold text-[var(--pf-muted)] hover:bg-[var(--pf-surface-2)] hover:text-[var(--pf-ink)]",
                    a.slug === current && "bg-[var(--pf-surface-2)] font-extrabold text-[var(--pf-ink)]",
                  )}
                >
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
