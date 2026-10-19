import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSharedDeck } from "@/lib/report-share";
import { asJson } from "@/lib/json";
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
  const deck = await loadSharedDeck(token);
  if (!deck) notFound();
  return (
    <ShareClient
      summary={asJson<Summary>(deck.summary)}
      week={asJson<DepartmentReport>(deck.week)}
      projectName={deck.projectName}
      creatorName={deck.creatorName}
    />
  );
}
