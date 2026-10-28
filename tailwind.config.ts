import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: token("card"),
        muted: { DEFAULT: token("muted"), foreground: token("muted-foreground") },
        border: token("border"),
        ring: token("ring"),
        primary: { DEFAULT: token("primary"), foreground: token("primary-foreground"), soft: token("primary-soft") },
        success: token("success"),
        warning: token("warning"),
        danger: token("danger"),
        sidebar: { DEFAULT: token("sidebar"), foreground: token("sidebar-foreground"), muted: token("sidebar-muted"), accent: token("sidebar-accent") },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      // One radius scale: controls 6px (md, lg), panels and cards 8px (xl, 2xl), large sheets 12px.
      borderRadius: {
        lg: "0.375rem",
        xl: "0.5rem",
        "2xl": "0.5rem",
        "3xl": "0.75rem",
      },
      // Cards are flat with a border; only floating layers (menus, dialogs) lift.
      boxShadow: {
        card: "0 1px 2px rgb(24 24 27 / 0.04)",
        pop: "0 12px 32px -8px rgb(24 24 27 / 0.16), 0 2px 6px rgb(24 24 27 / 0.06)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
