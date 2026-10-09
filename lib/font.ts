import { Be_Vietnam_Pro } from "next/font/google";

export const appFont = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

/**
 * Explicit font stack for SVG text (chart ticks). Serialized SVG — as used by
 * the PDF capture — does not inherit page CSS, so it needs a concrete family;
 * Arial is the fallback there, the app font is used on screen.
 */
export const SVG_FONT = `${appFont.style.fontFamily}, Arial, Helvetica, sans-serif`;
