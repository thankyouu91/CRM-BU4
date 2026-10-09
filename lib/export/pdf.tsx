"use client";

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { SlideView } from "@/components/deck/slides";
import { DECK_THEMES, SLIDE_H, SLIDE_W, type DeckTheme } from "@/components/deck/theme";
import type { Deck } from "@/lib/deck-model";
import { appFont } from "@/lib/font";
import { saveBlob } from "./save";

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Export a deck as a 16:9 PDF, one slide per page. Slides are rendered
 * off-screen without animation, rasterised at 2× and placed full-bleed.
 */
export async function exportDeckPdf(
  deck: Deck,
  themeId: DeckTheme["id"],
  filename: string,
  onProgress?: (done: number, total: number) => void,
) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const theme = DECK_THEMES[themeId];

  // Render all slides into a hidden stage (covered by the caller's progress overlay).
  const host = document.createElement("div");
  host.className = appFont.className;
  Object.assign(host.style, { position: "fixed", left: "0", top: "0", zIndex: "9990", pointerEvents: "none" });
  document.body.appendChild(host);
  const root = createRoot(host);

  try {
    flushSync(() =>
      root.render(
        <div>
          {deck.slides.map((s, i) => (
            <SlideView key={i} slide={s} meta={deck.meta} theme={theme} index={i} total={deck.slides.length} />
          ))}
        </div>,
      ),
    );
    await document.fonts.ready;
    await nextFrame();
    await nextFrame();

    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [SLIDE_W, SLIDE_H], hotfixes: ["px_scaling"], compress: true });
    pdf.setProperties({ title: deck.meta.title, subject: `${deck.meta.scopeLabel} · ${deck.meta.periodLabel}`, author: deck.meta.preparedBy, creator: "WorkHub" });

    const nodes = Array.from(host.querySelectorAll<HTMLElement>("[data-slide]"));
    for (let i = 0; i < nodes.length; i++) {
      const canvas = await html2canvas(nodes[i], {
        scale: 2,
        backgroundColor: theme.bg,
        logging: false,
        useCORS: true,
        width: SLIDE_W,
        height: SLIDE_H,
        windowWidth: SLIDE_W,
        windowHeight: SLIDE_H,
      });
      if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, SLIDE_W, SLIDE_H, undefined, "FAST");
      onProgress?.(i + 1, nodes.length);
    }

    saveBlob(pdf.output("blob"), filename);
  } finally {
    root.unmount();
    host.remove();
  }
}
