"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/misc";
import { TASK_STATUS } from "@/lib/constants";
import { useChartTheme, type ChartTheme } from "@/lib/chart-theme";
import { SVG_FONT } from "@/lib/font";
import { cn } from "@/lib/utils";
import type { Summary } from "@/lib/stats";

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

type TooltipRow = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown };

function ChartTooltip({
  active,
  payload,
  label,
  theme,
  unit,
}: {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: string | number;
  theme: ChartTheme;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="min-w-[150px] rounded-lg border px-3 py-2 text-xs shadow-pop"
      style={{ background: theme.surface, borderColor: theme.grid, color: theme.ink }}
    >
      {label !== undefined && <p className="mb-1.5 font-semibold">{label}</p>}
      <ul className="space-y-1">
        {payload.map((row, i) => (
          <li key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5" style={{ color: theme.inkSecondary }}>
              <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
              {row.name}
            </span>
            <span className="font-semibold tabular-nums">
              {String(row.value)}
              {unit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: React.ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />
          {it.label}
          {it.value !== undefined && <span className="font-semibold text-foreground">{it.value}</span>}
        </li>
      ))}
    </ul>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: { key: string; label: string; align?: "left" | "right" }[];
  rows: readonly object[];
}) {
  return (
    <div className="scrollbar-thin max-h-[300px] overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("px-3 py-2 font-medium", c.align === "right" ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2", c.align === "right" && "text-right tabular-nums")}>
                  {(r as Record<string, React.ReactNode>)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Card with a chart/table toggle: every chart has an accessible table twin. */
export function ChartCard({
  title,
  description,
  chart,
  table,
  legend,
  className,
  id,
}: {
  title: string;
  description?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
  legend?: React.ReactNode;
  className?: string;
  id: string;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  return (
    <Card className={cn("flex flex-col", className)}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        <Segmented
          layoutId={`view-${id}`}
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: <BarChart3 className="h-3.5 w-3.5" aria-label="Biểu đồ" /> },
            { value: "table", label: <Table2 className="h-3.5 w-3.5" aria-label="Bảng" /> },
          ]}
        />
      </div>
      {legend && view === "chart" && <div className="px-5 pt-3">{legend}</div>}
      <div className="flex-1 px-3 pb-4 pt-3 sm:px-5">{view === "chart" ? chart : table}</div>
    </Card>
  );
}

const axisProps = (theme: ChartTheme) => ({
  tick: { fill: theme.muted, fontSize: 12, fontFamily: SVG_FONT },
  tickLine: false,
  axisLine: { stroke: theme.axis },
});

// ---------------------------------------------------------------------------
// Trend: tasks created vs completed per bucket (same unit, one axis).
// Grouped bars: counts are small integers, so bars read more honestly than curves.
// ---------------------------------------------------------------------------

export function TrendChart({
  data,
  height = 260,
  animate = true,
  theme: forced,
  width,
}: {
  data: Summary["trend"];
  height?: number;
  animate?: boolean;
  theme?: ChartTheme;
  width?: number;
}) {
  const auto = useChartTheme();
  const theme = forced ?? auto;
  const [c1, c2] = theme.series;
  const chart = (
    <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} width={width} height={height} barGap={2}>
      <CartesianGrid vertical={false} stroke={theme.grid} />
      <XAxis dataKey="label" {...axisProps(theme)} interval="preserveStartEnd" minTickGap={16} />
      <YAxis allowDecimals={false} {...axisProps(theme)} axisLine={false} />
      <Tooltip
        cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
        content={(p) => <ChartTooltip {...(p as object)} theme={theme} />}
      />
      <Bar dataKey="created" name="Tạo mới" fill={c1} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={animate} />
      <Bar dataKey="completed" name="Hoàn thành" fill={c2} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={animate} />
    </BarChart>
  );
  if (width) return chart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );
}

export function trendLegend(theme: ChartTheme) {
  return [
    { label: "Tạo mới", color: theme.series[0] },
    { label: "Hoàn thành", color: theme.series[1] },
  ];
}

// ---------------------------------------------------------------------------
// Hours logged per bucket (separate chart: different unit from task counts)
// ---------------------------------------------------------------------------

export function HoursChart({
  data,
  height = 220,
  animate = true,
  theme: forced,
  width,
}: {
  data: Summary["trend"];
  height?: number;
  animate?: boolean;
  theme?: ChartTheme;
  width?: number;
}) {
  const auto = useChartTheme();
  const theme = forced ?? auto;
  const chart = (
    <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} width={width} height={height}>
      <CartesianGrid vertical={false} stroke={theme.grid} />
      <XAxis dataKey="label" {...axisProps(theme)} interval="preserveStartEnd" minTickGap={16} />
      <YAxis {...axisProps(theme)} axisLine={false} />
      <Tooltip
        cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
        content={(p) => <ChartTooltip {...(p as object)} theme={theme} unit=" giờ" />}
      />
      <Bar dataKey="hours" name="Giờ công" fill={theme.series[0]} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={animate} />
    </BarChart>
  );
  if (width) return chart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Task status distribution (part-to-whole, 5 labeled segments)
// ---------------------------------------------------------------------------

export function StatusDonut({
  data,
  size = 200,
  animate = true,
  theme: forced,
  centerLabel = "công việc",
}: {
  data: Summary["statusDistribution"];
  size?: number;
  animate?: boolean;
  theme?: ChartTheme;
  centerLabel?: string;
}) {
  const auto = useChartTheme();
  const theme = forced ?? auto;
  const total = data.reduce((a, d) => a + d.count, 0);
  const rows = data
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: TASK_STATUS[d.status as keyof typeof TASK_STATUS]?.label ?? d.status,
      value: d.count,
      color: theme.status[d.status],
    }));

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={rows.length ? rows : [{ name: "Trống", value: 1, color: theme.grid }]}
          dataKey="value"
          nameKey="name"
          innerRadius={size * 0.32}
          outerRadius={size * 0.46}
          paddingAngle={rows.length > 1 ? 2 : 0}
          cornerRadius={4}
          stroke={theme.surface}
          strokeWidth={2}
          isAnimationActive={animate}
        >
          {(rows.length ? rows : [{ color: theme.grid }]).map((r, i) => (
            <Cell key={i} fill={r.color} />
          ))}
        </Pie>
        {rows.length > 0 && <Tooltip content={(p) => <ChartTooltip {...(p as object)} theme={theme} />} />}
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: theme.ink }}>
          {total}
        </span>
        <span className="text-xs" style={{ color: theme.muted }}>
          {centerLabel}
        </span>
      </div>
    </div>
  );
}

export function statusLegend(data: Summary["statusDistribution"], theme: ChartTheme) {
  const total = data.reduce((a, d) => a + d.count, 0) || 1;
  return data.map((d) => ({
    label: TASK_STATUS[d.status as keyof typeof TASK_STATUS]?.label ?? d.status,
    color: theme.status[d.status],
    count: d.count,
    pct: Math.round((d.count / total) * 100),
  }));
}

// ---------------------------------------------------------------------------
// Workload per person (stacked, disjoint buckets)
// ---------------------------------------------------------------------------

export const WORKLOAD_SERIES = [
  { key: "done", label: "Hoàn thành", status: "DONE" },
  { key: "inProgress", label: "Đang làm", status: "IN_PROGRESS" },
  { key: "overdue", label: "Quá hạn", status: "BLOCKED" },
  { key: "remaining", label: "Còn lại", status: "TODO" },
] as const;

export function WorkloadChart({
  data,
  animate = true,
  theme: forced,
  width,
  height: fixedHeight,
}: {
  data: Summary["people"];
  animate?: boolean;
  theme?: ChartTheme;
  width?: number;
  height?: number;
}) {
  const auto = useChartTheme();
  const theme = forced ?? auto;
  const rows = data.slice(0, 8);
  const height = fixedHeight ?? Math.max(160, rows.length * 40 + 30);
  const chart = (
    <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }} width={width} height={height} barCategoryGap={10}>
      <CartesianGrid horizontal={false} stroke={theme.grid} />
      <XAxis type="number" allowDecimals={false} {...axisProps(theme)} />
      <YAxis type="category" dataKey="name" width={136} {...axisProps(theme)} axisLine={false} />
      <Tooltip cursor={{ fill: theme.grid, fillOpacity: 0.4 }} content={(p) => <ChartTooltip {...(p as object)} theme={theme} />} />
      {WORKLOAD_SERIES.map((s) => (
        <Bar
          key={s.key}
          dataKey={s.key}
          name={s.label}
          stackId="w"
          fill={theme.status[s.status]}
          stroke={theme.surface}
          strokeWidth={2}
          isAnimationActive={animate}
        />
      ))}
    </BarChart>
  );
  if (width) return chart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  );
}

export function workloadLegend(theme: ChartTheme) {
  return WORKLOAD_SERIES.map((s) => ({ label: s.label, color: theme.status[s.status] }));
}
