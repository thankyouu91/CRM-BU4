import { DARK, LIGHT, type ChartTheme } from "@/lib/chart-theme";

// One deck design, two themes. The same hex values drive the on-screen slides,
// the PDF capture and the native PPTX export, so all three look identical.

export interface DeckTheme {
  id: "dark" | "light";
  name: string;
  /** Slide background; `bgGradient` is kept for callers and is the same flat colour. */
  bg: string;
  bgGradient: string;
  panel: string;
  panelBorder: string;
  ink: string;
  inkSecondary: string;
  muted: string;
  accent: string;
  accentSoft: string;
  track: string;
  danger: string;
  success: string;
  warning: string;
  chart: ChartTheme;
}

// Charcoal and zinc like the app: ink carries the structure, colour is kept for status.
export const DECK_THEMES: Record<DeckTheme["id"], DeckTheme> = {
  light: {
    id: "light",
    name: "Sáng · Trắng",
    bg: "#ffffff",
    bgGradient: "#ffffff",
    panel: "#fafafa",
    panelBorder: "#e4e4e7",
    ink: "#18181b",
    inkSecondary: "#3f3f46",
    muted: "#71717a",
    accent: "#18181b",
    accentSoft: "#f4f4f5",
    track: "#e4e4e7",
    danger: "#dc2626",
    success: "#15803d",
    warning: "#b45309",
    chart: { ...LIGHT, surface: "#fafafa" },
  },
  dark: {
    id: "dark",
    name: "Tối · Than",
    bg: "#0f0f11",
    bgGradient: "#0f0f11",
    panel: "#18181b",
    panelBorder: "#2a2a2e",
    ink: "#fafafa",
    inkSecondary: "#d4d4d8",
    muted: "#a1a1aa",
    accent: "#e4e4e7",
    accentSoft: "#27272a",
    track: "#2a2a2e",
    danger: "#f87171",
    success: "#4ade80",
    warning: "#fbbf24",
    chart: { ...DARK, surface: "#18181b", grid: "#2a2a2e", axis: "#3f3f46", ink: "#fafafa", muted: "#a1a1aa" },
  },
};

export const SLIDE_W = 1280;
export const SLIDE_H = 720;
