import type { WikiArticle } from "./types";

export const ARTICLES: WikiArticle[] = [
  { slug: "bat-dau", title: "Bắt đầu chơi", category: "bat-dau", emoji: "🌱", summary: "x", sections: [{ id: "a", title: "A", blocks: [{ p: "Xem [chăm sóc](cham-soc)" }] }] },
  { slug: "cham-soc", title: "Chăm sóc", category: "nuoi-be", emoji: "🛁", summary: "x", sections: [{ id: "a", title: "Phòng khám", blocks: [{ table: { head: ["a"], rows: [[1000]] } }] }] },
  { slug: "viec-lam", title: "Việc làm", category: "kiem-xu", emoji: "💼", summary: "x", sections: [{ id: "a", title: "A", blocks: [{ tip: "t" }] }] },
  { slug: "san", title: "Sàn", category: "kinh-te", emoji: "📈", summary: "x", sections: [{ id: "a", title: "A", blocks: [{ warn: "w" }] }] },
  { slug: "hoi", title: "Hội", category: "cong-dong", emoji: "🤝", summary: "x", sections: [{ id: "a", title: "A", blocks: [{ steps: ["a", "b"] }] }] },
];
