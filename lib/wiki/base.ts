import { headers } from "next/headers";
import { WIKI_HOST, WIKI_PATH } from "@/lib/petdex-public";

/**
 * Where the wiki's pages live for this request: at the root on wiki.petfarm.online (middleware.ts
 * rewrites "/x" to "/wiki/x"), under /wiki everywhere else (the preview on WorkHub's domain).
 */
export async function wikiBase(): Promise<string> {
  return (await headers()).get("host") === WIKI_HOST ? "" : WIKI_PATH;
}

/** The address of an article ("" for the wiki home). */
export const wikiHref = (base: string, slug = "") => (slug ? `${base}/${slug}` : base || "/");
