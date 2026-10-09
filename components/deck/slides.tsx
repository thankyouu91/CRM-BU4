"use client";

import { motion } from "framer-motion";
import { CircleAlert, CircleCheck, Info, Quote, TriangleAlert } from "lucide-react";
import { HoursChart, StatusDonut, TrendChart, WorkloadChart, WORKLOAD_SERIES, statusLegend } from "@/components/charts/charts";
import type { DeckMeta, SlideModel } from "@/lib/deck-model";
import { initials } from "@/lib/utils";
import { SLIDE_H, SLIDE_W, type DeckTheme } from "./theme";

interface Ctx {
  theme: DeckTheme;
  animate: boolean;
}

/** Staggered entrance when presenting; a plain box when exporting. */
function Reveal({ i = 0, ctx, children, style, className }: { i?: number; ctx: Ctx; children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  if (!ctx.animate) return <div style={style} className={className}>{children}</div>;
  return (
    <motion.div
      style={style}
      className={className}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Panel({ theme, children, style }: { theme: DeckTheme; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.panelBorder}`, borderRadius: 20, padding: 24, ...style }}>{children}</div>
  );
}

function Bar({ value, theme, color, height = 12 }: { value: number; theme: DeckTheme; color?: string; height?: number }) {
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
        <span key={it.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, color: theme.inkSecondary }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: DeckTheme }) {
  return (
    <Panel theme={theme} style={{ padding: "18px 22px" }}>
      <div style={{ fontSize: 14, color: theme.muted }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color: theme.ink, marginTop: 6 }}>{value}</div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Slide bodies
// ---------------------------------------------------------------------------

function Body({ slide, ctx }: { slide: SlideModel; ctx: Ctx }) {
  const t = ctx.theme;
  switch (slide.kind) {
    case "kpis":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {slide.items.map((it, i) => (
            <Reveal key={it.label} i={i} ctx={ctx}>
              <Panel theme={t} style={{ height: 196, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontSize: 17, color: t.muted, fontWeight: 500 }}>{it.label}</div>
                <div
                  style={{
                    fontSize: 64,
                    fontWeight: 700,
                    lineHeight: 1,
                    color: it.tone === "danger" ? t.danger : it.tone === "accent" ? t.accent : t.ink,
                  }}
                >
                  {it.value}
                </div>
                <div style={{ fontSize: 15, color: t.inkSecondary }}>{it.sub}</div>
              </Panel>
            </Reveal>
          ))}
        </div>
      );

    case "projects":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: slide.rows.length > 5 ? 16 : 24 }}>
          {slide.rows.map((r, i) => (
            <Reveal key={r.name} i={i} ctx={ctx}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 7, background: r.color }} />
                  <span style={{ fontSize: 22, fontWeight: 600, color: t.ink }}>{r.name}</span>
                  <span style={{ fontSize: 13, padding: "3px 10px", borderRadius: 8, background: t.accentSoft, color: t.accent, fontWeight: 600 }}>{r.status}</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
                  <span style={{ fontSize: 15, color: t.muted }}>
                    {r.done}/{r.total} việc
                  </span>
                  {r.overdue > 0 && <span style={{ fontSize: 15, color: t.danger, fontWeight: 600 }}>{r.overdue} quá hạn</span>}
                  <span style={{ fontSize: 26, fontWeight: 700, color: t.ink, minWidth: 74, textAlign: "right" }}>{r.progress}%</span>
                </div>
              </div>
              <Bar value={r.progress} theme={t} height={slide.rows.length > 5 ? 10 : 14} />
            </Reveal>
          ))}
        </div>
      );

    case "trend":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 24 }}>
          <Reveal ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <LegendRow theme={t} items={[{ label: "Tạo mới", color: t.chart.series[0] }, { label: "Hoàn thành", color: t.chart.series[1] }]} />
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
              <div style={{ fontSize: 15, color: t.inkSecondary }}>Giờ công theo thời gian</div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {legend.map((s, i) => (
              <Reveal key={s.label} i={i + 1} ctx={ctx}>
                <Panel theme={t} style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ width: 16, height: 16, borderRadius: 4, background: s.color }} />
                  <span style={{ flex: 1, fontSize: 20, color: t.ink }}>{s.label}</span>
                  <span style={{ fontSize: 26, fontWeight: 700, color: t.ink }}>{s.count}</span>
                  <span style={{ width: 64, textAlign: "right", fontSize: 17, color: t.muted }}>{s.pct}%</span>
                </Panel>
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
                    <span style={{ width: 34, height: 34, borderRadius: 17, background: p.avatarColor, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {initials(p.name)}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 16, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: t.muted }}>{p.jobTitle ?? ""}</span>
                    </span>
                  </span>
                  <span style={{ textAlign: "right", fontSize: 20, fontWeight: 700, color: t.ink }}>{p.done}</span>
                  <span style={{ textAlign: "right", fontSize: 16, color: t.inkSecondary }}>{p.hours}</span>
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: t.danger, fontSize: 17, fontWeight: 600 }}>
                <TriangleAlert size={20} color={t.danger} /> Công việc quá hạn
              </div>
              <div style={{ fontSize: 88, fontWeight: 700, color: slide.overdueTotal ? t.danger : t.ink, lineHeight: 1.1, marginTop: 12 }}>{slide.overdueTotal}</div>
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
                {slide.byProject.slice(0, 5).map((p) => (
                  <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, color: t.inkSecondary }}>
                    <span style={{ width: 10, height: 10, borderRadius: 5, background: p.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    <span style={{ fontWeight: 700, color: t.ink }}>{p.overdue}</span>
                  </div>
                ))}
                {slide.byProject.length === 0 && <div style={{ fontSize: 16, color: t.success }}>Không có công việc trễ hạn.</div>}
              </div>
            </Panel>
          </Reveal>
          <Reveal i={1} ctx={ctx}>
            <Panel theme={t} style={{ height: 460 }}>
              <div style={{ fontSize: 17, fontWeight: 600, color: t.ink }}>Hạn chót trong 14 ngày tới</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
                {slide.upcoming.map((u) => {
                  const d = new Date(u.dueDate);
                  return (
                    <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 16, padding: "11px 0", borderBottom: `1px solid ${t.panelBorder}` }}>
                      <div style={{ width: 54, height: 50, borderRadius: 12, background: t.accentSoft, color: t.accent, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{d.getDate()}</span>
                        <span style={{ fontSize: 11 }}>Th{d.getMonth() + 1}</span>
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 600, color: t.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.title}</div>
                        <div style={{ fontSize: 13, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {u.projectName}
                          {u.assigneeName ? ` · ${u.assigneeName}` : ""}
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
                <Quote size={26} color={t.accent} />
                <div style={{ fontSize: 19, lineHeight: 1.5, color: t.ink, marginTop: 10, flex: 1, overflow: "hidden" }}>{q.content}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                  <span style={{ width: 34, height: 34, borderRadius: 17, background: q.color, color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {initials(q.author)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{q.author}</div>
                    <div style={{ fontSize: 13, color: t.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{q.task}</div>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: t.accent, background: t.accentSoft, padding: "4px 10px", borderRadius: 8 }}>{q.progress}%</span>
                </div>
              </Panel>
            </Reveal>
          ))}
        </div>
      );

    case "insights":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {slide.items.slice(0, 6).map((it, i) => {
            const color = it.tone === "good" ? t.success : it.tone === "warn" ? t.warning : t.accent;
            const Icon = it.tone === "good" ? CircleCheck : it.tone === "warn" ? CircleAlert : Info;
            return (
              <Reveal key={i} i={i} ctx={ctx}>
                <Panel theme={t} style={{ padding: "16px 22px", display: "flex", alignItems: "center", gap: 18 }}>
                  <Icon size={28} color={color} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 20, lineHeight: 1.45, color: t.ink }}>{it.text}</span>
                </Panel>
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
              <span style={{ width: 12, height: 12, borderRadius: 6, background: t.accent, marginTop: 12, flexShrink: 0 }} />
              <span style={{ fontSize: slide.bullets.length > 5 ? 22 : 26, lineHeight: 1.45, color: t.ink }}>{b}</span>
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
        {/* Decorative rings */}
        <div style={{ position: "absolute", right: -160, top: -160, width: 620, height: 620, borderRadius: 310, border: `70px solid ${t.accentSoft}` }} />
        <div style={{ position: "absolute", right: 120, bottom: -220, width: 420, height: 420, borderRadius: 210, border: `2px solid ${t.panelBorder}` }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: t.accent }} />
        <div style={{ position: "absolute", left: 96, top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 820 }}>
          <Reveal ctx={ctx}>
            <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", color: t.accent }}>WorkHub · Báo cáo</span>
          </Reveal>
          <Reveal i={1} ctx={ctx}>
            <h1 style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.12, marginTop: 22, color: t.ink }}>{slide.title}</h1>
          </Reveal>
          <Reveal i={2} ctx={ctx}>
            <p style={{ fontSize: 26, color: t.inkSecondary, marginTop: 22 }}>{slide.subtitle}</p>
          </Reveal>
          <Reveal i={3} ctx={ctx}>
            <div style={{ display: "flex", gap: 40, marginTop: 56, fontSize: 17, color: t.muted }}>
              <span>
                Người lập: <b style={{ color: t.ink, fontWeight: 600 }}>{meta.preparedBy}</b>
              </span>
              <span>
                Ngày lập: <b style={{ color: t.ink, fontWeight: 600 }}>{meta.generatedAt}</b>
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    );
  }

  return (
    <div style={base} data-slide>
      <div style={{ position: "absolute", left: 0, top: 0, width: 220, height: 6, background: t.accent }} />
      <div style={{ position: "absolute", left: 64, right: 64, top: 48, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <Reveal ctx={ctx}>
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", color: t.accent }}>{slide.kicker}</span>
          </Reveal>
          <Reveal i={0.5} ctx={ctx}>
            <h2 style={{ fontSize: 38, fontWeight: 700, marginTop: 8, color: t.ink, lineHeight: 1.2 }}>{slide.title}</h2>
          </Reveal>
        </div>
        <span style={{ fontSize: 15, color: t.muted, fontWeight: 600 }}>
          {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, top: 168, height: 470 }}>
        <Body slide={slide} ctx={ctx} />
      </div>
      <div style={{ position: "absolute", left: 64, right: 64, bottom: 26, display: "flex", justifyContent: "space-between", fontSize: 13, color: t.muted }}>
        <span>
          {meta.scopeLabel} · {meta.periodLabel}
        </span>
        <span>WorkHub · {meta.generatedAt}</span>
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
