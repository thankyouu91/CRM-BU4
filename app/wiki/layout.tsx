import type { Metadata, Viewport } from "next";
import { ArrowRight } from "lucide-react";
import { WikiSearch } from "@/components/petfarm/wiki/search";
import { cn } from "@/lib/utils";
import { PLAY_DESCRIPTION, SITE_ORIGIN, playUrl } from "@/lib/petdex-public";
import { wikiBase, wikiHref } from "@/lib/wiki/base";
import { searchEntries } from "@/lib/wiki";
import "../petfarm-fonts.css";

// The Petfarm wiki (wiki.petfarm.online, rewritten under /wiki by middleware.ts): the players'
// guide, in the type (Baloo 2, Nunito) and milk-tea colours of the game and of petfarm.online.

/**
 * Defaults for every wiki page. Articles and the home set their own titles; the "not found" page
 * cannot (only the root not-found may export metadata), so it takes these instead of WorkHub's.
 */
export const metadata: Metadata = {
  title: { absolute: "Không tìm thấy trang · Petfarm Wiki" },
  description: "Thư viện hướng dẫn người chơi Petfarm.",
  applicationName: "Petfarm Wiki",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf4ea" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1410" },
  ],
};

export default async function WikiLayout({ children }: { children: React.ReactNode }) {
  const base = await wikiBase();
  return (
    <div
      className={cn(
        "pf-fonts",
        "flex min-h-dvh flex-col bg-[var(--pf-bg)] font-[family-name:var(--pf-body)] text-[var(--pf-ink)] antialiased",
        "[--pf-bg:#fbf4ea] [--pf-glass:rgba(255,250,243,0.9)] [--pf-surface:#fffaf3] [--pf-surface-2:#f4e8d6] [--pf-ink:#3b2a1e] [--pf-muted:#6f5a49] [--pf-line:#ead8c0]",
        "[--pf-accent:#9b6238] [--pf-button:#9b6238] [--pf-button-ink:#fffaf3] [--pf-button-edge:#6e4222] [--pf-ring:#c8915f66]",
        "[--pf-tip:#eef6e4] [--pf-tip-line:#cfe3b8] [--pf-warn:#fdf0dc] [--pf-warn-line:#f0d3a4]",
        "dark:[--pf-bg:#1a1410] dark:[--pf-glass:rgba(36,28,22,0.9)] dark:[--pf-surface:#241c16] dark:[--pf-surface-2:#2e241c] dark:[--pf-ink:#f6eadb] dark:[--pf-muted:#c3ae97] dark:[--pf-line:#3d3027]",
        "dark:[--pf-accent:#e3b48a] dark:[--pf-button:#e0a874] dark:[--pf-button-ink:#2a190d] dark:[--pf-button-edge:#9b6238] dark:[--pf-ring:#e0a87466]",
        "dark:[--pf-tip:#1f2a1a] dark:[--pf-tip-line:#34472a] dark:[--pf-warn:#2e2214] dark:[--pf-warn-line:#55401f]",
      )}
    >
      <a href="#noi-dung" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[14px] focus:bg-[var(--pf-surface)] focus:px-4 focus:py-2">
        Bỏ qua tới nội dung
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--pf-line)] bg-[var(--pf-glass)] backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6" aria-label="Chính">
          <a href={wikiHref(base)} className="flex shrink-0 items-center gap-2 font-[family-name:var(--pf-display)] text-2xl font-extrabold text-[var(--pf-accent)]">
            <span aria-hidden>🧋</span> Petfarm <span className="rounded-full bg-[var(--pf-surface-2)] px-2.5 py-0.5 text-sm font-bold">Wiki</span>
          </a>
          <WikiSearch entries={searchEntries(base)} className="ml-auto hidden w-full max-w-xs md:block" />
          <a href={SITE_ORIGIN} className="ml-auto hidden text-[15px] font-bold text-[var(--pf-muted)] hover:text-[var(--pf-ink)] md:ml-0 lg:block">Trang chủ game</a>
          <a
            href={playUrl()}
            className={cn(
              "ml-auto inline-flex h-10 shrink-0 items-center gap-2 rounded-[14px] bg-[var(--pf-button)] px-4 font-[family-name:var(--pf-display)] text-base font-bold text-[var(--pf-button-ink)] md:ml-0",
              "shadow-[0_4px_0_var(--pf-button-edge)] transition-transform hover:-translate-y-0.5 active:translate-y-[3px] active:shadow-[0_1px_0_var(--pf-button-edge)]",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--pf-ring)]",
            )}
          >
            Vào chơi <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
          </a>
        </nav>
      </header>
      <div id="noi-dung" className="flex-1">{children}</div>
      <footer className="border-t-2 border-[var(--pf-line)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-[var(--pf-muted)] sm:px-6 md:flex-row md:items-center">
          <p className="font-[family-name:var(--pf-display)] text-xl font-extrabold text-[var(--pf-accent)]">
            <span aria-hidden>🧋</span> Petfarm Wiki
          </p>
          <p className="md:ml-4">{PLAY_DESCRIPTION}</p>
          <nav className="flex gap-5 font-bold md:ml-auto" aria-label="Chân trang">
            <a href={wikiHref(base)} className="hover:text-[var(--pf-ink)]">Wiki</a>
            <a href={SITE_ORIGIN} className="hover:text-[var(--pf-ink)]">Giới thiệu</a>
            <a href={playUrl()} className="hover:text-[var(--pf-ink)]">Vào chơi</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
