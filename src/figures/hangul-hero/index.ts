import gsap from "gsap";
import * as THREE from "three";

import atlasUrl from "./glyphs.sdf.bin?url";
import * as ease from "./ease.ts";
import { fragmentShader, PAIR_COUNT, vertexShader } from "./field.glsl.ts";
import { ATLAS, buildLayout, MERGE } from "./layout.ts";
import type { Layout, Rect } from "./layout.ts";

/**
 * 박상현 → "Sean Park", as one continuous signed-distance mark.
 *
 * Follows the figure contract in docs/concept.md: one mount function, a handle
 * with dispose/pause/resume, no work while off-screen, and nothing on the page
 * that depends on it rendering.
 *
 * The transform is a paused GSAP timeline that `scrub()` seeks. The debug
 * slider and the played sequence drive the same timeline, so what gets tuned
 * on the slider is exactly what plays and the two cannot drift apart.
 */

const MAX_PIXEL_RATIO = 2;

/** Duration of the transform in seconds, independent of the sequence. */
const TRANSFORM_DURATION = 4;

/** Sequence beats, in seconds. */
const BEAT = {
  /** 박상현 holds, still. Long enough to be read as a word first. */
  hold: 1.3,
  /** The morph runs from here for TRANSFORM_DURATION. */
  morph: 1.3,
  /** Copy fades in under the settled mark. */
  copy: 5.6,
  end: 7,
} as const;

/**
 * Release order for the per-part stagger: finals first, then initials, then
 * vowels. Never all nine at once, and not a left-to-right wave either — the
 * bottom tier of every block letting go before the tier above it is what makes
 * the mark look like it is coming apart under its own weight.
 */
const RELEASE_ORDER = [2, 5, 8, 0, 3, 6, 1, 4, 7];

/** Fraction of the transform each part's release is spread across. */
const STAGGER_SPAN = 0.14;

/**
 * Smooth-union radius at rest and at the peak of the transit, in design units.
 *
 * A stroke in this layout is about 0.08 across, so the peak is deliberately
 * well under that: enough that parts passing close to one another neck
 * together into ligatures, not so much that the detail is rounded off. Taking
 * it near a stroke width turns the mark into a puddle — legibility is the
 * whole reason the field approach is better than crossfading, and blurring it
 * away gives up exactly that.
 */
const BLEND = { rest: 0.012, peak: 0.072 };

/**
 * How far parts are drawn toward the centre at the peak of the transit — a
 * light squeeze that keeps the mark reading as one object while its parts are
 * crossing, rather than as nine things in transit.
 */
const GATHER = 0.26;

/** Extra size at the peak, so the mark does not visibly lose mass mid-flight. */
const SWELL = 0.16;

/**
 * Perpendicular displacement while travelling, as a fraction of the distance
 * covered, and the cap on it.
 *
 * 박 is the family name and lands at the *end* of "Sean Park", while 상현
 * becomes "Sean" at the start — so the two halves of the name swap sides and
 * their parts have to cross. Sending alternate parts over and under separates
 * that traffic into two legible streams. Straight lines put all nine through
 * the same middle at the same moment, which is where the mush came from.
 */
const ARC = { rate: 0.11, max: 0.19 };

export interface HeroOptions {
  autoplay?: boolean;
  /**
   * What a reduced-motion visitor sees. "resolved" is the end of the sequence
   * ("Sean Park"), which is the state the copy beneath the hero is written
   * against; "composed" is 박상현, the state it starts from.
   */
  reducedMotionState?: "resolved" | "composed";
  /** Called with the sequence's own progress, for driving DOM copy. */
  onProgress?: (progress: number) => void;
}

export interface HeroHandle {
  dispose(): void;
  pause(): void;
  resume(): void;
  /** Seek the transform, 0 → 1. Renders immediately; does not start the loop. */
  scrub(progress: number): void;
  /** Play the full timed sequence from the top. */
  play(): void;
  readonly running: boolean;
}

/** Per-part animated state, written by GSAP and read when uploading uniforms. */
interface PartState {
  /** 0 = in its Hangul block, 1 = resolved as a letter. */
  transit: number;
  /** 0 = jamo outline, 1 = Latin outline. Lags `transit`. */
  shape: number;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Zoom that fits a design-space box into a frame of half-extent (aspect, 1). */
function fitZoom(width: number, height: number, aspect: number, margin: number): number {
  return Math.min((2 * aspect) / (width * margin), 2 / (height * margin));
}

export function mountHangulHero(root: HTMLElement, options: HeroOptions = {}): HeroHandle {
  const { autoplay = false, reducedMotionState = "resolved", onProgress } = options;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.createElement("canvas");
  // The canvas carries no information the copy does not. Everything readable
  // is real DOM, outside this element.
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "display:block;width:100%;height:100%";

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  } catch {
    // No WebGL, or a blocked context. The page is already complete without us.
    return inert();
  }
  root.append(canvas);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  const scene = new THREE.Scene();
  // The vertex shader writes clip space directly, so the camera is a formality.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const layout: Layout = buildLayout();

  const rects = Array.from({ length: PAIR_COUNT }, () => new THREE.Vector4());
  const forms = layout.pairs.map((pair) => new THREE.Vector4(0, 0, pair.from, pair.to));

  const uniforms = {
    uAtlas: { value: null as THREE.DataTexture | null },
    uAtlasGrid: { value: new THREE.Vector2(ATLAS.cols, ATLAS.rows) },
    uAtlasTile: { value: ATLAS.tile },
    uSpread: { value: ATLAS.spread },
    uRect: { value: rects },
    uForm: { value: forms },
    uBlend: { value: BLEND.rest },
    uView: { value: new THREE.Vector3(0, 0, 1) },
    uViewport: { value: new THREE.Vector2(1, 1) },
    // In design units, and deliberately narrow: a stroke in this layout is
    // roughly 0.08 across, so a wider roll-off rounds every stroke into a tube
    // and the mark stops looking cut and starts looking inflated.
    uBevel: { value: 0.028 },
    uGrain: { value: 0.022 },
    uSeed: { value: 0 },
    // Graphite that takes a warm key and a cool edge. Restrained on purpose:
    // the form is doing the work, and a near-monochrome mark on near-black is
    // what keeps it reading as an object rather than as an effect.
    uInk: { value: new THREE.Color(0x0a0c10) },
    uKey: { value: new THREE.Color(0xd6cfc2) },
    uRim: { value: new THREE.Color(0x5d79a8) },
    uBackground: { value: new THREE.Color(0x08080a) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    glslVersion: THREE.GLSL3,
    depthTest: false,
    depthWrite: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);

  // --- Animated state ------------------------------------------------------
  const parts: PartState[] = layout.pairs.map(() => ({ transit: 0, shape: 0 }));

  /**
   * Peak vertical displacement for each part, signed so neighbours separate.
   *
   * Scaled by how far the part actually travels: a jamo staying roughly where
   * it is should not loop for no reason, and one crossing the whole name needs
   * the clearance.
   */
  const arcs = layout.pairs.map((pair, i) => {
    const travel = Math.abs(pair.resolved.cx - pair.composed.cx);
    const magnitude = Math.min(travel * ARC.rate, ARC.max);
    return i % 2 === 0 ? magnitude : -magnitude;
  });
  const global = { gather: 0, blend: BLEND.rest, swell: 0 };

  /**
   * Framing.
   *
   * `push` and `release` are what the timeline animates — both plain 0 → 1
   * scalars. The actual zoom is derived from them against `near`/`far`, which
   * only `resize()` writes. Letting GSAP tween the zoom directly meant two
   * owners for one number: GSAP captured its start value on the first render,
   * `resize()` then changed what that value should have been, and the frame
   * came back at the wrong scale.
   */
  const view = { push: 0, release: 0, near: 1, far: 1 };

  function zoom(): number {
    // A shallow push-in through the middle, then out past the start for the
    // wider resolved line.
    return lerp(lerp(view.near, view.near * 1.06, view.push), view.far, view.release);
  }

  let dirty = true;

  /**
   * Rebuilds the uniform arrays from the animated state.
   *
   * The rectangles are interpolated here rather than tweened directly because
   * two of the three effects are global — the gather that pulls everything
   * toward the centre, and the swell that thickens it while gathered — and
   * applying those on top of nine independent tweens is cheaper and easier to
   * reason about than expressing them as nine more tweens.
   */
  function applyState() {
    for (let i = 0; i < layout.pairs.length; i++) {
      const pair = layout.pairs[i];
      const part = parts[i];
      const from: Rect = pair.composed;
      const to: Rect = pair.resolved;

      const t = part.transit;

      let cx = lerp(from.cx, to.cx, t);
      let cy = lerp(from.cy, to.cy, t);
      let hx = lerp(from.hx, to.hx, t);
      let hy = lerp(from.hy, to.hy, t);

      // Gather and swell come from the global clock, not from this part's own
      // progress. Scaling them per part meant anything that had already
      // arrived got no gather at all and stood off on its own while the rest
      // were still bunched — nine parts on nine schedules, which is the
      // opposite of one mark. Both tweens return to zero, so the end states
      // are still exactly the layout.
      cx *= 1 - global.gather;
      cy *= 1 - global.gather;

      const swell = 1 + global.swell;
      hx *= swell;
      hy *= swell;

      // The vertical arc stays per-part: it exists to separate crossing
      // traffic, which is a property of each part's own journey. Peaks at the
      // halfway point and returns to nothing.
      const inFlight = Math.sin(Math.PI * t);
      cy += arcs[i] * inFlight;

      rects[i].set(cx, cy, hx, hy);

      // A small counter-rotation while in flight, opposite for alternate parts
      // so the mass looks like it is turning through itself rather than
      // drifting one way.
      forms[i].x = (i % 2 === 0 ? 1 : -1) * inFlight * 0.22;
      forms[i].y = pair.fuses ? 0 : part.shape;
    }

    uniforms.uBlend.value = global.blend;
    uniforms.uView.value.z = zoom();
    dirty = true;
  }

  // --- Timeline ------------------------------------------------------------
  const timeline = gsap.timeline({ paused: true, onUpdate: applyState });

  RELEASE_ORDER.forEach((index, order) => {
    const at = (order / (RELEASE_ORDER.length - 1)) * STAGGER_SPAN * TRANSFORM_DURATION;
    const span = TRANSFORM_DURATION - STAGGER_SPAN * TRANSFORM_DURATION;
    const part = parts[index];
    const pair = layout.pairs[index];

    timeline.to(part, { transit: 1, duration: span, ease: ease.mechanism }, at);

    if (!pair.fuses) {
      // The outline changes later and faster than the position does. That lag
      // is what sells it as one shape being reworked: the jamo is visibly
      // still a jamo while it is already on its way, and only becomes a letter
      // once it is nearly home.
      timeline.to(
        part,
        { shape: 1, duration: span * 0.74, ease: ease.flow },
        at + span * 0.22,
      );
    }
  });

  // The ninth jamo holds its position longer than the others and then closes,
  // so the ring is still visibly a ring while the letters are forming around
  // it and the fusion reads as the last thing that happens.
  const fusing = parts[MERGE.jamo];
  timeline.set(fusing, { transit: 0 }, 0);
  timeline.to(
    fusing,
    { transit: 1, duration: TRANSFORM_DURATION * (1 - MERGE.start), ease: ease.absorb },
    TRANSFORM_DURATION * MERGE.start,
  );

  // Global shape of the transit: gather in, blend up, then release.
  timeline.to(global, { gather: GATHER, swell: SWELL, duration: TRANSFORM_DURATION * 0.44, ease: ease.mechanism }, 0);
  timeline.to(
    global,
    { gather: 0, swell: 0, duration: TRANSFORM_DURATION * 0.56, ease: ease.seat },
    TRANSFORM_DURATION * 0.44,
  );
  timeline.to(global, { blend: BLEND.peak, duration: TRANSFORM_DURATION * 0.4, ease: ease.mechanism }, 0);
  timeline.to(
    global,
    { blend: BLEND.rest, duration: TRANSFORM_DURATION * 0.5, ease: ease.detent },
    TRANSFORM_DURATION * 0.5,
  );

  // The frame breathes with the mark. Both are plain 0 → 1 scalars; `zoom()`
  // turns them into a distance against the current fit.
  timeline.to(view, { push: 1, duration: TRANSFORM_DURATION * 0.45, ease: ease.camera }, 0);
  timeline.to(
    view,
    { release: 1, duration: TRANSFORM_DURATION * 0.55, ease: ease.camera },
    TRANSFORM_DURATION * 0.45,
  );

  timeline.totalDuration(TRANSFORM_DURATION);

  // --- Sequence ------------------------------------------------------------
  // The transform stays a standalone paused timeline; the sequence is a clock
  // that seeks it. Nesting it in a parent would work for playback and then
  // fight `scrub()` for the playhead.
  function applySequence(time: number) {
    timeline.progress(
      THREE.MathUtils.clamp((time - BEAT.morph) / TRANSFORM_DURATION, 0, 1),
    );
    onProgress?.(time / BEAT.end);
    dirty = true;
  }

  // --- Loop ----------------------------------------------------------------
  const clock = new THREE.Clock();
  let frameId = 0;
  let running = false;
  let visible = true;
  let inViewport = true;
  let sequenceTime = 0;
  let playing = false;
  /** False until the atlas has landed; before that there is nothing to draw. */
  let ready = false;
  /** Last position `scrub()` was asked for, replayed once the atlas lands. */
  let sought = 0;

  function resize() {
    const { clientWidth, clientHeight } = root;
    if (clientWidth === 0 || clientHeight === 0) return;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    renderer.setSize(clientWidth, clientHeight, false);

    const aspect = clientWidth / clientHeight;
    uniforms.uViewport.value.set(aspect, 1);

    const [cw, ch] = layout.composedSize;
    const [rw, rh] = layout.resolvedSize;
    view.near = fitZoom(cw, ch, aspect, 1.72);
    view.far = fitZoom(rw, rh, aspect, 1.95);

    applyState();
    dirty = true;
  }

  function render() {
    renderer.render(scene, camera);
    dirty = false;
  }

  function tick() {
    frameId = requestAnimationFrame(tick);

    // Clamped, so a backgrounded tab that missed frames resumes rather than
    // jumping the sequence forward by however long it was away.
    const delta = Math.min(clock.getDelta(), 0.1);

    if (playing) {
      sequenceTime = Math.min(sequenceTime + delta, BEAT.end);
      applySequence(sequenceTime);
      if (sequenceTime >= BEAT.end) playing = false;
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
    // `playing` is left alone either way — the sequence advances on the loop's
    // own delta, so stopping the loop is what pauses it.
    if (visible && inViewport && !reducedMotion) start();
    else stop();
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      inViewport = entry.isIntersecting;
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

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (ready && !running) render();
  });
  resizeObserver.observe(root);

  // --- Atlas ---------------------------------------------------------------
  // The only asset. Fetched rather than inlined: 256 KB of field data as
  // base64 in the JS bundle would cost more than it does as a compressible
  // binary the browser can cache on its own.
  let disposed = false;

  fetch(atlasUrl)
    .then((response) => response.arrayBuffer())
    .then((buffer) => {
      if (disposed) return;

      const texture = new THREE.DataTexture(
        new Uint8Array(buffer),
        ATLAS.tile * ATLAS.cols,
        ATLAS.tile * ATLAS.rows,
        THREE.RedFormat,
        THREE.UnsignedByteType,
      );
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.needsUpdate = true;

      uniforms.uAtlas.value = texture;

      resize();
      settle();
    })
    .catch(() => {
      // Same posture as no WebGL: the copy is already the whole hero.
    });

  /**
   * Puts the scene into its initial state once the atlas is available.
   *
   * The atlas arrives a frame or more after mount, and by then the caller may
   * already have asked for something — Storybook's scrub story seeks
   * synchronously on mount. So this honours a seek that already happened
   * rather than resetting to the top, which is what was silently pinning the
   * scrub story to the composed state.
   */
  function settle() {
    ready = true;

    if (reducedMotion) {
      // No loop is ever started and nothing is left scheduled: one frame,
      // drawn at whichever end of the sequence the caller asked for.
      const at = reducedMotionState === "resolved" ? 1 : 0;
      timeline.progress(at).pause();
      applyState();
      render();
      onProgress?.(at);
      return;
    }

    if (playing) {
      applySequence(sequenceTime);
      start();
      return;
    }

    timeline.progress(sought).pause();
    applyState();
    render();
  }

  // Arming rather than starting: the loop cannot draw until the atlas lands,
  // and `settle()` picks this up when it does.
  if (autoplay && !reducedMotion) {
    sequenceTime = 0;
    playing = true;
  }

  resize();

  return {
    dispose() {
      disposed = true;
      stop();
      playing = false;
      timeline.kill();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);

      uniforms.uAtlas.value?.dispose();
      quad.geometry.dispose();
      material.dispose();
      renderer.dispose();

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
      // Seeking takes the playhead away from the sequence, so the sequence
      // stops rather than fighting it for the next frame.
      playing = false;
      sought = THREE.MathUtils.clamp(progress, 0, 1);
      timeline.progress(sought).pause();
      applyState();
      if (ready && !running) render();
    },

    play() {
      if (reducedMotion) return;
      sequenceTime = 0;
      playing = true;
      if (!ready) return; // `settle()` will start it as soon as the atlas lands.
      applySequence(0);
      start();
    },

    get running() {
      return running;
    },
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
  };
}
