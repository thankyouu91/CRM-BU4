import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSharedDeck } from "@/lib/report-share";
import { asJson } from "@/lib/json";
import { buildReportDeck, makeDeckMeta } from "@/lib/deck-model";
import type { Summary } from "@/lib/stats";
import type { DepartmentReport } from "@/lib/department-report";
import { ShareClient } from "./share-client";

// Never cached or indexed: the data is read when the link is opened, and only works
// while the link does (middleware.ts also sends noindex and no-referrer headers).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Báo cáo công việc", robots: { index: false, follow: false } };

/** /share/<token>: the report presentation for people without an account. */
export default async function SharePage(props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params;
  const shared = await loadSharedDeck(token);
  if (!shared) notFound();
  // Built here, not in the browser: the page source of a public link must hold the slides
  // only, not every task description, report text and person the figures came from.
  const summary = asJson<Summary>(shared.summary);
  const deck = buildReportDeck(summary, makeDeckMeta(summary.period.label, shared.projectName, shared.creatorName), asJson<DepartmentReport>(shared.week));
  return <ShareClient deck={deck} />;
}
