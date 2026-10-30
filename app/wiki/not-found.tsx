import { wikiBase, wikiHref } from "@/lib/wiki/base";

/** An address on the wiki that is not an article. */
export default async function WikiNotFound() {
  const base = await wikiBase();
  return (
    <main className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p aria-hidden className="text-6xl">🐾</p>
      <h1 className="mt-4 font-[family-name:var(--pf-display)] text-4xl font-extrabold">Bé chưa tìm thấy trang này</h1>
      <p className="mt-3 text-lg text-[var(--pf-muted)]">Có thể bài đã đổi tên. Quay về trang đầu wiki để tìm lại nhé.</p>
      <a href={wikiHref(base)} className="mt-8 inline-flex h-12 items-center rounded-[14px] bg-[var(--pf-button)] px-6 font-[family-name:var(--pf-display)] text-lg font-bold text-[var(--pf-button-ink)] shadow-[0_4px_0_var(--pf-button-edge)]">
        Về trang đầu wiki
      </a>
    </main>
  );
}
