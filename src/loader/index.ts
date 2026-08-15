import { HANGUL, LATIN, VIEW } from "./glyphs.ts";
import type { Run } from "./glyphs.ts";

/**
 * The loading animation: 박상현 resolves into Sean Park.
 *
 * Inline SVG paths and transforms. No font to download, no WebGL context, no
 * geometry — which is the point: a loader that costs anything to start has
 * failed at the one job it has.
 *
 * The whole animation is a pure function of normalised time, `apply(t)`.
 * Nothing is stateful, nothing depends on having been played from the start,
 * and any frame can be rendered on demand. That is what makes it possible to
 * screenshot a filmstrip and iterate on the motion instead of guessing at it.
 */

/** Total duration in milliseconds. A loader that outstays this is a wait. */
export const DURATION = 1150;

/** How far a glyph travels vertically as it enters or leaves, in viewBox units. */
const RISE = 34;

/**
 * Sideways drift on the swap, in viewBox units.
 *
 * The old name leaves slightly to the left and the new one comes in slightly
 * from the right, so the exchange has a direction. Without it both runs travel
 * on the same axis and the middle of the animation reads as two words
 * occupying one space rather than as one replacing the other.
 */
const DRIFT = { out: -9, in: 11 };

/**
 * Beats, in normalised time.
 *
 * The windows are deliberately tight against each other. An earlier cut had
 * the exit running to 0.77 while the arrival began at 0.53, and for a quarter
 * of the animation "Sean Park" was drawn straight through 박상현 — legible as
 * neither. The handoff wants to be a brief pass, not a dissolve.
 */
const T = {
  enterFrom: 0,
  enterSpan: 0.26,
  enterStagger: 0.05,

  exitFrom: 0.36,
  exitSpan: 0.17,
  exitStagger: 0.028,

  arriveFrom: 0.5,
  arriveSpan: 0.34,
  arriveStagger: 0.026,
} as const;

/** CSS-style cubic bézier, solved for y given x. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number) =>
    3 * u2(t) * a + 6 * (1 - t) * t * (b - a) + 3 * t * t * (1 - b);
  const u2 = (t: number) => (1 - t) * (1 - t);

  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = at(x1, x2, t) - x;
      if (Math.abs(error) < 1e-5) break;
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }
    return at(y1, y2, t);
  };
}

/** Entering: fast out of the gate, long settle. */
const enterEase = cubicBezier(0.16, 1, 0.3, 1);
/** Leaving: accelerates away, so the exit reads as decisive rather than sad. */
const exitEase = cubicBezier(0.55, 0, 0.85, 0.3);
/** The rule under the type, which is the part that actually says "loading". */
const ruleEase = cubicBezier(0.4, 0, 0.15, 1);

/** Normalised progress of one staggered item within a window. */
function phase(t: number, from: number, span: number, stagger: number, index: number): number {
  const start = from + index * stagger;
  return Math.min(1, Math.max(0, (t - start) / span));
}

export interface LoaderOptions {
  /** Play on mount. Off for the filmstrip harness, which seeks instead. */
  autoplay?: boolean;
  /** Loop until `stop()`. A loader usually should. */
  loop?: boolean;
  onComplete?: () => void;
}

export interface LoaderHandle {
  /** Render one frame at normalised time. Pure — no playback state touched. */
  seek(t: number): void;
  play(): void;
  stop(): void;
  dispose(): void;
  readonly duration: number;
}

const NS = "http://www.w3.org/2000/svg";

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Builds one run's glyph groups, centred on the viewBox. */
function buildRun(run: Run, width: number): { group: SVGGElement; glyphs: SVGGElement[] } {
  const group = el("g", { transform: `translate(${(width - run.width) / 2} 0)` });
  const glyphs = run.glyphs.map((glyph) => {
    const wrapper = el("g");
    wrapper.append(el("path", { d: glyph.d }));
    group.append(wrapper);
    return wrapper;
  });
  return { group, glyphs };
}

export function mountLoader(root: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const { autoplay = true, loop = true, onComplete } = options;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const width = Math.max(HANGUL.width, LATIN.width) + 40;
  const height = VIEW.height + 26;

  const svg = el("svg", {
    viewBox: `0 ${VIEW.top} ${width} ${height}`,
    width: "100%",
    height: "100%",
    fill: "currentColor",
    // The animation carries no information the surrounding copy does not, and
    // the name is in the DOM beside it. Nothing here is announced.
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.style.cssText = "display:block;overflow:visible";

  // Both runs share one clip band, so a glyph part-way through its travel is
  // cut off cleanly at the top and bottom of the type area rather than sliding
  // over whatever sits above it.
  const clipId = `loader-clip-${Math.random().toString(36).slice(2, 9)}`;
  const clip = el("clipPath", { id: clipId });
  clip.append(el("rect", { x: -20, y: VIEW.top - 4, width: width + 40, height: VIEW.height + 4 }));
  svg.append(clip);

  const clipped = el("g", { "clip-path": `url(#${clipId})` });
  const hangul = buildRun(HANGUL, width);
  const latin = buildRun(LATIN, width);
  clipped.append(hangul.group, latin.group);
  svg.append(clipped);

  // The rule. A loader needs one honest indicator of progress, and this is it —
  // everything above it is the name resolving, which is decoration.
  const ruleY = VIEW.top + VIEW.height + 14;
  const ruleWidth = Math.min(HANGUL.width, LATIN.width);
  const ruleX = (width - ruleWidth) / 2;
  svg.append(
    el("rect", {
      x: ruleX,
      y: ruleY,
      width: ruleWidth,
      height: 1.5,
      opacity: 0.16,
    }),
  );
  const rule = el("rect", { x: ruleX, y: ruleY, width: ruleWidth, height: 1.5 });
  svg.append(rule);

  root.append(svg);

  /**
   * Renders the frame at normalised time `t`.
   *
   * Every visual property is derived here and nowhere else, so seeking and
   * playing cannot disagree about what a given moment looks like.
   */
  function apply(t: number) {
    hangul.glyphs.forEach((glyph, index) => {
      const entered = enterEase(phase(t, T.enterFrom, T.enterSpan, T.enterStagger, index));
      const left = exitEase(phase(t, T.exitFrom, T.exitSpan, T.exitStagger, index));

      // One expression for both halves of the glyph's life: it rises into
      // place, then keeps going the same way and leaves. Reversing direction
      // on exit would read as a mistake being undone.
      const y = RISE * (1 - entered) - RISE * left;
      const x = DRIFT.out * left;
      glyph.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      glyph.setAttribute("opacity", (entered * (1 - left)).toFixed(3));
    });

    latin.glyphs.forEach((glyph, index) => {
      const arrived = enterEase(phase(t, T.arriveFrom, T.arriveSpan, T.arriveStagger, index));
      const y = RISE * (1 - arrived);
      const x = DRIFT.in * (1 - arrived);
      glyph.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      glyph.setAttribute("opacity", arrived.toFixed(3));
    });

    rule.setAttribute("width", (ruleWidth * ruleEase(t)).toFixed(2));
  }

  let frameId = 0;
  let startedAt = 0;
  let running = false;

  function tick(now: number) {
    const elapsed = now - startedAt;
    const t = elapsed / DURATION;

    if (t >= 1) {
      apply(1);
      if (loop) {
        startedAt = now;
        frameId = requestAnimationFrame(tick);
      } else {
        running = false;
        onComplete?.();
      }
      return;
    }

    apply(t);
    frameId = requestAnimationFrame(tick);
  }

  function play() {
    if (running || reducedMotion) return;
    running = true;
    startedAt = performance.now();
    frameId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(frameId);
    frameId = 0;
  }

  if (reducedMotion) {
    // The resolved state, drawn once. No loop is ever started.
    apply(1);
  } else {
    apply(0);
    if (autoplay) play();
  }

  return {
    seek(t) {
      stop();
      apply(Math.min(1, Math.max(0, t)));
    },
    play,
    stop,
    dispose() {
      stop();
      svg.remove();
    },
    duration: DURATION,
  };
}
