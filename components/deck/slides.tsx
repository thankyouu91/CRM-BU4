"use client";

import { motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, Quote, TriangleAlert } from "lucide-react";
import { HoursChart, StatusDonut, TrendChart, WorkloadChart, WORKLOAD_SERIES, statusLegend } from "@/components/charts/charts";
import { clipName, PROJECTS_LIST_MAX, type DeckMeta, type SlideModel, type WorkTone } from "@/lib/deck-model";
import { initials } from "@/lib/utils";
import { formatVndShort } from "@/lib/finance";
import { SLIDE_H, SLIDE_W, type DeckTheme } from "./theme";

interface Ctx {
  theme: DeckTheme;
  animate: boolean;
}

/** A short fade when presenting; a plain box when exporting. */
function Reveal({ i = 0, ctx, children, style, className }: { i?: number; ctx: Ctx; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  if (!ctx.animate) return <div style={style} className={className}>{children}</div>;
  return (
    <motion.div
      style={style}
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + i * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// One scale for every slide (px at 1280×720): title 34, hero figure 56, figure 24–32,
// body 16–20, label 14–15, note 13. Figures use tabular digits so columns line up.
const NUM: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };

function Panel({ theme, children, style }: { theme: DeckTheme; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.panelBorder}`, borderRadius: 12, padding: 24, ...style }}>{children}</div>
  );
}

function Bar({ value, theme, color, height = 8 }: { value: number; theme: DeckTheme; color?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: theme.track, overflow: "hidden" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", borderRadius: height, background: color ?? theme.accent }} />
    </div>
  );
}

function LegendRow({ items, theme }: { items: { label: string; color: string }[]; theme: DeckTheme }) {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: theme.inkSecondary }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: DeckTheme }) {
  return (
    <Panel theme={theme} style={{ padding: "16px 20px" }}>
      <div style={{ fontSize: 14, color: theme.muted }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 600, color: theme.ink, marginTop: 6, ...NUM }}>{value}</div>
    </Panel>
  );
}

/** Inline figures above a list: "13 dự án   2 đã xong ...", the number carries the status colour. */
function Figures({ items, theme }: { items: { value: string | number; label: string; color?: string }[]; theme: DeckTheme }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 28, flexWrap: "wrap", fontSize: 15, color: theme.muted }}>
      {items.map((it) => (
        <span key={it.label} style={{ whiteSpace: "nowrap" }}>
          <b style={{ fontSize: 18, fontWeight: 600, color: it.color ?? theme.ink, ...NUM }}>{it.value}</b> {it.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slide bodies
// ---------------------------------------------------------------------------

/** Status as a coloured dot and a neutral label, like the app's badges. */
function StatusPill({ label, color, theme, size = 13 }: { label: string; color: string; theme: DeckTheme; size?: number }) {
  return (
    <span style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, fontSize: size, color: theme.inkSecondary, fontWeight: 500, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: color }} />
      {label}
    </span>
  );
}

const toneColor = (t: DeckTheme, tone: WorkTone | undefined) =>
  tone === "success" ? t.success : tone === "danger" ? t.danger : tone === "warning" ? t.warning : tone === "accent" ? t.ink : t.muted;

/** Weekly report: figures, then tasks grouped by project in two columns. */
function WeekBody({ slide, ctx }: { slide: Extract<SlideModel, { kind: "week" }>; ctx: Ctx }) {
  const t = ctx.theme;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>
      <Reveal ctx={ctx} style={{ display: "flex", alignItems: "baseline", gap: 28, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: t.ink, ...NUM }}>{slide.period}</span>
        <Figures theme={t} items={slide.stats.map((st) => ({ value: st.value, label: st.label, color: st.value ? (st.tone ? toneColor(t, st.tone) : t.ink) : t.muted }))} />
      </Reveal>
      {slide.columns.length === 0 ? (
        <Reveal i={1} ctx={ctx} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: t.muted }}>
          Không có công việc nào trong mục này.
        </Reveal>
      ) : (
        // minmax(0, 1fr): a long line must not widen its column past the slide.
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", columnGap: 40, flex: 1 }}>
          {slide.columns.map((col, c) => (
            <div key={c} style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              {col.map((line, i) =>
                line.kind === "project" ? (
                  <Reveal key={i} i={1 + c * 0.5 + i * 0.15} ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 10, height: 34, marginTop: i ? 4 : 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: line.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>{line.name}</span>
                    <span style={{ fontSize: 13, color: t.muted, whiteSpace: "nowrap" }}>{line.continued ? "(tiếp)" : `${line.count} việc`}</span>
                  </Reveal>
                ) : (
                  <Reveal key={i} i={1 + c * 0.5 + i * 0.15} ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 10, height: 34, paddingLeft: 20, borderLeft: `1px solid ${t.panelBorder}`, marginLeft: 4 }}>
                    <span style={{ fontSize: 15, color: t.inkSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{line.title}</span>
                    <span style={{ fontSize: 12, color: t.muted, whiteSpace: "nowrap", flexShrink: 0 }}>{line.who}</span>
                    <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 13, fontWeight: 500, color: toneColor(t, line.tone), whiteSpace: "nowrap", ...NUM }}>{line.tag}</span>
                  </Reveal>
                ),
              )}
            </div>
          ))}
        </div>
      )}
      {slide.hidden > 0 && (
        <p style={{ fontSize: 13, color: t.muted }}>… và {slide.hidden} việc khác: xem đầy đủ ở Báo cáo công việc phòng hoặc file Excel.</p>
      )}
    </div>
  );
}

function ProjectsBody({ slide, ctx }: { slide: Extract<SlideModel, { kind: "projects" }>; ctx: Ctx }) {
  const t = ctx.theme;
  const sm = slide.summary;
  const figures = [
    { value: sm.total, label: "dự án" },
    sm.complete > 0 && { value: sm.complete, label: "đã xong toàn bộ việc", color: t.success },
    sm.overdue > 0 && { value: sm.overdue, label: "có việc quá hạn", color: t.danger },
    sm.empty > 0 && { value: sm.empty, label: "chưa có công việc", color: t.muted },
  ].filter((c): c is { value: number; label: string; color?: string } => !!c);
  const count = (r: (typeof slide.rows)[number]) => (r.total ? `${r.done}/${r.total} việc` : "Chưa có việc");
  const list = slide.rows.length <= PROJECTS_LIST_MAX;
  const perColumn = Math.ceil(slide.rows.length / 2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: list ? 22 : 18, height: "100%" }}>
      <Reveal ctx={ctx}>
        <Figures theme={t} items={figures} />
      </Reveal>
      {list ? (
        <div style={{ display: "flex", flexDirection: "column", gap: slide.rows.length > 4 ? 16 : 24 }}>
          {slide.rows.map((r, i) => (
            <Reveal key={`${r.name}-${i}`} i={i + 1} ctx={ctx}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <span style={{ flexShrink: 0, width: 10, height: 10, borderRadius: 2, background: r.color }} />
                  <span style={{ fontSize: 20, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>{clipName(r.name, 60)}</span>
                  <StatusPill label={r.status} color={r.statusColor} theme={t} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 18, flexShrink: 0, ...NUM }}>
                  <span style={{ fontSize: 15, color: t.muted }}>{count(r)}</span>
                  {r.overdue > 0 && <span style={{ fontSize: 15, color: t.danger, fontWeight: 500 }}>{r.overdue} quá hạn</span>}
                  <span style={{ fontSize: 24, fontWeight: 600, color: r.total ? t.ink : t.muted, minWidth: 70, textAlign: "right" }}>{r.total ? `${r.progress}%` : "–"}</span>
                </div>
              </div>
              <Bar value={r.progress} theme={t} height={slide.rows.length > 4 ? 6 : 8} />
            </Reveal>
          ))}
        </div>
      ) : (
        // Two columns, read down: the left column first.
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gridTemplateRows: `repeat(${perColumn}, auto)`, gridAutoFlow: "column", columnGap: 40, rowGap: 14 }}>
          {slide.rows.map((r, i) => (
            <Reveal key={`${r.name}-${i}`} i={1 + i * 0.4} ctx={ctx}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 2, background: r.color }} />
                <span style={{ fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>{clipName(r.name, 38)}</span>
                <StatusPill label={r.status} color={r.statusColor} theme={t} size={12} />
                <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 13, color: r.overdue ? t.danger : t.muted, fontWeight: r.overdue ? 500 : 400, whiteSpace: "nowrap", ...NUM }}>
                  {r.overdue ? `${r.overdue} quá hạn, ` : ""}
                  {count(r)}
                </span>
                <span style={{ flexShrink: 0, width: 52, textAlign: "right", fontSize: 18, fontWeight: 600, color: r.total ? t.ink : t.muted, ...NUM }}>{r.total ? `${r.progress}%` : "–"}</span>
              </div>
              <Bar value={r.progress} theme={t} height={5} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}


function Body({ slide, ctx }: { slide: SlideModel; ctx: Ctx }) {
  const t = ctx.theme;
  switch (slide.kind) {
    case "kpis":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {slide.items.map((it, i) => (
            <Reveal key={it.label} i={i} ctx={ctx}>
              <Panel theme={t} style={{ height: 196, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontSize: 16, color: t.muted, fontWeight: 500 }}>{it.label}</div>
                <div style={{ fontSize: 56, fontWeight: 600, lineHeight: 1, letterSpacing: -1, color: it.tone === "danger" ? t.danger : t.ink, ...NUM }}>{it.value}</div>
                <div style={{ fontSize: 15, color: t.muted }}>{it.sub}</div>
              </Panel>
            </Reveal>
          ))}
        </div>
      );

    case "projects":
      return <ProjectsBody slide={slide} ctx={ctx} />;

    case "week":
      return <WeekBody slide={slide} ctx={ctx} />;

    case "schedule": {
      const w = slide.workload;
      const parts = [
        { label: "Đã hoàn thành", value: w.done, color: t.chart.status.DONE },
        { label: "Đang làm", value: w.inProgress, color: t.chart.status.IN_PROGRESS },
        { label: "Chưa bắt đầu", value: w.notStarted, color: t.chart.status.TODO },
        { label: "Bị chặn", value: w.blocked, color: t.chart.status.BLOCKED },
      ].filter((p) => p.value > 0);
      const pct = (v: number) => (w.total ? Math.round((v / w.total) * 100) : 0);
      const tight = slide.rows.length > 5;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 28 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: tight ? 12 : 18 }}>
            {slide.rows.map((r, i) => (
              <Reveal key={`${r.level}-${r.name}-${i}`} i={i} ctx={ctx} style={{ paddingLeft: r.level === 2 ? 28 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10, lineHeight: 1.3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: r.level === 0 ? 5 : 2, background: r.color, flexShrink: 0 }} />
                    <span style={{ fontSize: r.level === 0 ? 18 : 16, fontWeight: r.level === 2 ? 500 : 600, color: t.ink, whiteSpace: "nowrap" }}>
                      {r.level === 2 ? "└ " : ""}
                      {r.name}
                    </span>
                    <StatusPill label={r.status} color={r.statusColor} theme={t} />
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, whiteSpace: "nowrap", ...NUM }}>
                    <span style={{ fontSize: 13, color: t.muted }}>{r.deadline}</span>
                    {r.planned !== null && <span style={{ fontSize: 13, color: t.muted }}>KH {r.planned}%</span>}
                    <span style={{ fontSize: 20, fontWeight: 600, color: t.ink, minWidth: 56, textAlign: "right" }}>{r.progress}%</span>
                  </div>
                </div>
                <div style={{ position: "relative" }}>
                  <Bar value={r.progress} theme={t} height={tight ? 6 : 8} />
                  {/* The plan tick keeps a ring of the slide colour so it reads on top of the bar too. */}
                  {r.planned !== null && (
                    <span style={{ position: "absolute", top: -4, bottom: -4, left: `calc(${r.planned}% - 1px)`, width: 3, borderRadius: 2, background: t.ink, boxShadow: `0 0 0 2px ${t.bg}` }} />
                  )}
                </div>
              </Reveal>
            ))}
            <div style={{ fontSize: 13, color: t.muted, marginTop: 4 }}>Thanh: thực tế. Vạch đứng: kế hoạch đến hôm nay (KH).</div>
          </div>
          <Reveal i={slide.rows.length} ctx={ctx}>
            <Panel theme={t} style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.ink }}>Khối lượng công việc</div>
              <div>
                <div style={{ fontSize: 14, color: t.muted }}>Tổng khối lượng</div>
                <div style={{ fontSize: 44, fontWeight: 600, color: t.ink, lineHeight: 1.1, ...NUM }}>{w.total}</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, color: t.muted }}>Đã làm</div>
                  <div style={{ fontSize: 28, fontWeight: 600, color: t.success, ...NUM }}>
                    {w.done} <span style={{ fontSize: 15, color: t.muted, fontWeight: 500 }}>{pct(w.done)}%</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 14, color: t.muted }}>Cần làm</div>
                  <div style={{ fontSize: 28, fontWeight: 600, color: t.ink, ...NUM }}>
                    {w.remaining} <span style={{ fontSize: 15, color: t.muted, fontWeight: 500 }}>{pct(w.remaining)}%</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", height: 10, borderRadius: 5, overflow: "hidden", gap: 2, background: t.track }}>
                {parts.map((p) => (
                  <span key={p.label} style={{ width: `${pct(p.value)}%`, background: p.color }} />
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {parts.map((p) => (
                  <div key={p.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: t.inkSecondary }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: p.color }} />
                    <span style={{ flex: 1 }}>{p.label}</span>
                    <span style={{ fontWeight: 600, color: t.ink, ...NUM }}>{p.value}</span>
                  </div>
                ))}
              </div>
              {w.overdue > 0 && <div style={{ fontSize: 15, fontWeight: 500, color: t.danger }}>{w.overdue} việc đã quá hạn</div>}
            </Panel>
          </Reveal>
        </div>
      );
    }

    case "finance": {
      const f = slide.totals;
      const tiles = [
        { label: "Giá trị hợp đồng", value: formatVndShort(f.value), sub: `${f.count} hợp đồng`, color: t.ink },
        { label: "Chi phí thực hiện", value: formatVndShort(f.totalCost), sub: `Tỷ lệ chi phí ${f.costRatio}%`, color: t.ink },
        { label: "Lợi nhuận gộp", value: formatVndShort(f.profit), sub: `Tỷ suất ${f.margin}%${f.estimated ? `, ${f.estimated} HĐ ước tính` : ""}`, color: f.profit < 0 ? t.danger : t.success },
        { label: "Còn phải thu", value: formatVndShort(f.receivable), sub: `Đã thu ${formatVndShort(f.collected)}`, color: f.receivable > 0 ? t.danger : t.ink },
      ];
      const cols = "1.6fr 1.1fr 0.9fr 1fr 1fr";
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
            {tiles.map((it, i) => (
              <Reveal key={it.label} i={i} ctx={ctx}>
                <Panel theme={t} style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 14, color: t.muted }}>{it.label}</div>
                  <div style={{ fontSize: 32, fontWeight: 600, color: it.color, marginTop: 6, lineHeight: 1.15, ...NUM }}>{it.value}</div>
                  <div style={{ fontSize: 13, color: t.muted, marginTop: 6 }}>{it.sub}</div>
                </Panel>
              </Reveal>
            ))}
          </div>
          <Reveal i={4} ctx={ctx}>
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, fontSize: 13, color: t.muted, padding: "0 4px 8px", borderBottom: `1px solid ${t.panelBorder}` }}>
              <span>Dự án</span>
              <span>Tiến độ công việc</span>
              <span style={{ textAlign: "right" }}>Giá trị HĐ</span>
              <span style={{ textAlign: "right" }}>Lợi nhuận (tỷ suất)</span>
              <span style={{ textAlign: "right" }}>Còn phải thu</span>
            </div>
            {slide.rows.map((r) => (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center", padding: "11px 4px", borderBottom: `1px solid ${t.panelBorder}`, lineHeight: 1.3 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                  {r.name}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {r.progress === null ? (
                    <span style={{ fontSize: 14, color: t.muted }}>–</span>
                  ) : (
                    <>
                      <span style={{ flex: 1 }}>
                        <Bar value={r.progress} theme={t} height={6} />
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: t.ink, minWidth: 44, textAlign: "right", ...NUM }}>{r.progress}%</span>
                    </>
                  )}
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: t.ink, textAlign: "right", ...NUM }}>{formatVndShort(r.value)}</span>
                <span style={{ fontSize: 16, fontWeight: 500, color: r.profit < 0 ? t.danger : t.success, textAlign: "right", ...NUM }}>
                  {formatVndShort(r.profit)} <span style={{ fontSize: 13, color: t.muted, fontWeight: 400 }}>({r.margin}%)</span>
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: r.receivable > 0 ? t.danger : t.ink, textAlign: "right", ...NUM }}>{formatVndShort(r.receivable)}</span>
              </div>
            ))}
            <div style={{ fontSize: 13, color: t.muted, marginTop: 10 }}>{slide.scopeNote}. Lợi nhuận gộp = giá trị HĐ − chi phí đào tạo, khảo thí và chi phí khác.</div>
          </Reveal>
        </div>
      );
    }

    case "trend":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
          <Reveal ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <LegendRow theme={t} items={[{ label: "Việc tạo mới", color: t.chart.series[0] }, { label: "Việc hoàn thành", color: t.chart.series[1] }, { label: "Dự án mới", color: t.chart.series[2] }]} />
              <div style={{ marginTop: 16 }}>
                <TrendChart data={slide.data} width={820} height={370} animate={ctx.animate} theme={t.chart} />
              </div>
            </Panel>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {slide.stats.map((s, i) => (
              <Reveal key={s.label} i={i + 1} ctx={ctx}>
                <Stat label={s.label} value={s.value} theme={t} />
              </Reveal>
            ))}
          </div>
        </div>
      );

    case "hours":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
          <Reveal ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <div style={{ fontSize: 14, color: t.muted }}>Giờ công theo thời gian</div>
              <div style={{ marginTop: 16 }}>
                <HoursChart data={slide.data} width={820} height={380} animate={ctx.animate} theme={t.chart} />
              </div>
            </Panel>
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {slide.stats.map((s, i) => (
              <Reveal key={s.label} i={i + 1} ctx={ctx}>
                <Stat label={s.label} value={s.value} theme={t} />
              </Reveal>
            ))}
          </div>
        </div>
      );

    case "status": {
      const legend = statusLegend(slide.data, t.chart);
      return (
        <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 40, alignItems: "center" }}>
          <Reveal ctx={ctx} style={{ display: "flex", justifyContent: "center" }}>
            <StatusDonut data={slide.data} size={380} animate={ctx.animate} theme={t.chart} />
          </Reveal>
          <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.panelBorder}` }}>
            {legend.map((s, i) => (
              <Reveal key={s.label} i={i + 1} ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 4px", borderBottom: `1px solid ${t.panelBorder}` }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: s.color }} />
                <span style={{ flex: 1, fontSize: 19, color: t.ink }}>{s.label}</span>
                <span style={{ fontSize: 24, fontWeight: 600, color: t.ink, ...NUM }}>{s.count}</span>
                <span style={{ width: 64, textAlign: "right", fontSize: 16, color: t.muted, ...NUM }}>{s.pct}%</span>
              </Reveal>
            ))}
          </div>
        </div>
      );
    }

    case "people": {
      const top = [...slide.people].sort((a, b) => b.done - a.done || b.hours - a.hours).slice(0, 5);
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24 }}>
          <Reveal ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <LegendRow theme={t} items={WORKLOAD_SERIES.map((s) => ({ label: s.label, color: t.chart.status[s.status] }))} />
              <div style={{ marginTop: 16 }}>
                <WorkloadChart data={slide.people} width={680} height={370} animate={ctx.animate} theme={t.chart} />
              </div>
            </Panel>
          </Reveal>
          <Reveal i={1} ctx={ctx}>
            <Panel theme={t} style={{ height: 460, padding: 0, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", padding: "16px 22px", fontSize: 13, color: t.muted, borderBottom: `1px solid ${t.panelBorder}` }}>
                <span>Nhân sự</span>
                <span style={{ textAlign: "right" }}>Hoàn thành</span>
                <span style={{ textAlign: "right" }}>Giờ công</span>
              </div>
              {top.map((p) => (
                <div key={p.userId} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px", alignItems: "center", padding: "14px 22px", borderBottom: `1px solid ${t.panelBorder}` }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                    <span style={{ width: 32, height: 32, borderRadius: 16, background: p.avatarColor, color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {initials(p.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: t.muted }}>{p.jobTitle ?? ""}</span>
                    </span>
                  </span>
                  <span style={{ textAlign: "right", fontSize: 18, fontWeight: 600, color: t.ink, ...NUM }}>{p.done}</span>
                  <span style={{ textAlign: "right", fontSize: 16, color: t.inkSecondary, ...NUM }}>{p.hours}</span>
                </div>
              ))}
            </Panel>
          </Reveal>
        </div>
      );
    }

    case "risks":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "400px 1fr", gap: 24 }}>
          <Reveal ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.ink, fontSize: 16, fontWeight: 600 }}>
                <TriangleAlert size={18} color={slide.overdueTotal ? t.danger : t.muted} /> Công việc quá hạn
              </div>
              <div style={{ fontSize: 80, fontWeight: 600, color: slide.overdueTotal ? t.danger : t.ink, lineHeight: 1.1, marginTop: 12, letterSpacing: -1.5, ...NUM }}>{slide.overdueTotal}</div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {slide.byProject.slice(0, 5).map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, color: t.inkSecondary }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontWeight: 600, color: t.ink, ...NUM }}>{p.overdue}</span>
                  </div>
                ))}
                {slide.byProject.length === 0 && <div style={{ fontSize: 16, color: t.success }}>Không có công việc trễ hạn.</div>}
              </div>
            </Panel>
          </Reveal>
          <Reveal i={1} ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: t.ink }}>Hạn chót trong 14 ngày tới</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
                {slide.upcoming.map((u) => {
                  const d = new Date(u.dueDate);
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "11px 0", borderBottom: `1px solid ${t.panelBorder}` }}>
                      <div style={{ width: 52, height: 48, borderRadius: 8, border: `1px solid ${t.panelBorder}`, color: t.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 18, fontWeight: 600, lineHeight: 1, ...NUM }}>{d.getDate()}</span>
                        <span style={{ fontSize: 12, color: t.muted, marginTop: 2 }}>Th{d.getMonth() + 1}</span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.title}</div>
                        <div style={{ fontSize: 13, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {u.projectName}
                          {u.assigneeName ? `, ${u.assigneeName}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {slide.upcoming.length === 0 && <div style={{ fontSize: 16, color: t.muted }}>Không có hạn chót gần.</div>}
              </div>
            </Panel>
          </Reveal>
        </div>
      );

    case "quotes":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {slide.quotes.map((q, i) => (
            <Reveal key={i} i={i} ctx={ctx}>
              <Panel theme={t} style={{ height: 218, display: "flex", flexDirection: "column" }}>
                <Quote size={20} color={t.muted} />
                <div style={{ fontSize: 18, lineHeight: 1.5, color: t.ink, marginTop: 10, flex: 1, overflow: "hidden" }}>{q.content}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <span style={{ width: 32, height: 32, borderRadius: 16, background: q.color, color: "#fff", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {initials(q.author)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{q.author}</div>
                    <div style={{ fontSize: 13, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.task}</div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: t.inkSecondary, ...NUM }}>{q.progress}%</span>
                </div>
              </Panel>
            </Reveal>
          ))}
        </div>
      );

    case "insights":
      return (
        <div style={{ display: "flex", flexDirection: "column", borderTop: `1px solid ${t.panelBorder}` }}>
          {slide.items.slice(0, 6).map((it, i) => {
            const color = it.tone === "good" ? t.success : it.tone === "warn" ? t.warning : t.muted;
            const Icon = it.tone === "good" ? CircleCheck : it.tone === "warn" ? CircleAlert : Info;
            return (
              <Reveal key={i} i={i} ctx={ctx} style={{ display: "flex", alignItems: "center", gap: 18, padding: "16px 4px", borderBottom: `1px solid ${t.panelBorder}` }}>
                <Icon size={22} color={color} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 19, lineHeight: 1.45, color: t.ink }}>{it.text}</span>
              </Reveal>
            );
          })}
        </div>
      );

    case "bullets":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: slide.bullets.length > 5 ? 14 : 22 }}>
          {slide.bullets.map((b, i) => (
            <Reveal key={i} i={i} ctx={ctx} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <span style={{ width: 14, height: 2, background: t.muted, marginTop: slide.bullets.length > 5 ? 15 : 17, flexShrink: 0 }} />
              <span style={{ fontSize: slide.bullets.length > 5 ? 20 : 24, lineHeight: 1.45, color: t.ink }}>{b}</span>
            </Reveal>
          ))}
        </div>
      );

    case "cover":
      return null;
  }
}

// ---------------------------------------------------------------------------
// Full slide (1280×720)
// ---------------------------------------------------------------------------

export function SlideView({
  slide,
  meta,
  theme,
  index,
  total,
  animate = false,
}: {
  slide: SlideModel;
  meta: DeckMeta;
  theme: DeckTheme;
  index: number;
  total: number;
  animate?: boolean;
}) {
  const ctx = { theme, animate };
  const t = theme;
  const base: React.CSSProperties = {
    width: SLIDE_W,
    height: SLIDE_H,
    background: t.bgGradient,
    backgroundColor: t.bg,
    color: t.ink,
    position: "relative",
    overflow: "hidden",
    fontFamily: "inherit",
  };

  if (slide.kind === "cover") {
    return (
      <div style={base} data-slide>
        <div style={{ position: "absolute", left: 96, top: 72, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: 7, background: t.ink, color: t.bg, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>W</span>
          <span style={{ fontSize: 18, fontWeight: 600, color: t.ink }}>WorkHub</span>
        </div>
        <div style={{ position: "absolute", left: 96, right: 96, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Reveal ctx={ctx}>
            <h1 style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.1, letterSpacing: -1.2, color: t.ink, maxWidth: 900, textWrap: "balance" }}>{slide.title}</h1>
          </Reveal>
          <Reveal i={1} ctx={ctx}>
            <p style={{ fontSize: 24, color: t.inkSecondary, marginTop: 20 }}>{slide.subtitle}</p>
          </Reveal>
        </div>
        <div style={{ position: "absolute", left: 96, right: 96, bottom: 64, paddingTop: 20, borderTop: `1px solid ${t.panelBorder}`, display: "flex", gap: 48, fontSize: 16, color: t.muted }}>
          <span>
            Người lập: <b style={{ color: t.ink, fontWeight: 500 }}>{meta.preparedBy}</b>
          </span>
          <span>
            Ngày lập: <b style={{ color: t.ink, fontWeight: 500 }}>{meta.generatedAt}</b>
          </span>
        </div>
      </div>
    );
  }

  // Every content slide: label and title, a hairline, the body on a 64px margin grid, one footer line.
  return (
    <div style={base} data-slide>
      <div style={{ position: "absolute", left: 64, right: 64, top: 52 }}>
        <Reveal ctx={ctx}>
          <span style={{ fontSize: 15, fontWeight: 500, color: t.muted }}>{slide.kicker}</span>
        </Reveal>
        <Reveal i={0.5} ctx={ctx}>
          <h2 style={{ fontSize: 34, fontWeight: 600, marginTop: 6, color: t.ink, lineHeight: 1.2, letterSpacing: -0.5 }}>{slide.title}</h2>
        </Reveal>
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, top: 144, height: 1, background: t.panelBorder }} />
      <div style={{ position: "absolute", left: 64, right: 64, top: 168, height: 470 }}>
        <Body slide={slide} ctx={ctx} />
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 26, display: "flex", justifyContent: "space-between", fontSize: 13, color: t.muted, ...NUM }}>
        <span>
          {meta.scopeLabel} · {meta.periodLabel}
        </span>
        <span>
          {index + 1} / {total}
        </span>
      </div>
    </div>
  );
}

/** Scales a 1280×720 slide to the available width, preserving aspect ratio. */
export function SlideScaler({ width, children }: { width: number; children: React.ReactNode }) {
  const scale = width / SLIDE_W;
  return (
    <div style={{ width, height: SLIDE_H * scale, overflow: "hidden", position: "relative" }}>
      <div style={{ width: SLIDE_W, height: SLIDE_H, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>
        {children}
      </div>
    </div>
  );
}
