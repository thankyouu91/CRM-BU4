import { DARK, LIGHT, type ChartTheme } from "@/lib/chart-theme";

// One deck design, two themes. The same hex values drive the on-screen slides,
// the PDF capture and the native PPTX export, so all three look identical.

export interface DeckTheme {
  id: "dark" | "light";
  name: string;
  /** Slide background: solid base + linear accent (html2canvas-safe; no radial gradients). */
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

export const DECK_THEMES: Record<DeckTheme["id"], DeckTheme> = {
  dark: {
    id: "dark",
    name: "Tối · Navy",
    bg: "#0b1020",
    bgGradient: "linear-gradient(135deg, #0b1020 0%, #111836 55%, #1a1446 100%)",
    panel: "#141b30",
    panelBorder: "#232c48",
    ink: "#f1f5f9",
    inkSecondary: "#cbd5e1",
    muted: "#94a3b8",
    accent: "#818cf8",
    accentSoft: "#232a55",
    track: "#232c48",
    danger: "#f87171",
    success: "#4ade80",
    warning: "#fbbf24",
    chart: { ...DARK, surface: "#141b30", grid: "#232c48", axis: "#334063", ink: "#f1f5f9", muted: "#94a3b8" },
  },
  light: {
    id: "light",
    name: "Sáng · Trắng",
    bg: "#ffffff",
    bgGradient: "linear-gradient(135deg, #ffffff 0%, #f5f7ff 60%, #eef0ff 100%)",
    panel: "#f8fafc",
    panelBorder: "#e2e8f0",
    ink: "#0f172a",
    inkSecondary: "#334155",
    muted: "#64748b",
    accent: "#4f46e5",
    accentSoft: "#e0e7ff",
    track: "#e2e8f0",
    danger: "#dc2626",
    success: "#16a34a",
    warning: "#b45309",
    chart: { ...LIGHT, surface: "#f8fafc" },
  },
};

export const SLIDE_W = 1280;
export const SLIDE_H = 720;
