import { Inter } from "next/font/google";

// Inter is a variable font: every weight from one file, with full Vietnamese marks.
export const appFont = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Explicit font stack for SVG text (chart ticks). Serialized SVG — as used by
 * the PDF capture — does not inherit page CSS, so it needs a concrete family;
 * Arial is the fallback there, the app font is used on screen.
 */
export const SVG_FONT = `${appFont.style.fontFamily}, Arial, Helvetica, sans-serif`;
