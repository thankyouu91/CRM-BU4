import type { SearchEntry } from "@/components/petfarm/wiki/search";
import { fold } from "./fold";
import { ARTICLES } from "./articles";
import { wikiHref } from "./base";
import type { WikiArticle, WikiBlock, WikiCategory } from "./types";
import { SPECIES, MASCOTS } from "@/public/ta-tua/game/js/shared/pets.js";

/** The gallery is drawn in the browser; its species names still count for search. */
const GALLERY_WORDS = [...(MASCOTS as { name: string }[]), ...(SPECIES as { name: string }[])].map((s) => s.name);

export const CATEGORIES: { key: WikiCategory; title: string; emoji: string; blurb: string }[] = [
  { key: "bat-dau", title: "Bắt đầu", emoji: "🌱", blurb: "Tạo tài khoản, nhận nuôi bé đầu tiên và những việc nên làm mỗi ngày." },
  { key: "nuoi-be", title: "Nuôi bé", emoji: "🐾", blurb: "Chỉ số, ngũ hành, tính cách, tuổi và trang phục của bé." },
  { key: "kiem-xu", title: "Kiếm xu", emoji: "💼", blurb: "Đi làm, đi học, mini-game, vườn và bếp." },
  { key: "kinh-te", title: "Làm ăn", emoji: "📈", blurb: "Sàn, ngân hàng, quầy trà sữa, Chợ Phiên, xưởng và thuế." },
  { key: "cong-dong", title: "Cộng đồng", emoji: "🤝", blurb: "Bạn bè, Hội và công viên." },
];

export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug);
export const articlesIn = (category: WikiCategory) => ARTICLES.filter((a) => a.category === category);

const blockText = (b: WikiBlock): string[] => {
  if ("p" in b) return [b.p];
  if ("list" in b) return b.list;
  if ("steps" in b) return b.steps;
  if ("table" in b) return [...b.table.head, ...b.table.rows.flat().map(String)];
  if ("tip" in b) return [b.tip];
  if ("warn" in b) return [b.warn];
  if ("img" in b) return [b.img.alt];
  if ("pets" in b) return b.pets.map((x) => `${x.label} ${x.sub ?? ""}`);
  return GALLERY_WORDS;
};

const articleText = (a: WikiArticle) =>
  fold([a.title, a.summary, ...(a.keywords ?? []), ...a.sections.flatMap((s) => [s.title, ...s.blocks.flatMap(blockText)])].join(" ").replace(/\*\*|\[|\]\([a-z0-9-]*\)/g, ""));

/** What the search box looks through, with each article's address for this request. */
export const searchEntries = (base: string): SearchEntry[] =>
  ARTICLES.map((a) => ({ href: wikiHref(base, a.slug), title: a.title, emoji: a.emoji, summary: a.summary, text: articleText(a) }));
