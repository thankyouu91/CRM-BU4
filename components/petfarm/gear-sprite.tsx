"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// One wearable drawn by the game's own renderer (rig.js wearImage), scaled up crisp, so the site shows
// the same pixel art the pets wear in the game. The higher the tier (`fx` 0 to 3), the richer the show:
// every piece floats over a pulsing shadow, then a shine sweeps across it, sparkles twinkle around it,
// and the top tier sheds rising embers. Still under reduced motion; paused off screen. Browser only.

let rig: Promise<typeof import("@/public/ta-tua/game/js/rig.js")> | null = null;
const loadRig = () => (rig ??= import("@/public/ta-tua/game/js/rig.js"));

/** A small seeded generator, so sparkles keep their places between renders. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * The wearable `id`, filling its box, scaled by whole art pixels to about `fit` CSS pixels wide
 * (between 4 and 9 per art pixel). `color` tints the sparkles and embers.
 */
export function GearSprite({ id, fit = 170, fx = 0, color = "#f2c14e", label, className }: {
  id: string;
  fit?: number;
  fx?: number;
  color?: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop = false;
    let raf = 0;
    let visible = true;
    let ro: ResizeObserver | undefined;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;

    loadRig()
      .then((r) => {
        const img = r.wearImage(id) as HTMLCanvasElement | null;
        const g = canvas.getContext("2d");
        if (stop || !img || !g) return;
        const scale = Math.min(9, Math.max(4, Math.floor(fit / img.width)));
        const rand = seeded(id.length * 97 + fx);
        const sparks = Array.from({ length: fx >= 2 ? 7 : 0 }, () => ({ a: rand() * Math.PI * 2, d: 0.6 + rand() * 0.5, p: rand() * 6 }));
        const embers = Array.from({ length: fx >= 3 ? 12 : 0 }, () => ({ x: rand(), p: rand(), v: 0.5 + rand() * 0.6 }));
        // A copy of the sprite to paint the shine onto, so the light only lands on the piece itself.
        const shine = document.createElement("canvas");
        shine.width = img.width;
        shine.height = img.height;
        const sg = shine.getContext("2d")!;

        const paint = (t: number) => {
          const s = still ? 0 : t / 1000;
          const W = canvas.width;
          const H = canvas.height;
          g.clearRect(0, 0, W, H);
          const bob = Math.round(Math.sin(s * 2) * 1.5);
          const x = Math.round((W - img.width) / 2);
          const y = Math.round((H - img.height) / 2) - 1 + bob;
          // Shadow on the floor, smaller while the piece floats up.
          const sw = Math.round(img.width * (0.7 - bob * 0.05));
          g.fillStyle = "rgba(0,0,0,0.35)";
          g.fillRect(Math.round((W - sw) / 2), Math.round((H + img.height) / 2) + 3, sw, 1);
          // Embers rise behind the piece.
          g.fillStyle = color;
          for (const e of embers) {
            const k = (e.p + s * e.v * 0.35) % 1;
            g.globalAlpha = 1 - k;
            g.fillRect(Math.round(x - 4 + e.x * (img.width + 8)), Math.round(H - k * H), 1, 1);
          }
          g.globalAlpha = 1;
          g.drawImage(img, x, y);
          // A shine band sweeps across every few seconds.
          if (fx >= 1 && !still) {
            const phase = (s * 0.45) % 1.6;
            if (phase < 1) {
              sg.clearRect(0, 0, shine.width, shine.height);
              sg.globalCompositeOperation = "source-over";
              sg.drawImage(img, 0, 0);
              sg.globalCompositeOperation = "source-in";
              sg.fillStyle = "rgba(255,255,255,0.75)";
              const bx = Math.round(-6 + phase * (img.width + 12));
              for (let row = 0; row < img.height; row++) sg.fillRect(bx - row, row, 3, 1);
              g.drawImage(shine, x, y);
            }
          }
          // Sparkles twinkle around the piece.
          for (const p of sparks) {
            const on = Math.sin(s * 3 + p.p);
            if (still ? p.p < 3 : on < 0.2) continue;
            const cx = Math.round(W / 2 + Math.cos(p.a) * (img.width / 2 + 5) * p.d);
            const cy = Math.round(H / 2 + Math.sin(p.a) * (img.height / 2 + 5) * p.d);
            g.fillStyle = "#fff6d6";
            g.fillRect(cx, cy, 1, 1);
            if (on > 0.7 || still) {
              g.fillStyle = color;
              g.fillRect(cx - 1, cy, 1, 1);
              g.fillRect(cx + 1, cy, 1, 1);
              g.fillRect(cx, cy - 1, 1, 1);
              g.fillRect(cx, cy + 1, 1, 1);
            }
          }
        };

        // The canvas holds art pixels for its whole box (the parent); CSS scales it up crisp.
        const resize = () => {
          const box = (canvas.parentElement ?? canvas).getBoundingClientRect();
          canvas.width = Math.max(img.width + 4, Math.floor(box.width / scale));
          canvas.height = Math.max(img.height + 8, Math.floor(box.height / scale));
          canvas.style.width = `${canvas.width * scale}px`;
          canvas.style.height = `${canvas.height * scale}px`;
          paint(performance.now());
        };
        ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement ?? canvas);
        resize();

        let last = 0;
        const loop = (t: number) => {
          if (stop) return;
          if (visible && !document.hidden && t - last > 66) {
            last = t;
            paint(t);
          }
          raf = requestAnimationFrame(loop);
        };
        if (!still) raf = requestAnimationFrame(loop);
      })
      .catch(() => {});
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro?.disconnect();
    };
  }, [id, fit, fx, color]);
  return <canvas ref={ref} role="img" aria-label={label} width={1} height={1} className={cn("block [image-rendering:pixelated]", className)} />;
}
