"use client";

import { useEffect, useState } from "react";

// Chart colors are explicit hex (not CSS variables) so they survive SVG
// serialization in PDF export. Palettes validated with the dataviz validator
// against the app's card surfaces (light #ffffff, dark #121215):
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
  ink: "#18181b",
  inkSecondary: "#52525b",
  muted: "#71717a",
  grid: "#e4e4e7",
  axis: "#d4d4d8",
  series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"],
  status: { TODO: "#a1a1aa", IN_PROGRESS: "#2a78d6", REVIEW: "#eb6834", DONE: "#1baf7a", BLOCKED: "#d03b3b" },
};

export const DARK: ChartTheme = {
  dark: true,
  surface: "#121215",
  ink: "#ededef",
  inkSecondary: "#d4d4d8",
  muted: "#a1a1aa",
  grid: "#27272b",
  axis: "#3f3f46",
  series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
  status: { TODO: "#71717a", IN_PROGRESS: "#3987e5", REVIEW: "#d95926", DONE: "#199e70", BLOCKED: "#d03b3b" },
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
