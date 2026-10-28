"use client";

import { useEffect, useRef } from "react";

type Three = typeof import("three");

/**
 * Sign-in backdrop: a slowly turning spiral galaxy of points. three.js is loaded
 * only here (a separate chunk), so the app itself carries none of it. Without
 * WebGL the CSS glow under the canvas shows instead; with reduced motion the
 * galaxy is drawn once and holds still; it pauses while the tab is hidden.
 */
export function GalaxyBackground({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stopped = false;
    let stop = () => {};
    void import("three").then((THREE) => {
      if (!stopped) stop = startGalaxy(THREE, el);
    });
    return () => {
      stopped = true;
      stop();
    };
  }, []);
  return <div ref={host} aria-hidden className={className} />;
}

/** Soft round sprite drawn on a canvas, so nothing is fetched (CSP: self only). */
function roundSprite(THREE: Three, inner: string, size = 64) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, inner.replace("1)", "0.45)"));
  grad.addColorStop(1, inner.replace("1)", "0)"));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function startGalaxy(THREE: Three, el: HTMLElement): () => void {
  let renderer: InstanceType<Three["WebGLRenderer"]>;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "low-power" });
  } catch {
    return () => {}; // no WebGL: the CSS glow stays
  }
  const small = el.clientWidth < 640;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(el.clientWidth, el.clientHeight, false);
  Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.1, 100);
  camera.position.set(0, 1.9, 6.6);
  camera.lookAt(0, 0, 0);

  const dot = roundSprite(THREE, "rgba(255,255,255,1)");
  const glow = roundSprite(THREE, "rgba(255,190,140,1)", 128);

  // Spiral arms: points thrown along branches that bend with distance, denser and
  // warmer near the core, bluer and sparser at the rim.
  const count = small ? 24_000 : 60_000;
  const radius = 6;
  const branches = 3;
  const spin = 0.55;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const inside = new THREE.Color("#ffb277");
  const outside = new THREE.Color("#4a63ff");
  const mixed = new THREE.Color();
  const scatter = (power: number, scale: number) => Math.pow(Math.random(), power) * (Math.random() < 0.5 ? 1 : -1) * scale;
  // A round, flattened bulge at the centre (first fifth of the points), then the disc:
  // arms thrown wide so they melt into haze, thin in height, bluer towards the rim.
  const bulge = Math.floor(count * 0.2);
  const dir = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    let r: number;
    if (i < bulge) {
      r = Math.pow(Math.random(), 1.4) * 1.1;
      dir.randomDirection().multiplyScalar(r);
      positions.set([dir.x, dir.y * 0.55, dir.z], i * 3);
    } else {
      r = 0.6 + Math.pow(Math.random(), 1.4) * (radius - 0.6);
      const t = r / radius;
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const angle = branch + r * spin;
      const spread = 0.55 * (0.5 + t);
      positions[i * 3] = Math.cos(angle) * r + scatter(1.8, spread * r);
      positions[i * 3 + 1] = scatter(2.2, 0.04 + 0.12 * (1 - t));
      positions[i * 3 + 2] = Math.sin(angle) * r + scatter(1.8, spread * r);
    }
    mixed.copy(inside).lerp(outside, Math.min(1, Math.pow(r / (radius * 0.8), 0.8)));
    colors.set([mixed.r, mixed.g, mixed.b], i * 3);
  }
  const galaxyGeometry = new THREE.BufferGeometry();
  galaxyGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  galaxyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const galaxyMaterial = new THREE.PointsMaterial({
    size: small ? 0.045 : 0.034,
    sizeAttenuation: true,
    map: dot,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
  });
  const galaxy = new THREE.Points(galaxyGeometry, galaxyMaterial);

  // The bright bulge: one soft sprite, flattened like the tilted disc.
  const coreMaterial = new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.Sprite(coreMaterial);
  core.scale.set(3.4, 1.7, 1);

  // Far stars all around.
  const starCount = small ? 900 : 2200;
  const starPositions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 22);
    starPositions.set([v.x, v.y, v.z], i * 3);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
  const starMaterial = new THREE.PointsMaterial({ size: 0.09, map: dot, transparent: true, opacity: 0.6, depthWrite: false, color: "#c9d4ff" });
  const stars = new THREE.Points(starGeometry, starMaterial);

  const disc = new THREE.Group();
  disc.add(galaxy);
  disc.rotation.z = -0.12;
  const group = new THREE.Group();
  group.add(disc, core);
  scene.add(group, stars);

  // On wide screens the form sits on the left, so the galaxy moves right.
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    group.position.x = w >= 1024 ? 1.9 : 0;
  };
  layout();
  const resize = new ResizeObserver(layout);
  resize.observe(el);

  // A little parallax with the pointer.
  const target = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.3;
  };
  window.addEventListener("pointermove", onPointer);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  let frame = 0;
  const draw = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    disc.rotation.y += dt * 0.04;
    stars.rotation.y += dt * 0.005;
    camera.position.x += (target.x - camera.position.x) * 0.03;
    camera.position.y += (1.9 + target.y - camera.position.y) * 0.03;
    camera.lookAt(group.position.x * 0.35, 0, 0);
    renderer.render(scene, camera);
    frame = requestAnimationFrame(draw);
  };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (document.visibilityState === "visible" && !still) {
      clock.getDelta();
      frame = requestAnimationFrame(draw);
    }
  };
  if (still) {
    camera.lookAt(group.position.x * 0.35, 0, 0);
    renderer.render(scene, camera);
  } else {
    frame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const thing of [galaxyGeometry, galaxyMaterial, starGeometry, starMaterial, coreMaterial, dot, glow]) thing.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
