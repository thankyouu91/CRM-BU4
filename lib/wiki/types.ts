// The Petfarm wiki's content model: articles are plain data (lib/wiki/articles.ts) rendered by
// components/petfarm/wiki/article-body.tsx. Inline text may use **bold** and [text](slug) links
// to other articles ("" links to the wiki home).

export type WikiBlock =
  | { p: string }
  | { list: string[] }
  | { steps: string[] }
  | { table: { head: string[]; rows: (string | number)[][] } }
  | { tip: string }
  | { warn: string }
  | { img: { src: string; alt: string; width: number; height: number } }
  /** Pets drawn live by the game's renderer: a species at an age stage ("baby" … "elder") and a level. */
  | { pets: { id: string; stage?: string; level?: number; label: string; sub?: string }[] }
  /** The whole species catalogue with filters, every age stage and every level form. */
  | { petGallery: true };

export interface WikiSection {
  /** Anchor for the table of contents. */
  id: string;
  title: string;
  blocks: WikiBlock[];
}

export type WikiCategory = "bat-dau" | "nuoi-be" | "kiem-xu" | "kinh-te" | "cong-dong";

export interface WikiArticle {
  slug: string;
  title: string;
  category: WikiCategory;
  /** One sentence for the home page cards, the search and the page description. */
  summary: string;
  /** An emoji shown beside the title. */
  emoji: string;
  /** Extra words players might search for. */
  keywords?: string[];
  sections: WikiSection[];
  related?: string[];
}
