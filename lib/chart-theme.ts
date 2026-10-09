"use client";

import { useEffect, useState } from "react";

// Chart colors are explicit hex (not CSS variables) so they survive SVG
// serialization in PDF export. Palettes validated with the dataviz validator
// against the app's card surfaces (light #ffffff, dark #111522):
//  - categorical: all checks pass in both modes (fixed order, never cycled)
//  - task status (in-progress, review, done, blocked): passes light; dark sits in
//    the 6–8 CVD band, so status marks always ship with a text label + 2px gaps.

export interface ChartTheme {
  dark: boolean;
  surface: string;
  ink: string;
  inkSecondary: string;
  muted: string;
  grid: string;
  axis: string;
  series: string[];
  status: Record<string, string>;
}

export const LIGHT: ChartTheme = {
  dark: false,
  surface: "#ffffff",
  ink: "#0f172a",
  inkSecondary: "#475569",
  muted: "#64748b",
  grid: "#e2e8f0",
  axis: "#cbd5e1",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  status: { TODO: "#94a3b8", IN_PROGRESS: "#2a78d6", REVIEW: "#eb6834", DONE: "#1baf7a", BLOCKED: "#d03b3b" },
};

export const DARK: ChartTheme = {
  dark: true,
  surface: "#111522",
  ink: "#e2e8f0",
  inkSecondary: "#cbd5e1",
  muted: "#94a3b8",
  grid: "#262d42",
  axis: "#3a4360",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  status: { TODO: "#64748b", IN_PROGRESS: "#3987e5", REVIEW: "#d95926", DONE: "#199e70", BLOCKED: "#d03b3b" },
};

/** Tracks the app's dark-mode class and returns the matching chart theme. */
export function useChartTheme(): ChartTheme {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains("dark"));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark ? DARK : LIGHT;
}
