import type { Metadata } from "next";
import { WikiSearch } from "@/components/petfarm/wiki/search";
import { WIKI_ORIGIN } from "@/lib/petdex-public";
import { wikiBase, wikiHref } from "@/lib/wiki/base";
import { CATEGORIES, articlesIn, getArticle, searchEntries } from "@/lib/wiki";

const TITLE = "Petfarm Wiki · Hướng dẫn chơi Pet Town";
const DESCRIPTION = "Thư viện hướng dẫn người chơi Petfarm: nuôi bé, ngũ hành, việc làm, mini-game, Sàn, ngân hàng, quầy trà sữa, Hội và mọi luật chơi kèm con số.";

export const metadata: Metadata = {
  metadataBase: new URL(WIKI_ORIGIN),
  title: { absolute: TITLE },
  description: DESCRIPTION,
  applicationName: "Petfarm Wiki",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Petfarm Wiki", title: TITLE, description: DESCRIPTION, locale: "vi_VN", url: "/", images: [{ url: "/petfarm/og.jpg", width: 1200, height: 630, alt: "Phố Trân Châu trong game Petfarm" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/petfarm/og.jpg"] },
  robots: { index: true, follow: true },
};

/** The first articles a new player should read, in order. */
const FIRST_STEPS = ["bat-dau", "cham-soc", "moi-ngay", "viec-lam", "cap-do"];

export default async function WikiHome() {
  const base = await wikiBase();
  return (
    <main>
      <section className="border-b-2 border-[var(--pf-line)] bg-[var(--pf-surface)]">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 md:py-20">
          <p className="font-[family-name:var(--pf-display)] text-sm font-bold uppercase tracking-[0.14em] text-[var(--pf-accent)]">Thư viện hướng dẫn người chơi</p>
          <h1 className="mt-2 font-[family-name:var(--pf-display)] text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">Sổ tay Phố Trân Châu</h1>
          <p className="mx-auto mt-4 max-w-[52ch] text-lg leading-relaxed text-[var(--pf-muted)]">
            Mọi luật chơi của Petfarm kèm con số thật: chăm bé, đi làm, buôn bán, gửi tiết kiệm và kết bạn.
          </p>
          <WikiSearch entries={searchEntries(base)} large className="mx-auto mt-8 max-w-2xl text-left" />
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="text-[15px] font-bold text-[var(--pf-muted)]">Người mới đọc trước:</span>
            {FIRST_STEPS.map((slug, i) => {
              const a = getArticle(slug);
              return a ? (
                <a key={slug} href={wikiHref(base, slug)} className="rounded-full border-2 border-[var(--pf-line)] bg-[var(--pf-bg)] px-3.5 py-1 text-[15px] font-bold hover:border-[var(--pf-accent)]">
                  {i + 1}. {a.title}
                </a>
              ) : null;
            })}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-16 sm:px-6 md:py-20">
        {CATEGORIES.map((c) => (
          <section key={c.key} aria-labelledby={`nhom-${c.key}`}>
            <h2 id={`nhom-${c.key}`} className="font-[family-name:var(--pf-display)] text-3xl font-extrabold tracking-tight">
              <span aria-hidden>{c.emoji}</span> {c.title}
            </h2>
            <p className="mt-1 text-[var(--pf-muted)]">{c.blurb}</p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articlesIn(c.key).map((a) => (
                <li key={a.slug}>
                  <a
                    href={wikiHref(base, a.slug)}
                    className="flex h-full gap-4 rounded-[24px] border-2 border-[var(--pf-line)] bg-[var(--pf-surface)] p-5 shadow-[0_4px_0_var(--pf-line)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pf-ring)]"
                  >
                    <span aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--pf-surface-2)] text-2xl">{a.emoji}</span>
                    <span>
                      <span className="block font-[family-name:var(--pf-display)] text-xl font-extrabold leading-tight">{a.title}</span>
                      <span className="mt-1 block text-[15px] leading-snug text-[var(--pf-muted)]">{a.summary}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
