"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FileDown, Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Presenter, TRANSITIONS, type TransitionKind } from "./presenter";
import { DECK_THEMES, type DeckTheme } from "./theme";
import type { Deck } from "@/lib/deck-model";
import { fileSlug } from "@/lib/export/save";

/** Present / export-PDF / export-PPTX controls for any deck, plus theme & transition settings. */
export function DeckActions({
  deck,
  disabled,
  presentingAt,
  onPresentingChange,
}: {
  deck: Deck | null;
  disabled?: boolean;
  /** Optionally controlled: slide index the presenter is open at (null = closed). */
  presentingAt?: number | null;
  onPresentingChange?: (index: number | null) => void;
}) {
  const [themeId, setThemeId] = useState<DeckTheme["id"]>("dark");
  const [transition, setTransition] = useState<TransitionKind>("slide");
  const [ownPresenting, setOwnPresenting] = useState<number | null>(null);
  const presenting = presentingAt !== undefined ? presentingAt : ownPresenting;
  const setPresenting = onPresentingChange ?? setOwnPresenting;
  const [busy, setBusy] = useState<null | { kind: "pdf" | "pptx"; done: number; total: number }>(null);

  const base = deck ? fileSlug(`${deck.meta.title} ${deck.meta.periodLabel}`) || "bao-cao" : "bao-cao";

  const pdf = async () => {
    if (!deck) return;
    setBusy({ kind: "pdf", done: 0, total: deck.slides.length });
    try {
      const { exportDeckPdf } = await import("@/lib/export/pdf");
      await exportDeckPdf(deck, themeId, `${base}.pdf`, (done, total) => setBusy({ kind: "pdf", done, total }));
      toast.success("Đã xuất file PDF");
    } catch (e) {
      console.error(e);
      toast.error("Không thể xuất PDF");
    } finally {
      setBusy(null);
    }
  };

  const pptx = async () => {
    if (!deck) return;
    setBusy({ kind: "pptx", done: 0, total: deck.slides.length });
    try {
      const { exportDeckPptx } = await import("@/lib/export/pptx");
      await exportDeckPptx(deck, themeId, transition, `${base}.pptx`);
      toast.success("Đã xuất file PowerPoint");
    } catch (e) {
      console.error(e);
      toast.error("Không thể xuất PowerPoint");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={themeId}
          onChange={(e) => setThemeId(e.target.value as DeckTheme["id"])}
          className="h-10 rounded-lg border bg-card px-2 text-sm"
          aria-label="Giao diện slide"
          title="Giao diện slide"
        >
          {Object.values(DECK_THEMES).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={transition}
          onChange={(e) => setTransition(e.target.value as TransitionKind)}
          className="h-10 rounded-lg border bg-card px-2 text-sm"
          aria-label="Hiệu ứng chuyển slide"
          title="Hiệu ứng chuyển slide (áp dụng cho trình chiếu và file PowerPoint)"
        >
          {TRANSITIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={pdf} disabled={!deck || disabled || !!busy}>
          <FileDown className="h-4 w-4" /> PDF
        </Button>
        <Button variant="outline" onClick={pptx} disabled={!deck || disabled || !!busy}>
          <FileDown className="h-4 w-4" /> PowerPoint
        </Button>
        <Button onClick={() => setPresenting(0)} disabled={!deck || disabled}>
          <Presentation className="h-4 w-4" /> Trình chiếu
        </Button>
      </div>

      {deck && presenting !== null && (
        <Presenter
          deck={deck}
          initialTheme={themeId}
          initialTransition={transition}
          startIndex={presenting}
          onClose={() => setPresenting(null)}
        />
      )}

      {busy &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <div className="w-80 rounded-2xl border bg-card p-6 text-center shadow-pop">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <p className="mt-4 font-semibold">{busy.kind === "pdf" ? "Đang tạo file PDF…" : "Đang tạo file PowerPoint…"}</p>
              {busy.kind === "pdf" && (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Slide {busy.done}/{busy.total}
                  </p>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary transition-all" style={{ width: `${(busy.done / busy.total) * 100}%` }} />
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
