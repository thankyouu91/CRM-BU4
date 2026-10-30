import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { WIKI_HOST, WIKI_PATH, wikiHostRoute } from "@/lib/petdex-public";
import { ARTICLES } from "@/lib/wiki/articles";
import { CATEGORIES, getArticle, searchEntries } from "@/lib/wiki";
import { fold } from "@/lib/wiki/fold";
import { middleware } from "@/middleware";
import { CLAN } from "@/lib/wiki/rules";
import { SPECIES } from "@/public/ta-tua/game/js/shared/pets.js";

// wiki.petfarm.online is the players' guide: "/" is the wiki home and "/<article>" an article.

const on = (host: string, path: string) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));

describe("Petfarm wiki routing", () => {
  it("maps paths on the wiki's domain", () => {
    expect(WIKI_HOST).toBe("wiki.petfarm.online");
    expect(wikiHostRoute("/")).toEqual({ rewrite: WIKI_PATH });
    expect(wikiHostRoute("/cham-soc")).toEqual({ rewrite: `${WIKI_PATH}/cham-soc` });
    expect(wikiHostRoute("/wiki/cham-soc")).toEqual({ redirect: "/cham-soc" });
    expect(wikiHostRoute("/wiki")).toEqual({ redirect: "/" });
    expect(wikiHostRoute("/server1")).toEqual({ redirect: "https://play.petfarm.online/server1" });
    expect(wikiHostRoute("/invitation/abc")).toEqual({ redirect: "https://play.petfarm.online/invitation/abc" });
    expect(wikiHostRoute("/api/tasks")).toEqual({ notFound: true });
    // Deeper paths match no article: they show the wiki's own 404, not Next's bare one.
    expect(wikiHostRoute("/abc/xyz")).toEqual({ rewrite: `${WIKI_PATH}/_` });
    expect(wikiHostRoute("/cham-soc/")).toEqual({ rewrite: `${WIKI_PATH}/cham-soc/` });
  });

  it("serves the wiki without a session and keeps WorkHub out of reach", async () => {
    expect((await on(WIKI_HOST, "/")).headers.get("x-middleware-rewrite")).toBe(`https://${WIKI_HOST}${WIKI_PATH}`);
    expect((await on(WIKI_HOST, "/viec-lam")).headers.get("x-middleware-rewrite")).toBe(`https://${WIKI_HOST}${WIKI_PATH}/viec-lam`);
    expect((await on(WIKI_HOST, "/wiki/viec-lam")).headers.get("location")).toBe(`https://${WIKI_HOST}/viec-lam`);
    expect((await on(WIKI_HOST, "/api/projects")).status).toBe(404);
    // Unknown paths render the wiki's own "not found" page instead of WorkHub's login.
    expect((await on(WIKI_HOST, "/dashboard")).headers.get("x-middleware-rewrite")).toBe(`https://${WIKI_HOST}${WIKI_PATH}/dashboard`);
  });

  it("keeps a public preview under /wiki on WorkHub's domain", async () => {
    expect((await on("crm.votranlong91.workers.dev", "/wiki/cham-soc")).headers.get("location")).toBeNull();
  });
});

describe("Petfarm wiki content", () => {
  it("has unique, well-formed articles in known categories", () => {
    const slugs = ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const a of ARTICLES) {
      expect(a.slug).toMatch(/^[a-z0-9-]+$/);
      expect(CATEGORIES.some((c) => c.key === a.category)).toBe(true);
      expect(a.sections.length).toBeGreaterThan(0);
      expect(new Set(a.sections.map((s) => s.id)).size).toBe(a.sections.length);
    }
    for (const c of CATEGORIES) expect(ARTICLES.some((a) => a.category === c.key)).toBe(true);
  });

  it("links only to articles that exist", () => {
    for (const a of ARTICLES) {
      for (const r of a.related ?? []) expect(getArticle(r), `${a.slug} → ${r}`).toBeDefined();
      for (const [, slug] of JSON.stringify(a.sections).matchAll(/\]\(([a-z0-9-]*)\)/g)) {
        if (slug) expect(getArticle(slug), `${a.slug} → ${slug}`).toBeDefined();
      }
      // A link to a section must name a section that exists.
      for (const [, slug, id] of JSON.stringify(a.sections).matchAll(/\]\(([a-z0-9-]+)#([a-z0-9-]+)\)/g)) {
        expect(getArticle(slug)?.sections.map((s) => s.id), `${a.slug} → ${slug}#${id}`).toContain(id);
      }
    }
  });

  it("shows every species, and every legendary pet by name", () => {
    const gallery = getArticle("thu-vien-be")!;
    const blocks = gallery.sections.flatMap((s) => s.blocks);
    expect(blocks.some((b) => "petGallery" in b)).toBe(true);
    const legends = (SPECIES as { id: string; rarity: string }[]).filter((s) => s.rarity === "huyenthoai").map((s) => s.id);
    const shown = blocks.flatMap((b) => ("pets" in b ? b.pets.map((p) => p.id) : []));
    for (const id of legends) expect(shown).toContain(id);
    const text = searchEntries("").find((e) => e.href === "/thu-vien-be")!.text;
    expect(text).toContain("bach ho");
  });

  it("lists the clan in the unlock table at the game's level", () => {
    const table = getArticle("cap-do")!.sections.flatMap((s) => s.blocks).find((b) => "table" in b && b.table.head[0] === "Cấp");
    const row = table && "table" in table ? table.table.rows.find((r) => String(r[1]).includes("gia-toc")) : undefined;
    expect(row?.[0]).toBe(CLAN.unlockLevel);
  });

  it("is searchable without Vietnamese marks", () => {
    expect(fold("Ngân hàng Đồi Sao")).toBe("ngan hang doi sao");
    const entries = searchEntries("");
    expect(entries.find((e) => e.href === "/cham-soc")?.text).toContain("phong kham");
  });
});
