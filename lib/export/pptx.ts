"use client";

import { formatVndShort } from "@/lib/finance";
import type PptxGenJS from "pptxgenjs";
import { DECK_THEMES, type DeckTheme } from "@/components/deck/theme";
import type { TransitionKind } from "@/components/deck/presenter";
import { WORKLOAD_SERIES, statusLegend } from "@/components/charts/charts";
import { clipName, PROJECTS_LIST_MAX, type Deck, type DeckMeta, type SlideModel } from "@/lib/deck-model";
import { initials } from "@/lib/utils";
import { saveBlob } from "./save";

// Native, editable PowerPoint built from the same deck model as the on-screen
// slides. Layout coordinates are in slide pixels (1280×720) and converted to
// inches (LAYOUT_WIDE = 13.333×7.5in → 96px per inch).

type Slide = PptxGenJS.Slide;

const FONT = "Arial"; // universally installed, full Vietnamese coverage
const inch = (px: number) => px / 96;
const pt = (px: number) => Math.round(px * 0.75 * 10) / 10;
const hex = (c: string) => c.replace("#", "").toUpperCase();

/** OOXML transition element per presenter transition (base PresentationML schema only). */
const PPT_TRANSITION: Record<TransitionKind, string> = {
  slide: '<p:push dir="l"/>',
  fade: "<p:fade/>",
  zoom: '<p:zoom dir="in"/>',
  flip: '<p:cover dir="l"/>',
};

interface Ctx {
  pres: PptxGenJS;
  t: DeckTheme;
  meta: DeckMeta;
}

function text(
  slide: Slide,
  value: string | PptxGenJS.TextProps[],
  box: { x: number; y: number; w: number; h: number },
  o: Partial<PptxGenJS.TextPropsOptions> & { px?: number } = {},
) {
  const { px = 16, ...rest } = o;
  slide.addText(value, {
    x: inch(box.x),
    y: inch(box.y),
    w: inch(box.w),
    h: inch(box.h),
    fontFace: FONT,
    fontSize: pt(px),
    margin: 0,
    valign: "top",
    ...rest,
  });
}

function panel(c: Ctx, slide: Slide, box: { x: number; y: number; w: number; h: number }) {
  slide.addShape(c.pres.ShapeType.roundRect, {
    x: inch(box.x),
    y: inch(box.y),
    w: inch(box.w),
    h: inch(box.h),
    fill: { color: hex(c.t.panel) },
    line: { color: hex(c.t.panelBorder), width: 0.75 },
    rectRadius: 0.125,
  });
}

function rect(c: Ctx, slide: Slide, box: { x: number; y: number; w: number; h: number }, color: string, rounded = true) {
  slide.addShape(rounded ? c.pres.ShapeType.roundRect : c.pres.ShapeType.rect, {
    x: inch(box.x),
    y: inch(box.y),
    w: inch(Math.max(box.w, 0.5)),
    h: inch(box.h),
    fill: { color: hex(color) },
    line: { color: hex(color), width: 0 },
    ...(rounded ? { rectRadius: 0.5 } : {}),
  });
}

function chartAxes(c: Ctx, n: number) {
  const { chart, panel: surface } = c.t;
  return {
    catAxisLabelColor: hex(chart.muted),
    valAxisLabelColor: hex(chart.muted),
    catAxisLabelFontFace: FONT,
    valAxisLabelFontFace: FONT,
    catAxisLabelFontSize: 9,
    valAxisLabelFontSize: 9,
    catAxisLineShow: true,
    catAxisLineColor: hex(chart.axis),
    valAxisLineShow: false,
    valGridLine: { color: hex(chart.grid), style: "solid" as const, size: 0.75 },
    catGridLine: { style: "none" as const },
    catAxisLabelFrequency: String(Math.max(1, Math.ceil(n / 12))),
    valAxisMinVal: 0,
    plotArea: { fill: { color: hex(surface) } },
    legendFontFace: FONT,
    legendColor: hex(c.t.inkSecondary),
    legendFontSize: 10,
  };
}

// ---------------------------------------------------------------------------
// Slide renderers
// ---------------------------------------------------------------------------

// Same frame as the screen (components/deck/slides.tsx SlideView): label, title, hairline, footer.
function chrome(c: Ctx, slide: Slide, s: Exclude<SlideModel, { kind: "cover" }>, index: number, total: number) {
  const { t, meta } = c;
  text(slide, s.kicker, { x: 64, y: 52, w: 900, h: 22 }, { px: 15, color: hex(t.muted) });
  text(slide, s.title, { x: 64, y: 78, w: 1100, h: 50 }, { px: 34, bold: true, color: hex(t.ink), fit: "shrink" });
  rect(c, slide, { x: 64, y: 144, w: 1152, h: 1 }, t.panelBorder, false);
  text(slide, `${meta.scopeLabel} · ${meta.periodLabel}`, { x: 64, y: 676, w: 800, h: 20 }, { px: 13, color: hex(t.muted) });
  text(slide, `${index + 1} / ${total}`, { x: 1016, y: 676, w: 200, h: 20 }, { px: 13, color: hex(t.muted), align: "right" });
}

/** Inline figures ("13 dự án   2 đã xong …"): the number carries the colour, the label stays muted. */
function figures(t: DeckTheme, items: { value: string | number; label: string; color?: string }[], lead?: string): PptxGenJS.TextProps[] {
  return [
    ...(lead ? [{ text: `${lead}        `, options: { bold: true, color: hex(t.ink), fontSize: pt(15) } }] : []),
    ...items.flatMap((it, i) => [
      { text: `${i ? "        " : ""}${it.value}`, options: { bold: true, color: hex(it.color ?? t.ink), fontSize: pt(18) } },
      { text: ` ${it.label}`, options: { color: hex(t.muted), fontSize: pt(15) } },
    ]),
  ];
}

const TOP = 168;
const LEFT = 64;
const WIDTH = 1152;

function renderBody(c: Ctx, slide: Slide, s: SlideModel) {
  const { t } = c;
  switch (s.kind) {
    case "kpis": {
      const w = (WIDTH - 48) / 3;
      s.items.forEach((it, i) => {
        const x = LEFT + (i % 3) * (w + 24);
        const y = TOP + Math.floor(i / 3) * (196 + 24);
        panel(c, slide, { x, y, w, h: 196 });
        text(slide, it.label, { x: x + 24, y: y + 24, w: w - 48, h: 24 }, { px: 16, color: hex(t.muted) });
        text(slide, it.value, { x: x + 24, y: y + 70, w: w - 48, h: 66 }, { px: 54, bold: true, color: hex(it.tone === "danger" ? t.danger : t.ink) });
        if (it.sub) text(slide, it.sub, { x: x + 24, y: y + 150, w: w - 48, h: 22 }, { px: 15, color: hex(t.muted) });
      });
      return;
    }

    case "projects": {
      // Same layout as the screen (components/deck/slides.tsx ProjectsBody).
      const sm = s.summary;
      text(slide, figures(t, [
        { value: sm.total, label: "dự án" },
        ...(sm.complete ? [{ value: sm.complete, label: "đã xong toàn bộ việc", color: t.success }] : []),
        ...(sm.overdue ? [{ value: sm.overdue, label: "có việc quá hạn", color: t.danger }] : []),
        ...(sm.empty ? [{ value: sm.empty, label: "chưa có công việc", color: t.muted }] : []),
      ]), { x: LEFT, y: TOP, w: WIDTH, h: 26 });
      const count = (r: (typeof s.rows)[number]) => (r.total ? `${r.done}/${r.total} việc` : "Chưa có việc");
      const top = TOP + 52;
      if (s.rows.length <= PROJECTS_LIST_MAX) {
        const rowH = s.rows.length > 4 ? 64 : 80;
        s.rows.forEach((r, i) => {
          const y = top + i * rowH;
          rect(c, slide, { x: LEFT, y: y + 9, w: 10, h: 10 }, r.color, false);
          text(slide, [
            { text: clipName(r.name, 60), options: { bold: true, color: hex(t.ink), fontSize: pt(20) } },
            { text: "   ● ", options: { color: hex(r.statusColor), fontSize: pt(11) } },
            { text: r.status, options: { color: hex(t.inkSecondary), fontSize: pt(13) } },
          ], { x: LEFT + 22, y, w: 760, h: 28 }, { fit: "shrink" });
          text(slide, [
            { text: count(r), options: { color: hex(t.muted), fontSize: pt(15) } },
            ...(r.overdue ? [{ text: `   ${r.overdue} quá hạn`, options: { color: hex(t.danger), fontSize: pt(15) } }] : []),
            { text: `   ${r.total ? `${r.progress}%` : "–"}`, options: { color: hex(r.total ? t.ink : t.muted), fontSize: pt(23), bold: true } },
          ], { x: LEFT + 760, y: y - 2, w: WIDTH - 760, h: 30 }, { align: "right" });
          const barH = s.rows.length > 4 ? 6 : 8;
          rect(c, slide, { x: LEFT, y: y + 36, w: WIDTH, h: barH }, t.track);
          if (r.progress > 0) rect(c, slide, { x: LEFT, y: y + 36, w: (WIDTH * r.progress) / 100, h: barH }, t.accent);
        });
        return;
      }
      // Two columns, read down.
      const perColumn = Math.ceil(s.rows.length / 2);
      const colW = (WIDTH - 40) / 2;
      const rowH = 54;
      s.rows.forEach((r, i) => {
        const x = LEFT + Math.floor(i / perColumn) * (colW + 40);
        const y = top + (i % perColumn) * rowH;
        rect(c, slide, { x, y: y + 8, w: 8, h: 8 }, r.color, false);
        text(slide, [
          { text: clipName(r.name, 38), options: { bold: true, color: hex(t.ink), fontSize: pt(16) } },
          { text: "  ● ", options: { color: hex(r.statusColor), fontSize: pt(10) } },
          { text: r.status, options: { color: hex(t.inkSecondary), fontSize: pt(12) } },
        ], { x: x + 18, y: y + 1, w: colW - 200, h: 22 }, { fit: "shrink" });
        text(slide, [
          { text: `${r.overdue ? `${r.overdue} quá hạn, ` : ""}${count(r)}`, options: { color: hex(r.overdue ? t.danger : t.muted), fontSize: pt(13) } },
          { text: `  ${r.total ? `${r.progress}%` : "–"}`, options: { color: hex(r.total ? t.ink : t.muted), fontSize: pt(18), bold: true } },
        ], { x: x + colW - 180, y: y - 2, w: 180, h: 26 }, { align: "right" });
        rect(c, slide, { x, y: y + 30, w: colW, h: 5 }, t.track);
        if (r.progress > 0) rect(c, slide, { x, y: y + 30, w: (colW * r.progress) / 100, h: 5 }, t.accent);
      });
      return;
    }

    case "week": {
      // Same layout as the screen (components/deck/slides.tsx WeekBody).
      const tone = (x?: string) => (x === "success" ? t.success : x === "danger" ? t.danger : x === "warning" ? t.warning : x === "accent" ? t.ink : t.muted);
      text(slide, figures(t, s.stats.map((st) => ({ value: st.value, label: st.label, color: st.value ? (st.tone ? tone(st.tone) : t.ink) : t.muted })), s.period), { x: LEFT, y: TOP, w: WIDTH, h: 28 }, { fit: "shrink" });
      const top = TOP + 52;
      if (!s.columns.length) {
        text(slide, "Không có công việc nào trong mục này.", { x: LEFT, y: top + 150, w: WIDTH, h: 30 }, { px: 20, color: hex(t.muted), align: "center" });
        return;
      }
      const colW = (WIDTH - 40) / 2;
      s.columns.forEach((col, ci) => {
        const x = LEFT + ci * (colW + 40);
        col.forEach((line, li) => {
          const y = top + li * 36;
          if (line.kind === "project") {
            rect(c, slide, { x, y: y + 11, w: 9, h: 9 }, line.color, false);
            text(slide, [
              { text: line.name, options: { bold: true, color: hex(t.ink), fontSize: pt(16) } },
              { text: `   ${line.continued ? "(tiếp)" : `${line.count} việc`}`, options: { color: hex(t.muted), fontSize: pt(13) } },
            ], { x: x + 20, y: y + 4, w: colW - 20, h: 24 }, { fit: "shrink" });
          } else {
            rect(c, slide, { x: x + 4, y: y + 2, w: 1, h: 32 }, t.panelBorder, false);
            text(slide, [
              { text: line.title, options: { color: hex(t.inkSecondary), fontSize: pt(15) } },
              { text: `   ${line.who}`, options: { color: hex(t.muted), fontSize: pt(12) } },
            ], { x: x + 24, y: y + 7, w: colW - 200, h: 22 }, { fit: "shrink" });
            text(slide, line.tag, { x: x + colW - 176, y: y + 9, w: 176, h: 20 }, { px: 13, color: hex(tone(line.tone)), align: "right" });
          }
        });
      });
      if (s.hidden > 0) text(slide, `… và ${s.hidden} việc khác: xem đầy đủ ở Báo cáo công việc phòng hoặc file Excel.`, { x: LEFT, y: 640, w: WIDTH, h: 20 }, { px: 13, color: hex(t.muted) });
      return;
    }

    case "schedule": {
      const listW = WIDTH - 348;
      const tight = s.rows.length > 5;
      const rowH = tight ? 58 : 70;
      s.rows.forEach((r, i) => {
        const y = TOP + i * rowH;
        const x = LEFT + (r.level === 2 ? 28 : 0);
        const w = listW - (r.level === 2 ? 28 : 0);
        slide.addShape(r.level === 0 ? c.pres.ShapeType.ellipse : c.pres.ShapeType.rect, {
          x: inch(x),
          y: inch(y + 8),
          w: inch(10),
          h: inch(10),
          fill: { color: hex(r.color) },
          line: { color: hex(r.color), width: 0 },
        });
        text(slide, [
          { text: `${r.level === 2 ? "└ " : ""}${r.name}`, options: { bold: r.level < 2, color: hex(t.ink), fontSize: pt(r.level === 0 ? 18 : 16) } },
          { text: `   ● `, options: { color: hex(r.statusColor), fontSize: pt(11) } },
          { text: r.status, options: { color: hex(t.inkSecondary), fontSize: pt(13) } },
        ], { x: x + 20, y, w: w * 0.55, h: 26 }, { fit: "shrink" });
        text(slide, [
          { text: r.deadline, options: { color: hex(t.muted), fontSize: pt(13) } },
          ...(r.planned !== null ? [{ text: `   KH ${r.planned}%`, options: { color: hex(t.muted), fontSize: pt(13) } }] : []),
          { text: `   ${r.progress}%`, options: { color: hex(t.ink), fontSize: pt(20), bold: true } },
        ], { x: x + w * 0.55, y: y - 2, w: w * 0.45, h: 30 }, { align: "right" });
        const barY = y + 34;
        const barH = tight ? 6 : 8;
        rect(c, slide, { x, y: barY, w, h: barH }, t.track);
        if (r.progress > 0) rect(c, slide, { x, y: barY, w: (w * r.progress) / 100, h: barH }, t.accent);
        // The plan tick sits in a ring of the slide colour so it reads on top of the bar too.
        if (r.planned !== null) {
          rect(c, slide, { x: x + (w * r.planned) / 100 - 3.5, y: barY - 6, w: 7, h: barH + 12 }, t.bg, false);
          rect(c, slide, { x: x + (w * r.planned) / 100 - 1.5, y: barY - 4, w: 3, h: barH + 8 }, t.ink, false);
        }
      });
      text(slide, "Thanh: thực tế. Vạch đứng: kế hoạch đến hôm nay (KH).", { x: LEFT, y: TOP + s.rows.length * rowH + 4, w: listW, h: 20 }, { px: 13, color: hex(t.muted) });

      // Work volume panel
      const px = LEFT + listW + 28;
      const pw = WIDTH - listW - 28;
      const wl = s.workload;
      const pct = (v: number) => (wl.total ? Math.round((v / wl.total) * 100) : 0);
      panel(c, slide, { x: px, y: TOP, w: pw, h: 468 });
      text(slide, "Khối lượng công việc", { x: px + 24, y: TOP + 22, w: pw - 48, h: 24 }, { px: 16, bold: true, color: hex(t.ink) });
      text(slide, "Tổng khối lượng", { x: px + 24, y: TOP + 62, w: pw - 48, h: 20 }, { px: 14, color: hex(t.muted) });
      text(slide, String(wl.total), { x: px + 24, y: TOP + 82, w: pw - 48, h: 50 }, { px: 44, bold: true, color: hex(t.ink) });
      const half = (pw - 48) / 2;
      text(slide, "Đã làm", { x: px + 24, y: TOP + 146, w: half, h: 20 }, { px: 14, color: hex(t.muted) });
      text(slide, [
        { text: String(wl.done), options: { color: hex(t.success), bold: true, fontSize: pt(28) } },
        { text: `  ${pct(wl.done)}%`, options: { color: hex(t.muted), fontSize: pt(15) } },
      ], { x: px + 24, y: TOP + 166, w: half, h: 40 });
      text(slide, "Cần làm", { x: px + 24 + half, y: TOP + 146, w: half, h: 20 }, { px: 14, color: hex(t.muted) });
      text(slide, [
        { text: String(wl.remaining), options: { color: hex(t.ink), bold: true, fontSize: pt(28) } },
        { text: `  ${pct(wl.remaining)}%`, options: { color: hex(t.muted), fontSize: pt(15) } },
      ], { x: px + 24 + half, y: TOP + 166, w: half, h: 40 });
      const parts = [
        { label: "Đã hoàn thành", value: wl.done, color: t.chart.status.DONE },
        { label: "Đang làm", value: wl.inProgress, color: t.chart.status.IN_PROGRESS },
        { label: "Chưa bắt đầu", value: wl.notStarted, color: t.chart.status.TODO },
        { label: "Bị chặn", value: wl.blocked, color: t.chart.status.BLOCKED },
      ].filter((p) => p.value > 0);
      const barX = px + 24;
      const barW = pw - 48;
      rect(c, slide, { x: barX, y: TOP + 224, w: barW, h: 10 }, t.track);
      let cx = barX;
      for (const p of parts) {
        const segW = (barW * p.value) / Math.max(1, wl.total);
        rect(c, slide, { x: cx, y: TOP + 224, w: Math.max(segW - 2, 0.5), h: 10 }, p.color, false);
        cx += segW;
      }
      parts.forEach((p, i) => {
        const ly = TOP + 256 + i * 28;
        rect(c, slide, { x: barX, y: ly + 5, w: 10, h: 10 }, p.color, false);
        text(slide, p.label, { x: barX + 20, y: ly, w: barW - 80, h: 20 }, { px: 14, color: hex(t.inkSecondary) });
        text(slide, String(p.value), { x: barX + barW - 60, y: ly, w: 60, h: 20 }, { px: 14, bold: true, color: hex(t.ink), align: "right" });
      });
      if (wl.overdue > 0) {
        text(slide, `${wl.overdue} việc đã quá hạn`, { x: barX, y: TOP + 256 + parts.length * 28 + 10, w: barW, h: 22 }, { px: 15, color: hex(t.danger) });
      }
      return;
    }

    case "finance": {
      const f = s.totals;
      const tiles = [
        { label: "Giá trị hợp đồng", value: formatVndShort(f.value), sub: `${f.count} hợp đồng`, color: t.ink },
        { label: "Chi phí thực hiện", value: formatVndShort(f.totalCost), sub: `Tỷ lệ chi phí ${f.costRatio}%`, color: t.ink },
        { label: "Lợi nhuận gộp", value: formatVndShort(f.profit), sub: `Tỷ suất ${f.margin}%${f.estimated ? `, ${f.estimated} HĐ ước tính` : ""}`, color: f.profit < 0 ? t.danger : t.success },
        { label: "Còn phải thu", value: formatVndShort(f.receivable), sub: `Đã thu ${formatVndShort(f.collected)}`, color: f.receivable > 0 ? t.danger : t.ink },
      ];
      const gap = 18;
      const tw = (WIDTH - gap * 3) / 4;
      tiles.forEach((it, i) => {
        const x = LEFT + i * (tw + gap);
        panel(c, slide, { x, y: TOP, w: tw, h: 124 });
        text(slide, it.label, { x: x + 20, y: TOP + 18, w: tw - 40, h: 20 }, { px: 14, color: hex(t.muted) });
        text(slide, it.value, { x: x + 20, y: TOP + 42, w: tw - 40, h: 44 }, { px: 32, bold: true, color: hex(it.color), fit: "shrink" });
        text(slide, it.sub, { x: x + 20, y: TOP + 92, w: tw - 40, h: 20 }, { px: 13, color: hex(t.muted), fit: "shrink" });
      });
      // Table: project | progress | value | profit (margin) | receivable
      const colX = [LEFT, LEFT + 360, LEFT + 610, LEFT + 790, LEFT + 990];
      const colW = [350, 240, 170, 190, 162];
      const headY = TOP + 150;
      ["Dự án", "Tiến độ công việc", "Giá trị HĐ", "Lợi nhuận (tỷ suất)", "Còn phải thu"].forEach((h, i) =>
        text(slide, h, { x: colX[i], y: headY, w: colW[i], h: 20 }, { px: 13, color: hex(t.muted), align: i >= 2 ? "right" : "left" }),
      );
      rect(c, slide, { x: LEFT, y: headY + 26, w: WIDTH, h: 1 }, t.panelBorder, false);
      s.rows.forEach((r, i) => {
        const y = headY + 36 + i * 50;
        rect(c, slide, { x: LEFT, y: y + 8, w: 8, h: 8 }, r.color, false);
        text(slide, r.name, { x: LEFT + 20, y, w: colW[0] - 20, h: 24 }, { px: 16, bold: true, color: hex(t.ink), fit: "shrink" });
        if (r.progress === null) text(slide, "–", { x: colX[1], y, w: colW[1], h: 24 }, { px: 14, color: hex(t.muted) });
        else {
          rect(c, slide, { x: colX[1], y: y + 9, w: colW[1] - 60, h: 6 }, t.track);
          if (r.progress > 0) rect(c, slide, { x: colX[1], y: y + 9, w: ((colW[1] - 60) * r.progress) / 100, h: 6 }, t.accent);
          text(slide, `${r.progress}%`, { x: colX[1] + colW[1] - 52, y: y + 1, w: 52, h: 22 }, { px: 15, bold: true, color: hex(t.ink), align: "right" });
        }
        text(slide, formatVndShort(r.value), { x: colX[2], y, w: colW[2], h: 24 }, { px: 16, color: hex(t.ink), align: "right" });
        text(slide, [
          { text: formatVndShort(r.profit), options: { color: hex(r.profit < 0 ? t.danger : t.success), fontSize: pt(16) } },
          { text: ` (${r.margin}%)`, options: { color: hex(t.muted), fontSize: pt(13) } },
        ], { x: colX[3], y, w: colW[3], h: 24 }, { align: "right" });
        text(slide, formatVndShort(r.receivable), { x: colX[4], y, w: colW[4], h: 24 }, { px: 16, color: hex(r.receivable > 0 ? t.danger : t.ink), align: "right" });
        rect(c, slide, { x: LEFT, y: y + 38, w: WIDTH, h: 1 }, t.panelBorder, false);
      });
      text(slide, `${s.scopeNote}. Lợi nhuận gộp = giá trị HĐ − chi phí đào tạo, khảo thí và chi phí khác.`, { x: LEFT, y: headY + 46 + s.rows.length * 50, w: WIDTH, h: 20 }, { px: 13, color: hex(t.muted) });
      return;
    }

    case "trend":
    case "hours": {
      const chartW = WIDTH - 284;
      panel(c, slide, { x: LEFT, y: TOP, w: chartW, h: 460 });
      const isTrend = s.kind === "trend";
      const data = isTrend
        ? [
            { name: "Tạo mới", labels: s.data.map((d) => d.label), values: s.data.map((d) => d.created) },
            { name: "Hoàn thành", labels: s.data.map((d) => d.label), values: s.data.map((d) => d.completed) },
            { name: "Dự án mới", labels: s.data.map((d) => d.label), values: s.data.map((d) => d.projects) },
          ]
        : [{ name: "Giờ công", labels: s.data.map((d) => d.label), values: s.data.map((d) => d.hours) }];
      slide.addChart(c.pres.ChartType.bar, data, {
        x: inch(LEFT + 16),
        y: inch(TOP + 16),
        w: inch(chartW - 32),
        h: inch(428),
        barDir: "col",
        barGrouping: "clustered",
        barGapWidthPct: 70,
        chartColors: isTrend ? [hex(t.chart.series[0]), hex(t.chart.series[1]), hex(t.chart.series[2])] : [hex(t.chart.series[0])],
        showLegend: isTrend,
        legendPos: "t",
        showTitle: !isTrend,
        title: "Giờ công theo thời gian",
        titleColor: hex(t.muted),
        titleFontFace: FONT,
        titleFontSize: 11,
        ...chartAxes(c, s.data.length),
      });
      const statH = isTrend ? 140 : 101;
      s.stats.forEach((st, i) => {
        const y = TOP + i * (statH + (isTrend ? 20 : 18));
        panel(c, slide, { x: LEFT + chartW + 24, y, w: 260, h: statH });
        text(slide, st.label, { x: LEFT + chartW + 46, y: y + 18, w: 216, h: 20 }, { px: 14, color: hex(t.muted) });
        text(slide, st.value, { x: LEFT + chartW + 46, y: y + 44, w: 216, h: 44 }, { px: 30, bold: true, color: hex(t.ink) });
      });
      return;
    }

    case "status": {
      const legend = statusLegend(s.data, t.chart);
      const shown = legend.filter((l) => l.count > 0);
      const total = legend.reduce((a, l) => a + l.count, 0);
      slide.addChart(c.pres.ChartType.doughnut, [{ name: "Trạng thái", labels: shown.map((l) => l.label), values: shown.map((l) => l.count) }], {
        x: inch(LEFT + 20),
        y: inch(TOP + 30),
        w: inch(380),
        h: inch(380),
        holeSize: 64,
        chartColors: shown.map((l) => hex(l.color)),
        dataBorder: { pt: 2, color: hex(t.bg) },
        showLegend: false,
        showPercent: false,
        showValue: false,
      });
      text(slide, String(total), { x: LEFT + 20, y: TOP + 180, w: 380, h: 50 }, { px: 44, bold: true, color: hex(t.ink), align: "center" });
      text(slide, "công việc", { x: LEFT + 20, y: TOP + 232, w: 380, h: 22 }, { px: 15, color: hex(t.muted), align: "center" });
      // A list with hairlines, as on screen.
      const lx = LEFT + 460;
      const lw = WIDTH - 460;
      const rowH = 66;
      const top = TOP + Math.max(0, (470 - legend.length * rowH) / 2);
      rect(c, slide, { x: lx, y: top, w: lw, h: 1 }, t.panelBorder, false);
      legend.forEach((l, i) => {
        const y = top + i * rowH;
        rect(c, slide, { x: lx + 4, y: y + 27, w: 12, h: 12 }, l.color, false);
        text(slide, l.label, { x: lx + 32, y: y + 20, w: lw - 240, h: 28 }, { px: 19, color: hex(t.ink) });
        text(slide, String(l.count), { x: lx + lw - 200, y: y + 17, w: 120, h: 32 }, { px: 24, bold: true, color: hex(t.ink), align: "right" });
        text(slide, `${l.pct}%`, { x: lx + lw - 70, y: y + 22, w: 66, h: 24 }, { px: 16, color: hex(t.muted), align: "right" });
        rect(c, slide, { x: lx, y: y + rowH, w: lw, h: 1 }, t.panelBorder, false);
      });
      return;
    }

    case "people": {
      const chartW = WIDTH - 424;
      panel(c, slide, { x: LEFT, y: TOP, w: chartW, h: 460 });
      // Horizontal bar charts draw the first category at the bottom; reverse so
      // the order matches the on-screen chart (first person on top).
      const rows = [...s.people].reverse();
      const labels = rows.map((p) => p.name);
      slide.addChart(
        c.pres.ChartType.bar,
        WORKLOAD_SERIES.map((ws) => ({ name: ws.label, labels, values: rows.map((p) => p[ws.key]) })),
        {
          x: inch(LEFT + 16),
          y: inch(TOP + 16),
          w: inch(chartW - 32),
          h: inch(428),
          barDir: "bar",
          barGrouping: "stacked",
          barGapWidthPct: 50,
          chartColors: WORKLOAD_SERIES.map((ws) => hex(t.chart.status[ws.status])),
          showLegend: true,
          legendPos: "t",
          ...chartAxes(c, labels.length),
          catAxisLabelFrequency: "1",
          catAxisLabelFontSize: 10,
        },
      );
      // Drawn with shapes + text rather than a table: some viewers (LibreOffice,
      // Google Slides) ignore table cell fills and fall back to a white style.
      const top = [...s.people].sort((a, b) => b.done - a.done || b.hours - a.hours).slice(0, 6);
      const tx = LEFT + chartW + 24;
      const rowH = 64;
      panel(c, slide, { x: tx, y: TOP, w: 400, h: 460 });
      text(slide, "Nhân sự", { x: tx + 22, y: TOP + 18, w: 200, h: 20 }, { px: 13, bold: true, color: hex(t.muted) });
      text(slide, "Hoàn thành", { x: tx + 214, y: TOP + 18, w: 80, h: 20 }, { px: 13, bold: true, color: hex(t.muted), align: "right" });
      text(slide, "Giờ công", { x: tx + 300, y: TOP + 18, w: 78, h: 20 }, { px: 13, bold: true, color: hex(t.muted), align: "right" });
      top.forEach((p, i) => {
        const y = TOP + 50 + i * rowH;
        rect(c, slide, { x: tx + 1, y: y - 1, w: 398, h: 1 }, t.panelBorder, false);
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(tx + 22), y: inch(y + 16), w: inch(32), h: inch(32), fill: { color: hex(p.avatarColor) }, line: { color: hex(p.avatarColor), width: 0 } });
        text(slide, initials(p.name), { x: tx + 22, y: y + 16, w: 32, h: 32 }, { px: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
        text(slide, [
          { text: p.name, options: { bold: true, color: hex(t.ink), fontSize: pt(16), breakLine: true } },
          { text: p.jobTitle ?? "", options: { color: hex(t.muted), fontSize: pt(12) } },
        ], { x: tx + 68, y: y + 12, w: 150, h: 42 }, { fit: "shrink" });
        text(slide, String(p.done), { x: tx + 214, y: y + 20, w: 80, h: 26 }, { px: 18, bold: true, color: hex(t.ink), align: "right" });
        text(slide, String(p.hours), { x: tx + 300, y: y + 22, w: 78, h: 24 }, { px: 16, color: hex(t.inkSecondary), align: "right" });
      });
      return;
    }

    case "risks": {
      panel(c, slide, { x: LEFT, y: TOP, w: 400, h: 460 });
      text(slide, "Công việc quá hạn", { x: LEFT + 24, y: TOP + 24, w: 352, h: 24 }, { px: 16, bold: true, color: hex(t.ink) });
      text(slide, String(s.overdueTotal), { x: LEFT + 24, y: TOP + 56, w: 352, h: 100 }, { px: 78, bold: true, color: hex(s.overdueTotal ? t.danger : t.ink) });
      s.byProject.slice(0, 5).forEach((p, i) => {
        const y = TOP + 184 + i * 38;
        rect(c, slide, { x: LEFT + 24, y: y + 8, w: 8, h: 8 }, p.color, false);
        text(slide, p.name, { x: LEFT + 44, y, w: 290, h: 24 }, { px: 16, color: hex(t.inkSecondary), fit: "shrink" });
        text(slide, String(p.overdue), { x: LEFT + 330, y, w: 46, h: 24 }, { px: 16, bold: true, color: hex(t.ink), align: "right" });
      });
      const x = LEFT + 424;
      const w = WIDTH - 424;
      panel(c, slide, { x, y: TOP, w, h: 460 });
      text(slide, "Hạn chót trong 14 ngày tới", { x: x + 24, y: TOP + 24, w: w - 48, h: 24 }, { px: 16, bold: true, color: hex(t.ink) });
      s.upcoming.forEach((u, i) => {
        const y = TOP + 64 + i * 64;
        const d = new Date(u.dueDate);
        slide.addShape(c.pres.ShapeType.roundRect, { x: inch(x + 24), y: inch(y), w: inch(52), h: inch(48), fill: { color: hex(t.panel) }, line: { color: hex(t.panelBorder), width: 0.75 }, rectRadius: 0.08 });
        text(slide, [
          { text: String(d.getDate()), options: { bold: true, fontSize: pt(18), color: hex(t.ink), breakLine: true } },
          { text: `Th${d.getMonth() + 1}`, options: { fontSize: pt(12), color: hex(t.muted) } },
        ], { x: x + 24, y: y + 4, w: 52, h: 42 }, { align: "center", valign: "middle" });
        text(slide, u.title, { x: x + 94, y: y + 4, w: w - 130, h: 24 }, { px: 16, bold: true, color: hex(t.ink), fit: "shrink" });
        text(slide, `${u.projectName}${u.assigneeName ? `, ${u.assigneeName}` : ""}`, { x: x + 94, y: y + 28, w: w - 130, h: 20 }, { px: 13, color: hex(t.muted) });
      });
      return;
    }

    case "quotes": {
      const w = (WIDTH - 24) / 2;
      s.quotes.forEach((q, i) => {
        const x = LEFT + (i % 2) * (w + 24);
        const y = TOP + Math.floor(i / 2) * (218 + 24);
        panel(c, slide, { x, y, w, h: 218 });
        text(slide, "“", { x: x + 22, y: y + 10, w: 40, h: 36 }, { px: 40, bold: true, color: hex(t.muted) });
        text(slide, q.content, { x: x + 24, y: y + 50, w: w - 48, h: 100 }, { px: 18, color: hex(t.ink), fit: "shrink" });
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(x + 24), y: inch(y + 163), w: inch(32), h: inch(32), fill: { color: hex(q.color) }, line: { color: hex(q.color), width: 0 } });
        text(slide, initials(q.author), { x: x + 24, y: y + 163, w: 32, h: 32 }, { px: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
        text(slide, [
          { text: q.author, options: { bold: true, color: hex(t.ink), fontSize: pt(15), breakLine: true } },
          { text: q.task, options: { color: hex(t.muted), fontSize: pt(13) } },
        ], { x: x + 70, y: y + 160, w: w - 170, h: 40 });
        text(slide, `${q.progress}%`, { x: x + w - 96, y: y + 168, w: 72, h: 24 }, { px: 15, bold: true, color: hex(t.inkSecondary), align: "right" });
      });
      return;
    }

    case "insights": {
      // A list with hairlines, as on screen.
      const rowH = 72;
      rect(c, slide, { x: LEFT, y: TOP, w: WIDTH, h: 1 }, t.panelBorder, false);
      s.items.slice(0, 6).forEach((it, i) => {
        const y = TOP + i * rowH;
        const color = it.tone === "good" ? t.success : it.tone === "warn" ? t.warning : t.muted;
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(LEFT + 4), y: inch(y + 25), w: inch(22), h: inch(22), fill: { color: hex(color) }, line: { color: hex(color), width: 0 } });
        text(slide, it.tone === "good" ? "✓" : it.tone === "warn" ? "!" : "i", { x: LEFT + 4, y: y + 25, w: 22, h: 22 }, { px: 13, bold: true, color: hex(t.bg), align: "center", valign: "middle" });
        text(slide, it.text, { x: LEFT + 44, y: y + 14, w: WIDTH - 52, h: 44 }, { px: 19, color: hex(t.ink), valign: "middle", fit: "shrink" });
        rect(c, slide, { x: LEFT, y: y + rowH, w: WIDTH, h: 1 }, t.panelBorder, false);
      });
      return;
    }

    case "bullets": {
      const big = s.bullets.length <= 5;
      text(
        slide,
        s.bullets.map((b) => ({ text: b, options: { bullet: { code: "2013", indent: pt(28) }, color: hex(t.ink), fontSize: pt(big ? 24 : 20), paraSpaceAfter: big ? 14 : 8 } })),
        { x: LEFT, y: TOP, w: WIDTH, h: 460 },
        { fit: "shrink" },
      );
      return;
    }

    case "cover":
      return;
  }
}

// Same as the screen cover: wordmark, title and subtitle, a hairline over who prepared it and when.
function renderCover(c: Ctx, slide: Slide, s: Extract<SlideModel, { kind: "cover" }>) {
  const { t, meta } = c;
  slide.addShape(c.pres.ShapeType.roundRect, { x: inch(96), y: inch(72), w: inch(30), h: inch(30), fill: { color: hex(t.ink) }, line: { color: hex(t.ink), width: 0 }, rectRadius: 0.07 });
  text(slide, "W", { x: 96, y: 72, w: 30, h: 30 }, { px: 16, bold: true, color: hex(t.bg), align: "center", valign: "middle" });
  text(slide, "WorkHub", { x: 138, y: 76, w: 300, h: 24 }, { px: 18, bold: true, color: hex(t.ink) });
  text(slide, s.title, { x: 96, y: 236, w: 900, h: 150 }, { px: 58, bold: true, color: hex(t.ink), fit: "shrink", valign: "bottom" });
  text(slide, s.subtitle, { x: 96, y: 400, w: 1000, h: 36 }, { px: 24, color: hex(t.inkSecondary) });
  rect(c, slide, { x: 96, y: 636, w: 1088, h: 1 }, t.panelBorder, false);
  text(slide, [
    { text: "Người lập: ", options: { color: hex(t.muted) } },
    { text: meta.preparedBy, options: { color: hex(t.ink), bold: true } },
    { text: "          Ngày lập: ", options: { color: hex(t.muted) } },
    { text: meta.generatedAt, options: { color: hex(t.ink), bold: true } },
  ], { x: 96, y: 652, w: 1000, h: 24 }, { px: 16 });
}

/** Insert a slide transition into every slide (pptxgenjs has no API for this). */
async function addTransitions(buffer: ArrayBuffer, kind: TransitionKind): Promise<Blob> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const xml = `<p:transition spd="med">${PPT_TRANSITION[kind]}</p:transition>`;
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  for (const f of slides) {
    const content = await zip.file(f)!.async("string");
    // PresentationML order: cSld, clrMapOvr, transition, timing — so insert right after clrMapOvr.
    if (!content.includes("<p:transition")) zip.file(f, content.replace("</p:clrMapOvr>", `</p:clrMapOvr>${xml}`));
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

export async function exportDeckPptx(deck: Deck, themeId: DeckTheme["id"], transition: TransitionKind, filename: string) {
  const { default: Pptx } = await import("pptxgenjs");
  const pres = new Pptx();
  pres.layout = "LAYOUT_WIDE";
  pres.title = deck.meta.title;
  pres.subject = `${deck.meta.scopeLabel} · ${deck.meta.periodLabel}`;
  pres.author = deck.meta.preparedBy;
  pres.company = "WorkHub";

  const c: Ctx = { pres, t: DECK_THEMES[themeId], meta: deck.meta };
  const total = deck.slides.length;
  deck.slides.forEach((s, i) => {
    const slide = pres.addSlide();
    slide.background = { color: hex(c.t.bg) };
    if (s.kind === "cover") renderCover(c, slide, s);
    else {
      chrome(c, slide, s, i, total);
      renderBody(c, slide, s);
    }
  });

  const buffer = (await pres.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  saveBlob(await addTransitions(buffer, transition), filename);
}
