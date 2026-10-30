import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ArticleBody } from "@/components/petfarm/wiki/article-body";
import { WikiNav } from "@/components/petfarm/wiki/nav";
import { WikiSearch } from "@/components/petfarm/wiki/search";
import { WIKI_ORIGIN } from "@/lib/petdex-public";
import { ARTICLES } from "@/lib/wiki/articles";
import { wikiBase, wikiHref } from "@/lib/wiki/base";
import { CATEGORIES, getArticle, searchEntries } from "@/lib/wiki";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) return { title: { absolute: "Không tìm thấy · Petfarm Wiki" }, robots: { index: false } };
  const title = `${a.title} · Petfarm Wiki`;
  return {
    metadataBase: new URL(WIKI_ORIGIN),
    title: { absolute: title },
    description: a.summary,
    applicationName: "Petfarm Wiki",
    alternates: { canonical: `/${a.slug}` },
    openGraph: { type: "article", siteName: "Petfarm Wiki", title, description: a.summary, locale: "vi_VN", url: `/${a.slug}`, images: [{ url: "/petfarm/og.jpg", width: 1200, height: 630, alt: "Phố Trân Châu trong game Petfarm" }] },
    twitter: { card: "summary_large_image", title, description: a.summary, images: ["/petfarm/og.jpg"] },
  };
}

/** One wiki article: every article on the left, the article in the middle, its sections on the right. */
export default async function WikiArticlePage({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();
  const base = await wikiBase();
  const category = CATEGORIES.find((c) => c.key === article.category)!;
  const i = ARTICLES.indexOf(article);
  const prev = ARTICLES[i - 1];
  const next = ARTICLES[i + 1];
  const related = (article.related ?? []).map(getArticle).filter((a) => a !== undefined);

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-6 pr-2">
          <WikiNav base={base} current={article.slug} />
        </div>
      </aside>

      <main className="min-w-0">
        <WikiSearch entries={searchEntries(base)} className="mb-6 md:hidden" />
        <nav aria-label="Vị trí" className="text-[15px] font-bold text-[var(--pf-muted)]">
          <a href={wikiHref(base)} className="hover:text-[var(--pf-ink)]">Wiki</a> <span aria-hidden>›</span> {category.title}
        </nav>
        <h1 className="mt-2 flex items-start gap-3 font-[family-name:var(--pf-display)] text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          <span aria-hidden>{article.emoji}</span> {article.title}
        </h1>
        <p className="mt-3 max-w-[65ch] text-lg leading-relaxed text-[var(--pf-muted)]">{article.summary}</p>

        <details className="mt-6 rounded-[18px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] px-4 py-3 xl:hidden">
          <summary className="cursor-pointer font-[family-name:var(--pf-display)] font-bold">Trong bài này</summary>
          <ul className="mt-2 space-y-1">
            {article.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-[var(--pf-accent)] hover:underline">{s.title}</a></li>)}
          </ul>
        </details>

        <div className="mt-10 max-w-[72ch] text-[17px]">
          <ArticleBody sections={article.sections} base={base} />
        </div>

        {related.length > 0 && (
          <section className="mt-14 max-w-[72ch]" aria-labelledby="xem-them">
            <h2 id="xem-them" className="font-[family-name:var(--pf-display)] text-xl font-extrabold">Đọc thêm</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {related.map((a) => (
                <li key={a.slug}>
                  <a href={wikiHref(base, a.slug)} className="inline-flex items-center gap-1.5 rounded-full border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] px-3.5 py-1 font-bold hover:border-[var(--pf-accent)]">
                    <span aria-hidden>{a.emoji}</span> {a.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Bài trước và sau" className="mt-14 grid max-w-[72ch] gap-3 border-t-2 border-[var(--pf-line)] pt-6 sm:grid-cols-2">
          {prev ? (
            <a href={wikiHref(base, prev.slug)} className="rounded-[18px] border-2 border-[var(--pf-line)] p-4 hover:border-[var(--pf-accent)]">
              <span className="flex items-center gap-1 text-sm font-bold text-[var(--pf-muted)]"><ArrowLeft className="h-4 w-4" /> Bài trước</span>
              <span className="font-[family-name:var(--pf-display)] text-lg font-extrabold">{prev.title}</span>
            </a>
          ) : <span />}
          {next && (
            <a href={wikiHref(base, next.slug)} className="rounded-[18px] border-2 border-[var(--pf-line)] p-4 text-right hover:border-[var(--pf-accent)]">
              <span className="flex items-center justify-end gap-1 text-sm font-bold text-[var(--pf-muted)]">Bài sau <ArrowRight className="h-4 w-4" /></span>
              <span className="font-[family-name:var(--pf-display)] text-lg font-extrabold">{next.title}</span>
            </a>
          )}
        </nav>

        <details className="mt-10 rounded-[18px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] px-4 py-3 lg:hidden">
          <summary className="cursor-pointer font-[family-name:var(--pf-display)] font-bold">Tất cả bài trong wiki</summary>
          <div className="mt-4"><WikiNav base={base} current={article.slug} /></div>
        </details>
      </main>

      <aside className="hidden xl:block">
        <div className="sticky top-24">
          <p className="font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.12em] text-[var(--pf-accent)]">Trong bài này</p>
          <ul className="mt-2 space-y-1.5 border-l-2 border-[var(--pf-line)] pl-3 text-[15px]">
            {article.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="font-semibold text-[var(--pf-muted)] hover:text-[var(--pf-ink)]">{s.title}</a></li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}
