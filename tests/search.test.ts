import { describe, expect, it } from "vitest";
import { escapeLike, FOLD_FROM, FOLD_TO, foldSearch, likePatterns, matchPages, matchRange, parseSearchQuery } from "../lib/search";

// Postgres translate(): a character of `from` becomes the one at the same place in `to`, or is deleted past its end.
const pgTranslate = (text: string, from: string, to: string) =>
  [...text].map((c) => { const i = from.indexOf(c); return i === -1 ? c : (to[i] ?? ""); }).join("");
const pgFold = (text: string) => pgTranslate(text, FOLD_FROM, FOLD_TO).toLowerCase();

const BASES = ["a", "ă", "â", "e", "ê", "i", "o", "ô", "ơ", "u", "ư", "y"];
const TONES = ["\u0300", "\u0301", "\u0309", "\u0303", "\u0323"];
// Every Vietnamese vowel with every tone (precomposed), both cases, plus đ/Đ.
const VIETNAMESE = [...BASES.flatMap((b) => [b, ...TONES.map((t) => (b + t).normalize("NFC"))]).filter((c) => !/^[aeiouy]$/.test(c)), "đ"]
  .flatMap((c) => [c, c.toUpperCase()]);

describe("accent-insensitive folding", () => {
  it("covers every Vietnamese letter with a tone mark, in both cases", () => {
    expect(VIETNAMESE).toHaveLength(134);
    for (const c of VIETNAMESE) {
      const plain = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/i, "d").toLowerCase();
      expect([c, foldSearch(c), pgFold(c)]).toEqual([c, plain, plain]);
    }
    expect(new Set(FOLD_FROM).size).toBe(FOLD_FROM.length);
    expect(FOLD_FROM.length - FOLD_TO.length).toBe(8); // combining marks, deleted by translate()
  });

  it("matches the database folding for typed, uppercase and decomposed text", () => {
    const samples = ["Báo cáo tuần", "ĐÀO TẠO nội bộ", "Đỗ Quang Hải", "Kiểm thử & Triển khai", "Ba\u0301o ca\u0301o", "Q4 · 50% (UI/UX)"];
    expect(samples.map(foldSearch)).toEqual(["bao cao tuan", "dao tao noi bo", "do quang hai", "kiem thu & trien khai", "bao cao", "q4 · 50% (ui/ux)"]);
    for (const s of samples) expect(pgFold(s)).toBe(foldSearch(s));
    expect(foldSearch("Mu\u0308ller")).toBe("müller"); // other accents are kept, only composed
  });
});

describe("search query", () => {
  it("is trimmed and must be 2–100 characters", () => {
    expect(parseSearchQuery(null)).toBeNull();
    expect(parseSearchQuery("  a  ")).toBeNull();
    expect(parseSearchQuery("\u0301\u0301")).toBeNull();
    expect(parseSearchQuery("  bao   cao ")).toBe("bao cao");
    expect(parseSearchQuery("đi")).toBe("đi");
    expect(parseSearchQuery("x".repeat(100))).toHaveLength(100);
    expect(parseSearchQuery("x".repeat(101))).toBeNull();
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
    expect(escapeLike("báo cáo")).toBe("báo cáo");
    expect(likePatterns("Tỷ lệ 50%_")).toEqual({ contains: "%ty le 50\\%\\_%", prefix: "ty le 50\\%\\_%", word: "% ty le 50\\%\\_%" });
    expect(likePatterns("C:\\").prefix).toBe("c:\\\\%"); // never ends with a lone escape character
  });
});

describe("highlighting", () => {
  const mark = (text: string, query: string) => { const r = matchRange(text, query); return r && text.slice(...r); };
  it("finds the typed text without accents and prefers a word start", () => {
    expect(matchRange("Báo cáo tuần", "bao cao")).toEqual([0, 7]);
    expect(mark("Lập BÁO CÁO quý", "bao cao")).toBe("BÁO CÁO");
    expect(mark("Giao ao cá", "ao")).toBe("ao");
    expect(matchRange("Giao ao cá", "ao")).toEqual([5, 7]);
    expect(mark("Triển khai", "khai")).toBe("khai");
    expect(mark("Ba\u0301o ca\u0301o", "bao")).toBe("Ba\u0301o");
    expect(matchRange("Đào tạo", "xyz")).toBeNull();
    expect(matchRange("Đào tạo", "  ")).toBeNull();
  });
});

describe("page shortcuts", () => {
  type Viewer = { role: string; permissions: string[] };
  const member: Viewer = { role: "MEMBER", permissions: [] };
  const finance: Viewer = { role: "MEMBER", permissions: ["FINANCE_MANAGE"] };
  const hrefs = (user: Viewer, text: string) => matchPages(user, text).map((p) => p.href);

  it("lists the pages the user may open when nothing is typed", () => {
    expect(hrefs(member, "")).toEqual(["/dashboard", "/projects", "/tasks", "/ai", "/inbox", "/reports", "/team", "/settings"]);
    expect(hrefs(finance, " ")).toContain("/contracts");
  });

  it("matches names and keywords without accents, names first", () => {
    expect(hrefs(member, "bao  cao")).toEqual(["/inbox", "/reports", "/tasks"]);
    expect(hrefs(member, "hop dong")).toEqual([]);
    expect(hrefs(finance, "HỢP ĐỒNG")).toEqual(["/contracts"]);
    expect(hrefs(member, "doi mat khau")).toEqual(["/settings"]);
  });
});
