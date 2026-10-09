"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ChevronLeft, ChevronRight, Grid3x3, Maximize, Minimize, Moon, Pause, Play, Sun, X } from "lucide-react";
import type { Deck } from "@/lib/deck-model";
import { slideTitle } from "@/lib/deck-model";
import { cn } from "@/lib/utils";
import { SlideScaler, SlideView } from "./slides";
import { DECK_THEMES, SLIDE_H, SLIDE_W, type DeckTheme } from "./theme";

export type TransitionKind = "slide" | "fade" | "zoom" | "flip";

export const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: "slide", label: "Trượt ngang" },
  { value: "fade", label: "Mờ dần" },
  { value: "zoom", label: "Phóng to" },
  { value: "flip", label: "Lật 3D" },
];

const EASE = [0.22, 1, 0.36, 1] as const;

const VARIANTS: Record<TransitionKind, Variants> = {
  slide: {
    enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0.4 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.6, ease: EASE } },
    exit: (d: number) => ({ x: d > 0 ? "-35%" : "35%", opacity: 0, transition: { duration: 0.5, ease: EASE } }),
  },
  fade: {
    enter: { opacity: 0, scale: 0.985 },
    center: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: EASE } },
    exit: { opacity: 0, transition: { duration: 0.35 } },
  },
  zoom: {
    enter: { opacity: 0, scale: 0.86 },
    center: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: EASE } },
    exit: { opacity: 0, scale: 1.08, transition: { duration: 0.4, ease: EASE } },
  },
  flip: {
    enter: (d: number) => ({ rotateY: d > 0 ? 70 : -70, opacity: 0, scale: 0.94 }),
    center: { rotateY: 0, opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE } },
    exit: (d: number) => ({ rotateY: d > 0 ? -50 : 50, opacity: 0, scale: 0.94, transition: { duration: 0.45, ease: EASE } }),
  },
};

const AUTOPLAY_MS = 8000;

export function Presenter({
  deck,
  initialTheme = "dark",
  initialTransition = "slide",
  startIndex = 0,
  onClose,
}: {
  deck: Deck;
  initialTheme?: DeckTheme["id"];
  initialTransition?: TransitionKind;
  startIndex?: number;
  onClose: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [[index, dir], setPage] = useState<[number, number]>([startIndex, 0]);
  const [themeId, setThemeId] = useState(initialTheme);
  const [transition, setTransition] = useState<TransitionKind>(initialTransition);
  const [playing, setPlaying] = useState(false);
  const [overview, setOverview] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [chrome, setChrome] = useState(true);
  const [size, setSize] = useState({ w: 1280, h: 720 });
  const idle = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touchX = useRef<number | null>(null);

  const total = deck.slides.length;
  const theme = DECK_THEMES[themeId];

  const go = useCallback(
    (next: number) => {
      const n = Math.max(0, Math.min(total - 1, next));
      setPage(([cur]) => (n === cur ? [cur, 0] : [n, n > cur ? 1 : -1]));
    },
    [total],
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Fit the 16:9 slide inside the viewport.
  useEffect(() => {
    const fit = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const scale = Math.min(size.w / SLIDE_W, size.h / SLIDE_H) * 0.96;

  // Enter fullscreen on open (still inside the click's user activation).
  useEffect(() => {
    root.current?.requestFullscreen?.().catch(() => undefined);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else root.current?.requestFullscreen?.().catch(() => undefined);
  };

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "SELECT") return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "Enter":
          e.preventDefault();
          next();
          break;
        case "ArrowLeft":
        case "PageUp":
        case "Backspace":
          e.preventDefault();
          prev();
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(total - 1);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "g":
        case "G":
          setOverview((o) => !o);
          break;
        case "p":
        case "P":
          setPlaying((p) => !p);
          break;
        case "Escape":
          // Browsers usually consume the first Esc to leave fullscreen; whenever
          // the key does reach us, it closes the overview or ends the show.
          if (overview) setOverview(false);
          else onClose();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, total, onClose, overview]);

  // Autoplay: advance every AUTOPLAY_MS, stop on the last slide.
  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, index, total, next]);

  // Auto-hide controls when the mouse is idle.
  const poke = () => {
    setChrome(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => setChrome(false), 2500);
  };
  useEffect(() => {
    poke();
    return () => clearTimeout(idle.current);
  }, []);

  const variants = reduced ? VARIANTS.fade : VARIANTS[transition];

  return (
    <div
      ref={root}
      className={cn("fixed inset-0 z-[100] flex items-center justify-center bg-black", !chrome && "cursor-none")}
      onMouseMove={poke}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
        touchX.current = null;
      }}
      role="dialog"
      aria-label="Trình chiếu báo cáo"
    >
      {/* Stage */}
      <div
        className="relative overflow-hidden rounded-lg shadow-2xl"
        style={{ width: SLIDE_W * scale, height: SLIDE_H * scale, perspective: 1800, background: theme.bg }}
        onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          (e.clientX - r.left > r.width / 3 ? next : prev)();
        }}
      >
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={`${index}-${themeId}`}
            custom={dir}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="absolute inset-0"
            style={{ transformStyle: "preserve-3d" }}
          >
            <SlideScaler width={SLIDE_W * scale}>
              <SlideView slide={deck.slides[index]} meta={deck.meta} theme={theme} index={index} total={total} animate={!reduced} />
            </SlideScaler>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="absolute inset-x-0 top-0 h-1 bg-white/10">
        <motion.div className="h-full bg-indigo-400" animate={{ width: `${((index + 1) / total) * 100}%` }} transition={{ duration: 0.4 }} />
      </div>

      {/* Controls */}
      <AnimatePresence>
        {chrome && !overview && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-white/10 bg-slate-900/85 p-1.5 text-white shadow-2xl backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <CtrlButton label="Slide trước (←)" onClick={prev} disabled={index === 0}>
              <ChevronLeft className="h-5 w-5" />
            </CtrlButton>
            <span className="min-w-[64px] text-center text-sm font-semibold tabular-nums">
              {index + 1} / {total}
            </span>
            <CtrlButton label="Slide sau (→)" onClick={next} disabled={index === total - 1}>
              <ChevronRight className="h-5 w-5" />
            </CtrlButton>
            <span className="mx-1 h-6 w-px bg-white/15" />
            <CtrlButton label={playing ? "Dừng tự chạy (P)" : "Tự động chạy (P)"} onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </CtrlButton>
            <select
              value={transition}
              onChange={(e) => setTransition(e.target.value as TransitionKind)}
              className="h-9 rounded-lg bg-white/10 px-2 text-xs outline-none hover:bg-white/15"
              aria-label="Hiệu ứng chuyển slide"
            >
              {TRANSITIONS.map((t) => (
                <option key={t.value} value={t.value} className="text-slate-900">
                  {t.label}
                </option>
              ))}
            </select>
            <CtrlButton label="Đổi giao diện slide" onClick={() => setThemeId((t) => (t === "dark" ? "light" : "dark"))}>
              {themeId === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </CtrlButton>
            <CtrlButton label="Xem tổng quan (G)" onClick={() => setOverview(true)}>
              <Grid3x3 className="h-4 w-4" />
            </CtrlButton>
            <CtrlButton label="Toàn màn hình (F)" onClick={toggleFullscreen}>
              {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </CtrlButton>
            <span className="mx-1 h-6 w-px bg-white/15" />
            <CtrlButton label="Thoát (Esc)" onClick={onClose}>
              <X className="h-4 w-4" />
            </CtrlButton>
          </motion.div>
        )}
      </AnimatePresence>

      {playing && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-indigo-300/80" key={`play-${index}`} style={{ animation: `deck-play ${AUTOPLAY_MS}ms linear forwards` }} />
      )}
      <style>{`@keyframes deck-play{from{width:0}to{width:100%}}`}</style>

      {/* Overview grid */}
      <AnimatePresence>
        {overview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 overflow-y-auto bg-slate-950/95 p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-6 flex max-w-6xl items-center justify-between text-white">
              <h2 className="text-lg font-semibold">Tổng quan bài trình chiếu</h2>
              <button onClick={() => setOverview(false)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Đóng tổng quan">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mx-auto grid max-w-6xl grid-cols-2 gap-5 md:grid-cols-3">
              {deck.slides.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    go(i);
                    setOverview(false);
                  }}
                  className={cn(
                    "overflow-hidden rounded-xl text-left ring-2 transition hover:ring-indigo-400",
                    i === index ? "ring-indigo-400" : "ring-white/10",
                  )}
                >
                  <SlideScaler width={340}>
                    <SlideView slide={s} meta={deck.meta} theme={theme} index={i} total={total} />
                  </SlideScaler>
                  <p className="truncate bg-slate-900 px-3 py-2 text-xs text-slate-300">
                    {i + 1}. {slideTitle(s, deck.meta)}
                  </p>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CtrlButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/15 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
