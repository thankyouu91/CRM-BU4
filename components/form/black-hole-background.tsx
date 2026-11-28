"use client";

import { useEffect, useRef } from "react";
import { roundSprite, softPoints } from "@/components/login/galaxy-background";

type Three = typeof import("three");

/**
 * Backdrop of the company form: a black hole in the manner of the film renders. Its disk
 * is drawn as thousands of thin streaks of gas on their orbits (closer in: faster, whiter);
 * the side coming towards us burns white; a thick camera-facing ring stands in for the far
 * side of the disk bent over and under the hole by its gravity. three.js loads only here;
 * without WebGL the CSS glow under it shows; with reduced motion it is drawn once; it
 * pauses while the tab is hidden.
 */
export function BlackHoleBackground({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let stopped = false;
    let stop = () => {};
    void import("three").then((THREE) => {
      if (!stopped) stop = startBlackHole(THREE, el);
    });
    return () => {
      stopped = true;
      stop();
    };
  }, []);
  return <div ref={host} aria-hidden className={className} />;
}

interface GasOptions {
  /** Height of the layer around the disk plane. */
  thickness: number;
  /** Streak length along the orbit, in radians; 0 draws soft points instead (haze). */
  streak: number;
  /** Point size range (haze only). */
  size?: [number, number];
  opacity: number;
  scale: number;
  /** Doppler beaming: how much brighter (and whiter) the approaching side is. */
  beam: number;
  /** Lensed ring: brighter over and under the hole than at its sides. */
  arcs?: boolean;
  /** Colour stops from the inner to the outer edge. */
  colors: string[];
}

/**
 * Gas that orbits on the GPU: each streak (two line ends) or point keeps its radius, angle
 * and height, and the shader turns it at Kepler speed (inner gas faster).
 */
function orbitingGas(THREE: Three, count: number, inner: number, outer: number, o: GasOptions) {
  const ends = o.streak ? 2 : 1;
  const n = count * ends;
  const radius = new Float32Array(n);
  const angle = new Float32Array(n);
  const height = new Float32Array(n);
  const size = new Float32Array(n);
  const tail = new Float32Array(n); // 0 at a streak's tail, 1 at its head
  const color = new Float32Array(n * 3);
  const stops = o.colors.map((c) => new THREE.Color(c));
  const mixed = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 1.7); // denser towards the hole
    const r = inner + t * (outer - inner);
    const a = Math.random() * Math.PI * 2;
    const h = (Math.random() - 0.5) * o.thickness * (0.25 + t);
    const len = (o.streak * (0.4 + Math.random())) / Math.sqrt(r);
    const k = Math.min(0.999, t * (stops.length - 1));
    mixed.copy(stops[Math.floor(k)]).lerp(stops[Math.floor(k) + 1], k % 1);
    const brightness = 0.55 + Math.random() * 0.45;
    const s = o.size ? o.size[0] + Math.pow(Math.random(), 3) * o.size[1] : 0;
    for (let e = 0; e < ends; e++) {
      const j = i * ends + e;
      radius[j] = r;
      angle[j] = a - e * len; // the head leads: gas turns towards smaller angles
      height[j] = h;
      size[j] = s;
      tail[j] = ends === 2 ? e : 1;
      color.set([mixed.r * brightness, mixed.g * brightness, mixed.b * brightness], j * 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  // three.js needs a position attribute to draw; the shader works from the others.
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometry.setAttribute("aRadius", new THREE.BufferAttribute(radius, 1));
  geometry.setAttribute("aAngle", new THREE.BufferAttribute(angle, 1));
  geometry.setAttribute("aHeight", new THREE.BufferAttribute(height, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  geometry.setAttribute("aTail", new THREE.BufferAttribute(tail, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(color, 3));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), outer + 1);
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    defines: o.streak ? { STREAK: 1 } : {},
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: o.opacity },
      uScale: { value: o.scale },
      uBeam: { value: o.beam },
      uArcs: { value: o.arcs ? 1 : 0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uScale;
      uniform float uBeam;
      uniform float uArcs;
      attribute float aRadius;
      attribute float aAngle;
      attribute float aHeight;
      attribute float aSize;
      attribute float aTail;
      attribute vec3 aColor;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        // Turning this way, the left side (-x) moves towards the camera (+z).
        float a = aAngle - uTime * 0.9 / pow(aRadius, 1.5);
        vec3 p = vec3(cos(a) * aRadius, aHeight, sin(a) * aRadius);
        // Doppler beaming: gas moving towards the viewer (on the left, -x) is brighter and whiter.
        float towards = max(0.0, -cos(a));
        float away = max(0.0, cos(a));
        vec3 c = mix(aColor, vec3(1.0, 0.97, 0.92), uBeam * towards * 0.6);
        c *= 1.0 + uBeam * 1.4 * towards - uBeam * 0.5 * away;
        // Lensed ring: bright over and under the hole, softer at its sides.
        c *= mix(1.0, 0.45 + 0.9 * pow(abs(sin(a)), 1.5), uArcs);
        vColor = c;
        vAlpha = aTail; // streaks fade in from tail to head
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        #ifdef STREAK
          float a = vAlpha * uOpacity;
        #else
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot(d, d) * 4.0;
          if (r2 > 1.0) discard;
          float a = exp(-r2 * 3.2) * uOpacity;
        #endif
        gl_FragColor = vec4(vColor * a, a);
      }
    `,
  });
  const object = o.streak ? new THREE.LineSegments(geometry, material) : new THREE.Points(geometry, material);
  return { object, material, geometry };
}

// Inner edge white-hot, then gold, amber and a dim rust rim.
const DISK = ["#fffaf2", "#ffe2b0", "#ffb35c", "#d9692c", "#5a2412"];
const RING = ["#ffffff", "#fff3dc", "#ffd59a", "#e8954a"];

function startBlackHole(THREE: Three, el: HTMLElement): () => void {
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
  const camera = new THREE.PerspectiveCamera(42, el.clientWidth / el.clientHeight, 0.1, 100);
  const scale = el.clientHeight * pixelRatio * 0.9;

  // The shadow: a black ball that hides the gas behind it.
  const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));

  // Accretion disk, nearly edge-on: fine streaks, a few long bright ones, and soft haze.
  const disk = orbitingGas(THREE, small ? 45_000 : 110_000, 1.5, 9, { thickness: 0.1, streak: 0.5, opacity: 0.14, scale, beam: 1, colors: DISK });
  const flares = orbitingGas(THREE, small ? 3_000 : 8_000, 1.5, 6, { thickness: 0.05, streak: 1.4, opacity: 0.3, scale, beam: 1, colors: DISK });
  const haze = orbitingGas(THREE, small ? 3_000 : 8_000, 1.5, 9.5, { thickness: 0.35, streak: 0, size: [0.35, 0.6], opacity: 0.035, scale, beam: 1, colors: DISK });
  const diskGroup = new THREE.Group();
  diskGroup.add(disk.object, flares.object, haze.object);
  diskGroup.rotation.z = 0.06;

  // The far side of the disk bent round the hole: a thick ring of the same streaks that
  // always faces the camera, with a thin, very bright photon ring at its inner edge.
  const halo = orbitingGas(THREE, small ? 30_000 : 70_000, 1.03, 1.8, { thickness: 0.02, streak: 0.6, opacity: 0.15, scale, beam: 0.35, arcs: true, colors: RING });
  const photon = orbitingGas(THREE, small ? 4_000 : 10_000, 1.0, 1.04, { thickness: 0.01, streak: 0.8, opacity: 0.22, scale, beam: 0.2, colors: ["#ffffff", "#fff6e6"] });
  const ringGlow = orbitingGas(THREE, small ? 2_000 : 5_000, 1.05, 1.9, { thickness: 0.02, streak: 0, size: [0.25, 0.4], opacity: 0.03, scale, beam: 0.3, arcs: true, colors: RING });
  const lensed = new THREE.Group();
  lensed.add(halo.object, photon.object, ringGlow.object);
  const faceCamera = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  // Warm light round the hole, brightest on the approaching (left) side, and far stars.
  const glow = roundSprite(THREE, "rgba(255,200,140,1)", 256);
  const glowMaterial = new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
  const glowSprite = new THREE.Sprite(glowMaterial);
  glowSprite.scale.set(13, 5, 1);
  glowSprite.position.set(-1.6, 0, 0);
  const farCount = small ? 1_500 : 3_500;
  const farPositions = new Float32Array(farCount * 3);
  const farColors = new Float32Array(farCount * 3);
  const farSizes = new Float32Array(farCount);
  const tints = ["#c9d4ff", "#ffffff", "#ffd9b0"].map((c) => new THREE.Color(c));
  for (let i = 0; i < farCount; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(25 + Math.random() * 25);
    const c = tints[i % tints.length];
    farPositions.set([v.x, v.y, v.z], i * 3);
    farColors.set([c.r, c.g, c.b], i * 3);
    farSizes[i] = 0.1 + Math.pow(Math.random(), 4) * 0.35;
  }
  const farGeometry = new THREE.BufferGeometry();
  farGeometry.setAttribute("position", new THREE.BufferAttribute(farPositions, 3));
  farGeometry.setAttribute("aColor", new THREE.BufferAttribute(farColors, 3));
  farGeometry.setAttribute("aSize", new THREE.BufferAttribute(farSizes, 1));
  const far = softPoints(THREE, farGeometry, 0.7, scale);

  const system = new THREE.Group();
  system.add(glowSprite, diskGroup, lensed, hole);
  scene.add(system, far.points);
  const gas = [disk, flares, haze, halo, photon, ringGlow];

  // Wide screens: a big hole to the right of the form, its disk sweeping left behind it.
  // Narrow screens (phone, tablet): the hole is the page's cover, in the top quarter of the
  // screen above the form (the page leaves that space empty); the view is lowered, not tilted.
  const base = { y: 0.8, z: 8.5, look: 0 };
  const layout = () => {
    const w = el.clientWidth;
    const h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w >= 1024;
    base.z = wide ? 8.5 : 13;
    // Half the view's height at the hole's distance: lowering the view by half of it puts the hole a quarter down.
    base.look = wide ? 0 : -0.5 * base.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    system.position.x = wide ? 3.5 : 0;
    system.position.y = wide ? 0.4 : 0;
    for (const layer of [...gas, far]) layer.material.uniforms.uScale.value = h * pixelRatio * 0.9;
  };
  layout();
  const resize = new ResizeObserver(layout);
  resize.observe(el);

  const target = { x: 0, y: 0 };
  const onPointer = (e: PointerEvent) => {
    target.x = (e.clientX / window.innerWidth - 0.5) * 0.6;
    target.y = (e.clientY / window.innerHeight - 0.5) * 0.25;
  };
  window.addEventListener("pointermove", onPointer);
  camera.position.set(0, base.y + base.look, base.z);

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clock = new THREE.Clock();
  const toCamera = new THREE.Vector3();
  let time = 0;
  let frame = 0;
  const render = () => {
    camera.lookAt(0, base.look, 0);
    lensed.quaternion.copy(camera.quaternion).multiply(faceCamera);
    // Just in front of the hole, so the ring's light spills over the black edge (no hard rim).
    toCamera.copy(camera.position).sub(system.position).normalize();
    lensed.position.copy(toCamera).multiplyScalar(1.02);
    for (const layer of gas) layer.material.uniforms.uTime.value = time;
    renderer.render(scene, camera);
  };
  const draw = () => {
    time += Math.min(clock.getDelta(), 0.05);
    far.points.rotation.y += 0.0003;
    camera.position.x += (target.x - camera.position.x) * 0.03;
    camera.position.y += (base.y + base.look + target.y - camera.position.y) * 0.03;
    camera.position.z += (base.z - camera.position.z) * 0.05;
    render();
    frame = requestAnimationFrame(draw);
  };
  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (document.visibilityState === "visible" && !still) {
      clock.getDelta();
      frame = requestAnimationFrame(draw);
    }
  };
  if (still) render();
  else {
    frame = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVisibility);
  }

  return () => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener("pointermove", onPointer);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const layer of gas) {
      layer.geometry.dispose();
      layer.material.dispose();
    }
    for (const thing of [farGeometry, far.material, glowMaterial, glow, hole.geometry, hole.material]) thing.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
