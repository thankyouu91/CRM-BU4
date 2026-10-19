"use client";

import { useMemo } from "react";
import { Presenter } from "@/components/deck/presenter";
import { buildReportDeck, makeDeckMeta } from "@/lib/deck-model";
import type { Summary } from "@/lib/stats";
import type { DepartmentReport } from "@/lib/department-report";

export function ShareClient({ summary, week, projectName, creatorName }: { summary: Summary; week: DepartmentReport; projectName: string | null; creatorName: string }) {
  const deck = useMemo(() => buildReportDeck(summary, makeDeckMeta(summary.period.label, projectName, creatorName), week), [summary, week, projectName, creatorName]);
  return <Presenter deck={deck} />;
}
