"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// The hero of petfarm.online: a clan-war face-off at night. Two clans line up under their banners,
// sunglasses on and gold on their necks, and the clan champion stands on a gold podium between them.
// Every pet is drawn by the game's own renderer (public/ta-tua/game/js/rig.js), so the scene always
// shows the game's real art and gear. The scene is painted at pixel-art size and scaled up crisp.

type Rig = typeof import("@/public/ta-tua/game/js/rig.js");
type Wear = Partial<Record<"head" | "face" | "neck" | "back" | "charm", string>>;
interface Fighter { id: string; wear: Wear; x: number; y: number; scale: number; side: "left" | "right" | "center"; level: number }

/** Art-space size of the scene (16:10). */
const W = 320;
const H = 200;
const FRAME_W = 46;
const FRAME_H = 52;

// Left clan: fire, red banner. Right clan: water, blue banner. Champion: a legendary at level 50.
const FIGHTERS: Fighter[] = [
  { id: "gau_meo_do", wear: { head: "cap", face: "shades", neck: "medal" }, x: 22, y: 124, scale: 1, side: "left", level: 30 },
  { id: "lan_con", wear: { head: "devilhorns", face: "goldmask", neck: "amber", back: "batwings" }, x: 52, y: 132, scale: 1, side: "left", level: 40 },
  { id: "cao_lua", wear: { head: "tophat", face: "shades", neck: "pearls", back: "dragonwings" }, x: 82, y: 140, scale: 1, side: "left", level: 50 },
  { id: "hai_cau", wear: { head: "cap", face: "starglasses", neck: "medal" }, x: W - 22 - FRAME_W, y: 124, scale: 1, side: "right", level: 30 },
  { id: "rua_bien", wear: { head: "khandong", face: "monocle", neck: "jade", back: "wavecape" }, x: W - 52 - FRAME_W, y: 132, scale: 1, side: "right", level: 40 },
  { id: "ca_chep_rong", wear: { head: "crown", face: "shades", neck: "pearls", back: "starcape" }, x: W - 82 - FRAME_W, y: 140, scale: 1, side: "right", level: 50 },
  { id: "hoang_long", wear: { head: "crown", face: "goldmask", neck: "medal", back: "phoenix", charm: "trongdong" }, x: W / 2 - FRAME_W, y: 58, scale: 2, side: "center", level: 50 },
];

const GOLD = "#f2c14e";
const GOLD_DEEP = "#b8860b";

/** A small seeded generator, so the stars and windows stay put between renders. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  return [c, g] as const;
}

/** The still parts of the scene: sky, moon, skyline, arena floor and the two banners. */
function paintBackdrop() {
  const [c, g] = makeCanvas(W, H);
  const rand = seeded(20261030);
  const sky = g.createLinearGradient(0, 0, 0, 150);
  sky.addColorStop(0, "#07060b");
  sky.addColorStop(1, "#1d1530");
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Moon behind the champion.
  g.fillStyle = "#3a2d17";
  g.beginPath();
  g.arc(W / 2, 62, 40, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#6b5323";
  g.beginPath();
  g.arc(W / 2, 62, 34, 0, Math.PI * 2);
  g.fill();

  // Skyline with gold windows.
  for (let x = 0; x < W; ) {
    const bw = 10 + Math.floor(rand() * 18);
    const bh = 24 + Math.floor(rand() * 46);
    const top = 150 - bh;
    g.fillStyle = rand() < 0.5 ? "#100d18" : "#141020";
    g.fillRect(x, top, bw, bh);
    for (let wy = top + 4; wy < 146; wy += 5) {
      for (let wx = x + 2; wx < x + bw - 2; wx += 4) {
        if (rand() < 0.28) {
          g.fillStyle = rand() < 0.8 ? "#d9a63a" : "#f6e2a6";
          g.fillRect(wx, wy, 2, 2);
        }
      }
    }
    x += bw + (rand() < 0.3 ? 2 : 0);
  }

  // Arena floor: dark stone with gold lines running to the centre.
  g.fillStyle = "#0e0c14";
  g.fillRect(0, 150, W, H - 150);
  g.strokeStyle = "rgba(242,193,78,0.22)";
  g.lineWidth = 1;
  for (let i = -8; i <= 8; i++) {
    g.beginPath();
    g.moveTo(W / 2 + i * 6, 150);
    g.lineTo(W / 2 + i * 40, H);
    g.stroke();
  }
  for (const y of [158, 170, 186]) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();
  }

  // Gold podium under the champion.
  g.fillStyle = "#1a1408";
  g.fillRect(W / 2 - 38, 150, 76, 14);
  g.fillStyle = GOLD_DEEP;
  g.fillRect(W / 2 - 38, 150, 76, 2);
  g.fillStyle = GOLD;
  g.fillRect(W / 2 - 30, 152, 60, 1);

  // Clan banners on poles: fire on the left, water on the right.
  const banner = (x: number, color: string, dark: string, flip: boolean) => {
    g.fillStyle = "#3b3226";
    g.fillRect(x, 10, 2, 118);
    g.fillStyle = GOLD;
    g.fillRect(x - 1, 8, 4, 3);
    const bx = flip ? x - 30 : x + 2;
    g.fillStyle = color;
    g.fillRect(bx, 14, 30, 48);
    g.fillStyle = dark;
    g.fillRect(bx, 14, 30, 4);
    // Swallowtail.
    g.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      g.fillRect(bx, 62 + i, 15 - i * 2 > 0 ? 15 - i * 2 : 0, 1);
      g.fillRect(bx + 15 + i * 2, 62 + i, 15 - i * 2 > 0 ? 15 - i * 2 : 0, 1);
    }
    // Gold trim and emblem ring.
    g.fillStyle = GOLD;
    g.fillRect(bx, 14, 30, 1);
    g.fillRect(bx, 14, 1, 48);
    g.fillRect(bx + 29, 14, 1, 48);
    g.beginPath();
    g.arc(bx + 15, 38, 9, 0, Math.PI * 2);
    g.lineWidth = 2;
    g.strokeStyle = GOLD;
    g.stroke();
    g.fillStyle = dark;
    g.beginPath();
    g.arc(bx + 15, 38, 6, 0, Math.PI * 2);
    g.fill();
  };
  banner(14, "#b3261e", "#6e130e", false);
  banner(W - 16, "#1f4fbf", "#102a6b", true);
  return c;
}

/** Idle frames of one fighter, turned to face the centre. */
function fighterFrames(r: Rig, f: Fighter) {
  const face = f.side === "left" ? { look: 1, hx: 1 } : f.side === "right" ? { look: 1, hx: 1, mirror: true } : {};
  return r.RIG_ANIMS.idle.frames.map((pose: Record<string, unknown>, i: number) =>
    r.drawFrame(f.id, "adult", { ...pose, ...face }, f.wear, i, { level: f.level }),
  ) as HTMLCanvasElement[];
}

export function ClanWarHero({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let stopped = false;
    let raf = 0;
    let visible = true;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    let ro: ResizeObserver | undefined;

    import("@/public/ta-tua/game/js/rig.js").then((r) => {
      if (stopped) return;
      const backdrop = paintBackdrop();
      const frames = FIGHTERS.map((f) => fighterFrames(r, f));
      const [scene, g] = makeCanvas(W, H);
      const out = canvas.getContext("2d")!;
      const rand = seeded(7);
      const stars = Array.from({ length: 70 }, () => ({ x: Math.floor(rand() * W), y: Math.floor(rand() * 110), p: rand() * 6 }));
      const sparks = Array.from({ length: 22 }, () => ({ x: W / 2 - 30 + rand() * 60, y: 60 + rand() * 90, v: 0.15 + rand() * 0.35, p: rand() * 6 }));
      const fps = r.RIG_ANIMS.idle.fps;

      const paint = (t: number) => {
        const s = t / 1000;
        g.drawImage(backdrop, 0, 0);
        for (const st of stars) {
          g.fillStyle = Math.sin(s * 1.6 + st.p) > 0.55 ? "#f6e2a6" : "#5c5470";
          g.fillRect(st.x, st.y, 1, 1);
        }
        // Two spotlights sweeping slowly over the champion.
        for (const side of [-1, 1]) {
          const sway = reduce ? 0 : Math.sin(s * 0.5 + (side > 0 ? 1.4 : 0)) * 14;
          const grad = g.createLinearGradient(0, H, 0, 40);
          grad.addColorStop(0, "rgba(242,193,78,0.18)");
          grad.addColorStop(1, "rgba(242,193,78,0)");
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(W / 2 + side * 150, H);
          g.lineTo(W / 2 + side * 128, H);
          g.lineTo(W / 2 + sway - 26, 40);
          g.lineTo(W / 2 + sway + 26, 40);
          g.closePath();
          g.fill();
        }
        const tick = reduce ? 0 : Math.floor(s * fps);
        // Draw the back row first so the front row overlaps it.
        FIGHTERS.map((f, i) => ({ f, i }))
          .sort((a, b) => a.f.y - b.f.y)
          .forEach(({ f, i }) => {
            const img = frames[i][tick % frames[i].length];
            g.drawImage(img, Math.round(f.x), Math.round(f.y), FRAME_W * f.scale, FRAME_H * f.scale);
          });
        // Gold sparks rising around the champion.
        for (const sp of sparks) {
          const y = reduce ? sp.y : ((sp.y - s * sp.v * 30) % 100 + 100) % 100 + 54;
          g.fillStyle = Math.sin(s * 3 + sp.p) > 0 ? GOLD : "#fff3c4";
          g.fillRect(Math.round(sp.x + Math.sin(s + sp.p) * 2), Math.round(y), 1, 1);
        }
        // Scale up crisp, covering the box and keeping the centre in view.
        const cw = canvas.width;
        const ch = canvas.height;
        const k = Math.max(cw / W, ch / H);
        out.imageSmoothingEnabled = false;
        out.fillStyle = "#07060b";
        out.fillRect(0, 0, cw, ch);
        out.drawImage(scene, (cw - W * k) / 2, (ch - H * k) / 2, W * k, H * k);
      };

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        paint(performance.now());
      };
      ro = new ResizeObserver(resize);
      ro.observe(canvas);
      resize();

      let last = 0;
      const loop = (t: number) => {
        if (stopped) return;
        // About 20 frames a second is plenty for pixel art; skip work while off screen or hidden.
        if (visible && !document.hidden && t - last > 50) {
          last = t;
          paint(t);
        }
        raf = requestAnimationFrame(loop);
      };
      if (!reduce) raf = requestAnimationFrame(loop);
    }).catch(() => {
      /* Without the renderer the hero keeps its dark backdrop and the text still reads. */
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="Chiến gia tộc trong Petfarm: gia tộc Hỏa cờ đỏ và gia tộc Thủy cờ xanh đối mặt nhau, các bé đeo kính râm, dây chuyền vàng; ở giữa là bé Hoàng Long đội vương miện đứng trên bục vàng."
      className={cn("block h-full w-full bg-[#07060b] [image-rendering:pixelated]", className)}
    />
  );
}
