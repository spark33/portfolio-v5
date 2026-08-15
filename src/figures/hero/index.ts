import gsap from "gsap";
import * as THREE from "three";

import * as ease from "./ease.ts";
import { loadHeroGeometry } from "./geometry.ts";
import type { HeroGeometry } from "./geometry.ts";
import { buildLayout } from "./layout.ts";
import type { Placed, Pose } from "./layout.ts";
import { createMorphDepthMaterial, createMorphMaterial } from "./material.ts";
import type { MorphUniforms } from "./material.ts";
import { createShadowCatcher, createStage } from "./stage.ts";

/**
 * The hero sequence: 박상현 → PARK SANGHYEON → SEAN PARK.
 *
 * Follows the figure contract in docs/concept.md — one mount function, a
 * handle with dispose/pause/resume, no work off-screen, and a page that is
 * complete without it.
 *
 * The whole sequence is one paused GSAP timeline that `scrub()` seeks, so the
 * debug slider and playback drive the same thing and cannot drift apart.
 */

/** Beats, in seconds. Deliberately off round numbers — evenly spaced stage
 *  boundaries are what make a sequence feel like a slideshow. */
export const BEAT = {
  hold: 2.6,
  separate: 4.1,
  decompose: 6,
  transliterate: 7.8,
  reduce: 8.9,
  end: 9.5,
} as const;

/** Per-glyph stagger within a stage. The material's own `uSpread` staggers
 *  vertices inside each glyph; two levels is what reads as mechanical. */
const STAGGER = 0.03;

/**
 * Duration of a staggered move so the *last* glyph still lands inside the
 * stage's window.
 *
 * A stagger spends part of the window before the last glyph even starts, and
 * ignoring that is how a stage silently overruns the next one: with 13 glyphs
 * the tail was still finishing its transliteration a beat after the reduction
 * had begun, so PARK slid across SANGHYEON mid-morph and the line rendered as
 * two words overlapping.
 */
function fits(window: number, count: number): number {
  return Math.max(window - (count - 1) * STAGGER, 0.35);
}

/** Block separation along z, and the few degrees each one turns. */
const SEPARATION = [
  { z: -0.55, angle: -0.12 },
  { z: 0.34, angle: 0.05 },
  { z: -0.86, angle: 0.14 },
];

/** Peak settle angle on arrival, in radians — about 2.5°. */
const SETTLE_ANGLE = 0.044;

export interface HeroOptions {
  autoplay?: boolean;
  /** What a reduced-motion visitor sees: the end of the sequence, or its start. */
  reducedMotionState?: "final" | "composed";
  onProgress?: (seconds: number) => void;
  /** Drops shadows and halves the pixel ratio ceiling. */
  lowPower?: boolean;
}

export interface HeroHandle {
  dispose(): void;
  pause(): void;
  resume(): void;
  /** Seek the sequence, 0 → 1. */
  scrub(progress: number): void;
  play(): void;
  readonly running: boolean;
  /** Resolves once the geometry has landed and the first frame is drawn. */
  readonly ready: Promise<void>;
}

/** Live animated state for one mesh. */
interface Live extends Pose {
  rotY: number;
  settle: number;
}

function copy(from: Pose): Live {
  return { ...from, rotY: 0, settle: 0 };
}

/** Rotates a point about a pivot in the xz plane. */
function orbit(x: number, z: number, pivotX: number, angle: number) {
  const dx = x - pivotX;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: pivotX + dx * cos + z * sin, z: -dx * sin + z * cos };
}

export function mountHero(root: HTMLElement, options: HeroOptions = {}): HeroHandle {
  const { autoplay = false, reducedMotionState = "final", onProgress, lowPower = false } = options;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  // The canvas carries nothing the copy does not. Everything readable is real
  // DOM, outside this element.
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%";

  let stage: ReturnType<typeof createStage>;
  try {
    root.append(canvas);
    stage = createStage(canvas, { shadows: !lowPower, maxPixelRatio: lowPower ? 1.5 : 2 });
  } catch {
    // No WebGL, or a blocked context. The page is already complete without us.
    canvas.remove();
    return inert();
  }

  const layout = buildLayout();
  const shadowCatcher = createShadowCatcher(-1.15);
  if (!lowPower) stage.scene.add(shadowCatcher);

  const meshes: Array<{
    mesh: THREE.Mesh;
    material: THREE.MeshPhysicalMaterial;
    depth: THREE.MeshDepthMaterial;
    uniforms: MorphUniforms;
    placed: Placed;
    live: Live;
  }> = [];

  let loaded: HeroGeometry[] = [];
  let disposed = false;
  let dirty = true;

  // --- Timeline ------------------------------------------------------------
  // Built before the geometry lands, so a seek that arrives early is honoured
  // rather than lost.
  const timeline = gsap.timeline({ paused: true, onUpdate: () => (dirty = true) });

  function build(geometries: HeroGeometry[]) {
    const byName = new Map(geometries.map((g) => [g.entry.name, g.geometry]));

    for (const placed of layout.placed) {
      const geometry = byName.get(placed.entry.name);
      if (!geometry) continue;

      const { material, uniforms } = createMorphMaterial();
      material.transparent = true;
      const depth = createMorphDepthMaterial(uniforms);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.customDepthMaterial = depth;
      mesh.castShadow = !lowPower;
      stage.root.add(mesh);

      meshes.push({ mesh, material, depth, uniforms, placed, live: copy(placed.composed) });
    }

    buildTimeline();
  }

  function buildTimeline() {
    const count = meshes.length;
    const decomposeFor = fits(BEAT.decompose - BEAT.separate, count);
    const morphFor = fits(BEAT.transliterate - BEAT.decompose, count);
    const reduceFor = fits(BEAT.reduce - BEAT.transliterate, count);

    meshes.forEach(({ placed, live }, index) => {
      const offset = index * STAGGER;

      // 2.6 — the blocks separate along z, each turning a few degrees about
      // its own centre. Computed on the CPU rather than with a group per
      // syllable, because the jamo leave those groups two beats later and
      // reparenting mid-timeline does not survive being scrubbed backwards.
      if (placed.entry.kind === "morph") {
        const block = SEPARATION[placed.entry.syllable!];
        const pivot =
          -(3 * 1.16 + 2 * 0.1) / 2 + placed.entry.syllable! * (1.16 + 0.1) + 1.16 / 2;
        const turned = orbit(placed.composed.x, placed.composed.z + block.z, pivot, block.angle);

        timeline.to(
          live,
          { x: turned.x, z: turned.z, rotY: block.angle, duration: 1.5, ease: ease.separation },
          BEAT.hold + placed.entry.syllable! * 0.12,
        );
      }

      // 4.1 — the jamo leave their blocks for a single line.
      timeline.to(
        live,
        { ...placed.line, rotY: 0, duration: decomposeFor, ease: ease.separation },
        BEAT.separate + offset,
      );
      // The settle rides the tail of the move rather than following it, so it
      // cannot push the stage past its window.
      timeline.to(
        live,
        { settle: 1, duration: 0.42, ease: "none" },
        BEAT.separate + offset + decomposeFor * 0.78,
      );
      timeline.set(live, { settle: 0 }, BEAT.separate + offset + decomposeFor * 0.78 + 0.42);

      // 6.0 — the transliteration morph. Splits resolve here: the copies of a
      // jamo that share one place until now travel to different letters.
      timeline.to(
        live,
        { ...placed.roman, duration: morphFor, ease: ease.morph },
        BEAT.decompose + offset,
      );

      // 7.8 — the reduction. The excess recedes, SEAN arrives.
      // The excess leaves first and the arrivals follow, so the eye sees the
      // name shed before it sees it replaced.
      const reduceAt = BEAT.transliterate + (placed.recedes ? offset * 0.4 : 0.2 + offset * 0.3);
      timeline.to(
        live,
        {
          ...placed.final,
          duration: reduceFor,
          ease: placed.recedes ? ease.morph : ease.separation,
        },
        reduceAt,
      );

      if (!placed.recedes) {
        timeline.to(
          live,
          { settle: 1, duration: 0.4, ease: "none" },
          reduceAt + reduceFor * 0.8,
        );
      }
    });

    timeline.totalDuration(BEAT.end);
  }

  // --- Camera --------------------------------------------------------------
  const view = { distance: 0, drift: 0, pull: 0 };

  function frame(width: number) {
    const vFov = (stage.camera.fov * Math.PI) / 180;
    // Generous margin: the blocks swing toward the camera during the
    // separation, and a fit with no headroom crops them at the sides.
    const forWidth = (width * 1.62) / 2 / Math.tan(vFov / 2) / stage.camera.aspect;
    const forHeight = (1.9 * 1.62) / 2 / Math.tan(vFov / 2);
    return Math.max(forWidth, forHeight, 2.6);
  }

  function applyCamera(seconds: number) {
    // Framed against whichever state the sequence is actually in, rather than
    // one distance for the whole run. The four states differ in width by more
    // than two to one, so a single fit either crops 박상현 or leaves
    // SANGHYEON swimming in empty frame.
    const keys: Array<[number, number]> = [
      [0, layout.widths.composed],
      [BEAT.separate, layout.widths.composed],
      [BEAT.decompose, layout.widths.line],
      [BEAT.transliterate, layout.widths.roman],
      [BEAT.reduce, layout.widths.roman],
      [BEAT.end, layout.widths.final],
    ];

    let width = keys[keys.length - 1][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, w0] = keys[i];
      const [t1, w1] = keys[i + 1];
      if (seconds <= t1) {
        const t = t1 === t0 ? 1 : (seconds - t0) / (t1 - t0);
        width = THREE.MathUtils.lerp(w0, w1, ease.morph(THREE.MathUtils.clamp(t, 0, 1)));
        break;
      }
    }

    const pull = THREE.MathUtils.clamp(
      (seconds - BEAT.reduce) / (BEAT.end - BEAT.reduce),
      0,
      1,
    );

    view.distance = frame(width) * (1 + 0.14 * ease.camera(pull));

    // A slow drift through the opening, so the first 2.6s is not a still.
    const drift = reducedMotion ? 0 : Math.sin(seconds * 0.31) * 0.09;
    stage.camera.position.set(drift, -drift * 0.4, view.distance);
    stage.camera.lookAt(0, 0, 0);
  }

  // --- Applying state ------------------------------------------------------
  function applyState() {
    for (const { mesh, material, uniforms, live } of meshes) {
      mesh.position.set(live.x, live.y, live.z);
      mesh.scale.set(live.scaleX, live.scaleY, 1);
      mesh.rotation.set(0, live.rotY + ease.settle(live.settle) * SETTLE_ANGLE, 0);

      uniforms.uProgress.value = live.morph;

      material.opacity = live.opacity;
      // Fully opaque meshes take the cheap path and keep depth writes, which
      // matters: seventeen sorted transparent objects would otherwise fight
      // over draw order for the whole sequence when only a few ever fade.
      const solid = live.opacity >= 0.999;
      material.transparent = !solid;
      material.depthWrite = solid;
      mesh.visible = live.opacity > 0.001;
    }
  }

  // --- Loop ----------------------------------------------------------------
  const clock = new THREE.Clock();
  let frameId = 0;
  let running = false;
  let visible = true;
  let inViewport = true;
  let playhead = 0;
  let playing = false;
  let readyResolve: () => void;
  const ready = new Promise<void>((resolve) => (readyResolve = resolve));

  function seek(seconds: number) {
    playhead = THREE.MathUtils.clamp(seconds, 0, BEAT.end);
    timeline.time(playhead);
    applyState();
    applyCamera(playhead);
    onProgress?.(playhead);
    dirty = true;
  }

  function render() {
    stage.renderer.render(stage.scene, stage.camera);
    dirty = false;
  }

  function tick() {
    frameId = requestAnimationFrame(tick);
    const delta = Math.min(clock.getDelta(), 0.1);

    if (playing) {
      seek(playhead + delta);
      if (playhead >= BEAT.end) playing = false;
    } else if (!reducedMotion) {
      // The camera keeps drifting even when the timeline is parked, so the
      // opening hold breathes.
      applyCamera(playhead);
      dirty = true;
    }

    if (dirty) render();
  }

  function start() {
    if (running || reducedMotion) return;
    running = true;
    clock.getDelta();
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function syncActivity() {
    if (visible && inViewport && !reducedMotion && loaded.length > 0) start();
    else stop();
  }

  const observer = new IntersectionObserver(
    ([first]) => {
      inViewport = first.isIntersecting;
      syncActivity();
    },
    { threshold: 0.01 },
  );
  observer.observe(canvas);

  function onVisibilityChange() {
    visible = document.visibilityState === "visible";
    syncActivity();
  }
  document.addEventListener("visibilitychange", onVisibilityChange);

  function resize() {
    stage.resize(root.clientWidth, root.clientHeight);
    applyCamera(playhead);
    dirty = true;
    if (loaded.length > 0 && !running) render();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  resize();

  // --- Geometry ------------------------------------------------------------
  loadHeroGeometry()
    .then((geometries) => {
      if (disposed) return;
      loaded = geometries;
      build(geometries);

      if (reducedMotion) {
        // One frame, no loop, nothing scheduled.
        seek(reducedMotionState === "final" ? BEAT.end : 0);
        render();
        readyResolve();
        return;
      }

      if (autoplay) {
        playhead = 0;
        playing = true;
      }
      seek(playing ? 0 : sought);
      render();
      readyResolve();
      syncActivity();
    })
    .catch(() => {
      // Same posture as no WebGL: the copy is the whole hero already.
      readyResolve();
    });

  let sought = 0;

  return {
    dispose() {
      disposed = true;
      stop();
      playing = false;
      timeline.kill();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);

      for (const { material, depth } of meshes) {
        material.dispose();
        depth.dispose();
      }
      for (const item of loaded) item.geometry.dispose();
      shadowCatcher.geometry.dispose();
      (shadowCatcher.material as THREE.Material).dispose();
      stage.dispose();
      canvas.remove();
    },

    pause() {
      inViewport = false;
      syncActivity();
    },

    resume() {
      inViewport = true;
      syncActivity();
    },

    scrub(progress) {
      if (reducedMotion) return;
      playing = false;
      sought = THREE.MathUtils.clamp(progress, 0, 1) * BEAT.end;
      if (loaded.length === 0) return;
      seek(sought);
      if (!running) render();
    },

    play() {
      if (reducedMotion) return;
      playhead = 0;
      playing = true;
      if (loaded.length === 0) return;
      seek(0);
      start();
    },

    get running() {
      return running;
    },

    ready,
  };
}

/** Handle for a scene that could not start. Every method is a no-op. */
function inert(): HeroHandle {
  return {
    dispose() {},
    pause() {},
    resume() {},
    scrub() {},
    play() {},
    get running() {
      return false;
    },
    ready: Promise.resolve(),
  };
}
