"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Pets drawn live by the game's own renderer (public/ta-tua/game/js/rig.js), so the wiki shows the
// same art as the game and follows it when the art or the species change. Nothing is drawn on the
// server: the canvas is filled once the renderer has loaded in the browser.

type Rig = typeof import("@/public/ta-tua/game/js/rig.js");
let rig: Promise<Rig> | null = null;
const loadRig = () => (rig ??= import("@/public/ta-tua/game/js/rig.js"));

/** Art pixels of one frame (RIG_W + 2 by RIG_H + 2 in rig.js). */
const FRAME_W = 46;
const FRAME_H = 52;

const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * One pet at an age stage ("baby" … "elder") and a level (every 10 levels a new form).
 * `animate` plays the idle loop; `scale` is the size of one art pixel in CSS pixels.
 */
export function PetPortrait({ id, stage = "adult", level = 1, animate = false, scale = 2, className, label }: {
  id: string;
  stage?: string;
  level?: number;
  animate?: boolean;
  scale?: number;
  className?: string;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stop = false;
    let timer = 0;
    loadRig()
      .then((r) => {
        if (stop) return;
        const g = canvas.getContext("2d");
        if (!g) return;
        const play = animate && !reducedMotion();
        const frames: HTMLCanvasElement[] = play ? r.animFrames(id, stage, "idle", {}, { level }) : [r.drawFrame(id, stage, {}, {}, 0, { level })];
        let i = 0;
        const paint = () => {
          g.clearRect(0, 0, canvas.width, canvas.height);
          g.drawImage(frames[i % frames.length], 0, 0);
          i++;
        };
        paint();
        if (play && frames.length > 1) timer = window.setInterval(paint, 1000 / r.RIG_ANIMS.idle.fps);
      })
      .catch(() => {
        /* The page still reads fine without the picture. */
      });
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [id, stage, level, animate]);
  return (
    <canvas
      ref={ref}
      width={FRAME_W}
      height={FRAME_H}
      role="img"
      aria-label={label}
      style={{ width: FRAME_W * scale, height: FRAME_H * scale, imageRendering: "pixelated" }}
      className={cn("block", className)}
    />
  );
}
