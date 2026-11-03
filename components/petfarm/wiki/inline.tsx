import { Fragment } from "react";
import { wikiHref } from "@/lib/wiki/base";

/** Renders a line of wiki text: **bold** and [text](slug) links to other articles. */
export function Inline({ text, base }: { text: string; base: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([a-z0-9-]*\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^\*\*([^*]+)\*\*$/.exec(part);
        if (bold) return <strong key={i} className="font-extrabold text-[var(--pf-ink)]">{bold[1]}</strong>;
        const link = /^\[([^\]]+)\]\(([a-z0-9-]*)\)$/.exec(part);
        if (link) return <a key={i} href={wikiHref(base, link[2])} className="font-bold text-[var(--pf-accent)] underline decoration-2 underline-offset-2 hover:decoration-[3px]">{link[1]}</a>;
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}
