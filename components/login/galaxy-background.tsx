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

/**
 * Points drawn by a small shader: each has its own size and a Gaussian falloff,
 * so tens of thousands of faint, overlapping discs blend into smooth haze
 * instead of a grain of hard dots. `scale` keeps sizes stable across pixel ratios.
 */
function softPoints(THREE: Three, geometry: InstanceType<Three["BufferGeometry"]>, opacity: number, scale: number) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uOpacity: { value: opacity }, uScale: { value: scale } },
    vertexShader: `
      uniform float uScale;
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;
      void main() {
        vColor = aColor;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r2 = dot(d, d) * 4.0;
        if (r2 > 1.0) discard;
        float a = exp(-r2 * 3.2) * uOpacity;
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
  });
  return { points: new THREE.Points(geometry, material), material };
}

function startGalaxy(THREE: Three, el: HTMLElement): () => void {
  let renderer: InstanceType<Three["WebGLRenderer"]>;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return () => {}; // no WebGL: the CSS glow stays
  }
  const small = el.clientWidth < 640;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(el.clientWidth, el.clientHeight, false);
  Object.assign(renderer.domElement.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.1, 100);
  camera.position.set(0, 1.9, 6.6);
  camera.lookAt(0, 0, 0);

  const glow = roundSprite(THREE, "rgba(255,190,140,1)", 256);
  const sizeScale = el.clientHeight * pixelRatio * 0.9;

  // Spiral galaxy: a flattened round bulge (first fifth of the points), then arms
  // thrown wide so they melt into a hazy disc, thin in height, bluer towards the rim.
  const radius = 6;
  const branches = 3;
  const spin = 0.55;
  // Warm core, pale pink mid-disc, blue rim.
  const inside = new THREE.Color("#ffd3a0");
  const middle = new THREE.Color("#f0c3dc");
  const outside = new THREE.Color("#5f7cff");
  const mixed = new THREE.Color();
  const tint = (t: number) => (t < 0.45 ? mixed.copy(inside).lerp(middle, t / 0.45) : mixed.copy(middle).lerp(outside, Math.min(1, (t - 0.45) / 0.45)));
  const dir = new THREE.Vector3();
  const scatter = (power: number, scale: number) => Math.pow(Math.random(), power) * (Math.random() < 0.5 ? 1 : -1) * scale;
  const fill = (count: number, dust: boolean) => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const bulge = Math.floor(count * 0.2);
    for (let i = 0; i < count; i++) {
      let r: number;
      if (i < bulge) {
        r = Math.pow(Math.random(), 1.1) * 1.1;
        dir.randomDirection().multiplyScalar(r);
        positions.set([dir.x, dir.y * 0.55, dir.z], i * 3);
      } else {
        r = 0.6 + Math.pow(Math.random(), 1.4) * (radius - 0.6);
        const t = r / radius;
        const angle = ((i % branches) / branches) * Math.PI * 2 + r * spin;
        const spread = (dust ? 0.8 : 0.65) * (0.5 + t);
        positions[i * 3] = Math.cos(angle) * r + scatter(1.5, spread * r);
        positions[i * 3 + 1] = scatter(2.2, (dust ? 0.1 : 0.04) + 0.12 * (1 - t));
        positions[i * 3 + 2] = Math.sin(angle) * r + scatter(1.5, spread * r);
      }
      tint(r / radius);
      colors.set([mixed.r, mixed.g, mixed.b], i * 3);
      // Dust: large soft clouds. Stars: mostly tiny, a few brighter.
      sizes[i] = dust ? 0.18 + Math.random() * 0.3 : 0.014 + Math.pow(Math.random(), 3) * 0.04;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    return geometry;
  };
  const starGeometry = fill(small ? 60_000 : 160_000, false);
  const dustGeometry = fill(small ? 3_000 : 7_000, true);
  const starsLayer = softPoints(THREE, starGeometry, 0.55, sizeScale);
  const dustLayer = softPoints(THREE, dustGeometry, 0.055, sizeScale);

  // The bright bulge: one soft sprite, flattened like the tilted disc.
  const coreMaterial = new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
  const core = new THREE.Sprite(coreMaterial);
  core.scale.set(3.4, 1.7, 1);

  // Far stars all around.
  const farCount = small ? 1_200 : 3_000;
  const farPositions = new Float32Array(farCount * 3);
  const farColors = new Float32Array(farCount * 3);
  const farSizes = new Float32Array(farCount);
  const farTint = new THREE.Color("#c9d4ff");
  for (let i = 0; i < farCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(18 + Math.random() * 22);
    farPositions.set([v.x, v.y, v.z], i * 3);
    farColors.set([farTint.r, farTint.g, farTint.b], i * 3);
    farSizes[i] = 0.09 + Math.pow(Math.random(), 3) * 0.26;
  }
  const farGeometry = new THREE.BufferGeometry();
  farGeometry.setAttribute("position", new THREE.BufferAttribute(farPositions, 3));
  farGeometry.setAttribute("aColor", new THREE.BufferAttribute(farColors, 3));
  farGeometry.setAttribute("aSize", new THREE.BufferAttribute(farSizes, 1));
  const farLayer = softPoints(THREE, farGeometry, 0.85, sizeScale);
  const stars = farLayer.points;

  const disc = new THREE.Group();
  disc.add(starsLayer.points, dustLayer.points);
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
    for (const layer of [starsLayer, dustLayer, farLayer]) layer.material.uniforms.uScale.value = h * pixelRatio * 0.9;
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
    for (const thing of [starGeometry, dustGeometry, farGeometry, starsLayer.material, dustLayer.material, farLayer.material, coreMaterial, glow]) thing.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
