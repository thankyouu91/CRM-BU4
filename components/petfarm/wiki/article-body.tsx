import Image from "next/image";
import { Lightbulb, TriangleAlert } from "lucide-react";
import type { WikiBlock, WikiSection } from "@/lib/wiki/types";
import { Inline } from "./inline";
import { PetGallery, PetRow } from "./pet-gallery";

function Block({ block, base }: { block: WikiBlock; base: string }) {
  if ("p" in block) return <p className="leading-relaxed"><Inline text={block.p} base={base} /></p>;
  if ("list" in block)
    return (
      <ul className="list-disc space-y-1.5 pl-6 leading-relaxed marker:text-[var(--pf-accent)]">
        {block.list.map((item) => <li key={item}><Inline text={item} base={base} /></li>)}
      </ul>
    );
  if ("steps" in block)
    return (
      <ol className="space-y-2">
        {block.steps.map((item, i) => (
          <li key={item} className="flex gap-3 leading-relaxed">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--pf-surface-2)] font-[family-name:var(--pf-display)] text-sm font-extrabold text-[var(--pf-accent)]">{i + 1}</span>
            <span><Inline text={item} base={base} /></span>
          </li>
        ))}
      </ol>
    );
  if ("table" in block)
    return (
      <div className="overflow-x-auto rounded-[18px] border-2 border-[var(--pf-line)]">
        <table className="w-full min-w-[28rem] border-collapse text-left text-[15px]">
          <thead className="bg-[var(--pf-surface-2)] font-[family-name:var(--pf-display)]">
            <tr>{block.table.head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-bold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {block.table.rows.map((row, r) => (
              <tr key={r} className="border-t border-[var(--pf-line)] align-top even:bg-[var(--pf-surface)]">
                {row.map((cell, c) => <td key={c} className={c === 0 ? "whitespace-nowrap px-4 py-2.5 font-semibold" : "px-4 py-2.5 tabular-nums"}>{typeof cell === "number" ? cell.toLocaleString("vi-VN") : <Inline text={cell} base={base} />}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  if ("tip" in block || "warn" in block) {
    const tip = "tip" in block;
    const Icon = tip ? Lightbulb : TriangleAlert;
    return (
      <div className={tip ? "flex gap-3 rounded-[18px] border-2 border-[var(--pf-tip-line)] bg-[var(--pf-tip)] p-4" : "flex gap-3 rounded-[18px] border-2 border-[var(--pf-warn-line)] bg-[var(--pf-warn)] p-4"}>
        <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={2.4} aria-hidden />
        <p className="leading-relaxed"><span className="sr-only">{tip ? "Mẹo: " : "Lưu ý: "}</span><Inline text={tip ? block.tip : block.warn} base={base} /></p>
      </div>
    );
  }
  if ("pets" in block) return <PetRow items={block.pets} />;
  if ("petGallery" in block) return <PetGallery />;
  return (
    <Image src={block.img.src} alt={block.img.alt} width={block.img.width} height={block.img.height} unoptimized className="h-auto w-full rounded-[18px] border-2 border-[var(--pf-line)]" />
  );
}

/** An article's sections, each with an anchor for the table of contents. */
export function ArticleBody({ sections, base }: { sections: WikiSection[]; base: string }) {
  return (
    <div className="space-y-12">
      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24 space-y-4">
          <h2 className="font-[family-name:var(--pf-display)] text-2xl font-extrabold leading-tight md:text-[1.75rem]">
            <a href={`#${s.id}`} className="hover:text-[var(--pf-accent)]">{s.title}</a>
          </h2>
          {s.blocks.map((b, i) => <Block key={i} block={b} base={base} />)}
        </section>
      ))}
    </div>
  );
}
