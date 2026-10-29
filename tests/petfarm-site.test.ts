import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { SITE_APEX, SITE_HOST, SITE_PATH, playHostRedirect, siteHostRoute } from "@/lib/petdex-public";
import { middleware } from "@/middleware";

// www.petfarm.online shows the Petfarm landing page only; the game's own pages live on play.petfarm.online.

const on = (host: string, path: string) => middleware(new NextRequest(`https://${host}${path}`, { headers: { host } }));

describe("Petfarm website routing", () => {
  it("maps paths on the website's domain", () => {
    expect(SITE_HOST).toBe("www.petfarm.online");
    expect(SITE_APEX).toBe("petfarm.online");
    expect(siteHostRoute("/")).toEqual({ rewrite: SITE_PATH });
    expect(siteHostRoute("/server1")).toEqual({ redirect: "https://play.petfarm.online/server1" });
    expect(siteHostRoute("/invitation/abc123")).toEqual({ redirect: "https://play.petfarm.online/invitation/abc123" });
    expect(siteHostRoute("/password/0000")).toEqual({ redirect: "https://play.petfarm.online/password/0000" });
    expect(siteHostRoute("/api/projects")).toEqual({ notFound: true });
    expect(siteHostRoute("/dashboard")).toEqual({ redirect: "/" });
    expect(siteHostRoute(SITE_PATH)).toEqual({ redirect: "/" });
  });

  it("serves the landing page at / without a session and keeps WorkHub out of reach", async () => {
    const home = await on(SITE_HOST, "/");
    expect(home.headers.get("x-middleware-rewrite")).toBe(`https://${SITE_HOST}${SITE_PATH}`);
    expect((await on(SITE_HOST, "/dashboard")).headers.get("location")).toBe(`https://${SITE_HOST}/`);
    expect((await on(SITE_HOST, "/api/tasks")).status).toBe(404);
    expect((await on(SITE_HOST, "/invitation/x1")).headers.get("location")).toBe("https://play.petfarm.online/invitation/x1");
  });

  it("moves the bare domain to www, keeping the path", async () => {
    const res = await on(SITE_APEX, "/abc?x=1");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe(`https://${SITE_HOST}/abc?x=1`);
  });

  it("leaves the game domain and WorkHub as they were", async () => {
    expect(playHostRedirect(SITE_PATH)).toBe("/server1");
    // On WorkHub's own domain the landing page is public, for previews.
    const preview = await on("crm.votranlong91.workers.dev", SITE_PATH);
    expect(preview.headers.get("location")).toBeNull();
    expect((await on("crm.votranlong91.workers.dev", "/dashboard")).headers.get("location")).toContain("/login");
  });
});
