"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Presenter } from "@/components/deck/presenter";
import { buildReportDeck, makeDeckMeta } from "@/lib/deck-model";
import type { Summary } from "@/lib/stats";

export function PresentClient({ summary, projectName, userName }: { summary: Summary; projectName: string | null; userName: string }) {
  const router = useRouter();
  const deck = useMemo(() => buildReportDeck(summary, makeDeckMeta(summary.period.label, projectName, userName)), [summary, projectName, userName]);
  return <Presenter deck={deck} onClose={() => router.push("/reports")} />;
}
