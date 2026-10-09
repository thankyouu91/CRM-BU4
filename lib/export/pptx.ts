"use client";

import type PptxGenJS from "pptxgenjs";
import { DECK_THEMES, SLIDE_H, type DeckTheme } from "@/components/deck/theme";
import type { TransitionKind } from "@/components/deck/presenter";
import { WORKLOAD_SERIES, statusLegend } from "@/components/charts/charts";
import type { Deck, DeckMeta, SlideModel } from "@/lib/deck-model";
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
    rectRadius: 0.18,
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

function chrome(c: Ctx, slide: Slide, s: Exclude<SlideModel, { kind: "cover" }>, index: number, total: number) {
  const { t, meta } = c;
  rect(c, slide, { x: 0, y: 0, w: 220, h: 6 }, t.accent, false);
  text(slide, s.kicker.toUpperCase(), { x: 64, y: 48, w: 900, h: 22 }, { px: 14, bold: true, color: hex(t.accent), charSpacing: 2 });
  text(slide, s.title, { x: 64, y: 74, w: 1000, h: 54 }, { px: 36, bold: true, color: hex(t.ink), fit: "shrink" });
  text(slide, `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, { x: 1016, y: 48, w: 200, h: 22 }, { px: 15, bold: true, color: hex(t.muted), align: "right" });
  text(slide, `${meta.scopeLabel} · ${meta.periodLabel}`, { x: 64, y: 676, w: 700, h: 20 }, { px: 13, color: hex(t.muted) });
  text(slide, `WorkHub · ${meta.generatedAt}`, { x: 816, y: 676, w: 400, h: 20 }, { px: 13, color: hex(t.muted), align: "right" });
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
        text(slide, it.label, { x: x + 24, y: y + 24, w: w - 48, h: 24 }, { px: 17, color: hex(t.muted) });
        text(slide, it.value, { x: x + 24, y: y + 64, w: w - 48, h: 72 }, {
          px: 60,
          bold: true,
          color: hex(it.tone === "danger" ? t.danger : it.tone === "accent" ? t.accent : t.ink),
        });
        if (it.sub) text(slide, it.sub, { x: x + 24, y: y + 150, w: w - 48, h: 22 }, { px: 15, color: hex(t.inkSecondary) });
      });
      return;
    }

    case "projects": {
      const tight = s.rows.length > 5;
      const rowH = tight ? 56 : 76;
      s.rows.forEach((r, i) => {
        const y = TOP + i * rowH;
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(LEFT), y: inch(y + 7), w: inch(14), h: inch(14), fill: { color: hex(r.color) }, line: { color: hex(r.color), width: 0 } });
        text(slide, [
          { text: r.name, options: { bold: true, color: hex(t.ink), fontSize: pt(21) } },
          { text: `   ${r.status}`, options: { color: hex(t.accent), fontSize: pt(13), bold: true } },
        ], { x: LEFT + 26, y: y, w: 760, h: 28 });
        text(slide, [
          { text: `${r.done}/${r.total} việc`, options: { color: hex(t.muted), fontSize: pt(15) } },
          ...(r.overdue ? [{ text: `   ${r.overdue} quá hạn`, options: { color: hex(t.danger), fontSize: pt(15), bold: true } }] : []),
          { text: `   ${r.progress}%`, options: { color: hex(t.ink), fontSize: pt(24), bold: true } },
        ], { x: LEFT + 760, y: y - 2, w: WIDTH - 760, h: 30 }, { align: "right" });
        const barY = y + 36;
        const barH = tight ? 10 : 14;
        rect(c, slide, { x: LEFT, y: barY, w: WIDTH, h: barH }, t.track);
        if (r.progress > 0) rect(c, slide, { x: LEFT, y: barY, w: (WIDTH * r.progress) / 100, h: barH }, t.accent);
      });
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
        chartColors: isTrend ? [hex(t.chart.series[0]), hex(t.chart.series[1])] : [hex(t.chart.series[0])],
        showLegend: isTrend,
        legendPos: "t",
        showTitle: !isTrend,
        title: "Giờ công theo thời gian",
        titleColor: hex(t.inkSecondary),
        titleFontFace: FONT,
        titleFontSize: 11,
        ...chartAxes(c, s.data.length),
      });
      const statH = isTrend ? 140 : 101;
      s.stats.forEach((st, i) => {
        const y = TOP + i * (statH + (isTrend ? 20 : 18));
        panel(c, slide, { x: LEFT + chartW + 24, y, w: 260, h: statH });
        text(slide, st.label, { x: LEFT + chartW + 46, y: y + 18, w: 216, h: 20 }, { px: 14, color: hex(t.muted) });
        text(slide, st.value, { x: LEFT + chartW + 46, y: y + 44, w: 216, h: 44 }, { px: 32, bold: true, color: hex(t.ink) });
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
      legend.forEach((l, i) => {
        const y = TOP + 6 + i * 88;
        const x = LEFT + 460;
        const w = WIDTH - 460;
        panel(c, slide, { x, y, w, h: 72 });
        rect(c, slide, { x: x + 22, y: y + 28, w: 16, h: 16 }, l.color, false);
        text(slide, l.label, { x: x + 54, y: y + 22, w: w - 260, h: 30 }, { px: 20, color: hex(t.ink) });
        text(slide, String(l.count), { x: x + w - 200, y: y + 18, w: 100, h: 36 }, { px: 26, bold: true, color: hex(t.ink), align: "right" });
        text(slide, `${l.pct}%`, { x: x + w - 90, y: y + 24, w: 66, h: 26 }, { px: 17, color: hex(t.muted), align: "right" });
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
      const top = [...s.people].sort((a, b) => b.done - a.done || b.hours - a.hours).slice(0, 6);
      const headerOpts = { bold: true, color: hex(t.muted), fontSize: pt(13), fontFace: FONT };
      const cell = (v: string, align: "left" | "right" = "left", bold = false) => ({
        text: v,
        options: { align, bold, color: hex(t.ink), fontSize: pt(15), fontFace: FONT },
      });
      slide.addTable(
        [
          [
            { text: "Nhân sự", options: headerOpts },
            { text: "Hoàn thành", options: { ...headerOpts, align: "right" as const } },
            { text: "Giờ công", options: { ...headerOpts, align: "right" as const } },
          ],
          ...top.map((p) => [cell(p.name, "left", true), cell(String(p.done), "right", true), cell(String(p.hours), "right")]),
        ],
        {
          x: inch(LEFT + chartW + 24),
          y: inch(TOP),
          w: inch(400),
          colW: [inch(220), inch(90), inch(90)],
          rowH: inch(54),
          fill: { color: hex(t.panel) },
          border: { type: "solid", pt: 0.5, color: hex(t.panelBorder) },
          valign: "middle",
          margin: 0.08,
        },
      );
      return;
    }

    case "risks": {
      panel(c, slide, { x: LEFT, y: TOP, w: 400, h: 460 });
      text(slide, "Công việc quá hạn", { x: LEFT + 24, y: TOP + 24, w: 352, h: 24 }, { px: 17, bold: true, color: hex(t.danger) });
      text(slide, String(s.overdueTotal), { x: LEFT + 24, y: TOP + 56, w: 352, h: 100 }, { px: 84, bold: true, color: hex(s.overdueTotal ? t.danger : t.ink) });
      s.byProject.slice(0, 5).forEach((p, i) => {
        const y = TOP + 184 + i * 38;
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(LEFT + 24), y: inch(y + 6), w: inch(10), h: inch(10), fill: { color: hex(p.color) }, line: { color: hex(p.color), width: 0 } });
        text(slide, p.name, { x: LEFT + 44, y, w: 290, h: 24 }, { px: 16, color: hex(t.inkSecondary), fit: "shrink" });
        text(slide, String(p.overdue), { x: LEFT + 330, y, w: 46, h: 24 }, { px: 16, bold: true, color: hex(t.ink), align: "right" });
      });
      const x = LEFT + 424;
      const w = WIDTH - 424;
      panel(c, slide, { x, y: TOP, w, h: 460 });
      text(slide, "Hạn chót trong 14 ngày tới", { x: x + 24, y: TOP + 24, w: w - 48, h: 24 }, { px: 17, bold: true, color: hex(t.ink) });
      s.upcoming.forEach((u, i) => {
        const y = TOP + 64 + i * 64;
        const d = new Date(u.dueDate);
        slide.addShape(c.pres.ShapeType.roundRect, { x: inch(x + 24), y: inch(y), w: inch(54), h: inch(50), fill: { color: hex(t.accentSoft) }, line: { color: hex(t.accentSoft), width: 0 }, rectRadius: 0.12 });
        text(slide, [
          { text: String(d.getDate()), options: { bold: true, fontSize: pt(20), color: hex(t.accent), breakLine: true } },
          { text: `Th${d.getMonth() + 1}`, options: { fontSize: pt(11), color: hex(t.accent) } },
        ], { x: x + 24, y: y + 4, w: 54, h: 44 }, { align: "center", valign: "middle" });
        text(slide, u.title, { x: x + 94, y: y + 4, w: w - 130, h: 24 }, { px: 17, bold: true, color: hex(t.ink), fit: "shrink" });
        text(slide, `${u.projectName}${u.assigneeName ? ` · ${u.assigneeName}` : ""}`, { x: x + 94, y: y + 28, w: w - 130, h: 20 }, { px: 13, color: hex(t.muted) });
      });
      return;
    }

    case "quotes": {
      const w = (WIDTH - 24) / 2;
      s.quotes.forEach((q, i) => {
        const x = LEFT + (i % 2) * (w + 24);
        const y = TOP + Math.floor(i / 2) * (218 + 24);
        panel(c, slide, { x, y, w, h: 218 });
        text(slide, "“", { x: x + 22, y: y + 6, w: 40, h: 40 }, { px: 48, bold: true, color: hex(t.accent) });
        text(slide, q.content, { x: x + 24, y: y + 50, w: w - 48, h: 100 }, { px: 18, color: hex(t.ink), fit: "shrink" });
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(x + 24), y: inch(y + 162), w: inch(34), h: inch(34), fill: { color: hex(q.color) }, line: { color: hex(q.color), width: 0 } });
        text(slide, initials(q.author), { x: x + 24, y: y + 162, w: 34, h: 34 }, { px: 12, bold: true, color: "FFFFFF", align: "center", valign: "middle" });
        text(slide, [
          { text: q.author, options: { bold: true, color: hex(t.ink), fontSize: pt(15), breakLine: true } },
          { text: q.task, options: { color: hex(t.muted), fontSize: pt(13) } },
        ], { x: x + 70, y: y + 160, w: w - 170, h: 40 });
        text(slide, `${q.progress}%`, { x: x + w - 96, y: y + 168, w: 72, h: 24 }, { px: 15, bold: true, color: hex(t.accent), align: "right" });
      });
      return;
    }

    case "insights": {
      s.items.slice(0, 6).forEach((it, i) => {
        const y = TOP + i * 76;
        panel(c, slide, { x: LEFT, y, w: WIDTH, h: 64 });
        const color = it.tone === "good" ? t.success : it.tone === "warn" ? t.warning : t.accent;
        slide.addShape(c.pres.ShapeType.ellipse, { x: inch(LEFT + 22), y: inch(y + 20), w: inch(24), h: inch(24), fill: { color: hex(color) }, line: { color: hex(color), width: 0 } });
        text(slide, it.tone === "good" ? "✓" : it.tone === "warn" ? "!" : "i", { x: LEFT + 22, y: y + 20, w: 24, h: 24 }, { px: 14, bold: true, color: hex(t.bg), align: "center", valign: "middle" });
        text(slide, it.text, { x: LEFT + 64, y: y + 12, w: WIDTH - 88, h: 40 }, { px: 19, color: hex(t.ink), valign: "middle", fit: "shrink" });
      });
      return;
    }

    case "bullets": {
      const big = s.bullets.length <= 5;
      text(
        slide,
        s.bullets.map((b) => ({ text: b, options: { bullet: { indent: pt(24) }, color: hex(t.ink), fontSize: pt(big ? 26 : 22), paraSpaceAfter: big ? 14 : 8 } })),
        { x: LEFT, y: TOP, w: WIDTH, h: 460 },
        { fit: "shrink" },
      );
      return;
    }

    case "cover":
      return;
  }
}

function renderCover(c: Ctx, slide: Slide, s: Extract<SlideModel, { kind: "cover" }>) {
  const { t, meta } = c;
  slide.addShape(c.pres.ShapeType.ellipse, {
    x: inch(1280 - 460 + 35),
    y: inch(-160 + 35),
    w: inch(550),
    h: inch(550),
    fill: { type: "solid", color: hex(t.bg), transparency: 100 },
    line: { color: hex(t.accentSoft), width: 52 },
  });
  slide.addShape(c.pres.ShapeType.ellipse, {
    x: inch(1280 - 120 - 420 + 1),
    y: inch(720 - 200),
    w: inch(420),
    h: inch(420),
    fill: { type: "solid", color: hex(t.bg), transparency: 100 },
    line: { color: hex(t.panelBorder), width: 1.5 },
  });
  rect(c, slide, { x: 0, y: 0, w: 10, h: SLIDE_H }, t.accent, false);
  text(slide, "WORKHUB · BÁO CÁO", { x: 96, y: 200, w: 800, h: 24 }, { px: 16, bold: true, color: hex(t.accent), charSpacing: 3 });
  text(slide, s.title, { x: 96, y: 238, w: 820, h: 160 }, { px: 62, bold: true, color: hex(t.ink), fit: "shrink" });
  text(slide, s.subtitle, { x: 96, y: 410, w: 820, h: 40 }, { px: 26, color: hex(t.inkSecondary) });
  text(slide, [
    { text: "Người lập: ", options: { color: hex(t.muted) } },
    { text: meta.preparedBy, options: { color: hex(t.ink), bold: true } },
    { text: "      Ngày lập: ", options: { color: hex(t.muted) } },
    { text: meta.generatedAt, options: { color: hex(t.ink), bold: true } },
  ], { x: 96, y: 500, w: 820, h: 26 }, { px: 17 });
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
