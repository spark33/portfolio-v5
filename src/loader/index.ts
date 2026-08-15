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

/**
 * Total duration in milliseconds.
 *
 * The first cut ran at 1150ms and read as a flicker — the eye registered that
 * something had changed without ever reading either name. A preloader has to
 * be legible twice over, which needs a real hold on each state; the rest of
 * the budget goes to the handoff.
 */
export const DURATION = 2600;

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
  enterFrom: 0.03,
  enterSpan: 0.2,
  enterStagger: 0.05,

  exitFrom: 0.44,
  exitSpan: 0.12,
  exitStagger: 0.02,

  arriveFrom: 0.52,
  arriveSpan: 0.26,
  arriveStagger: 0.022,
} as const;

/**
 * The wipe that reveals each run.
 *
 * A mask edge travelling across the type, rather than opacity alone. It is the
 * technique that separates a preloader that looks directed from one that looks
 * defaulted: the letters are already there and something uncovers them, which
 * is a different event from them fading up out of nothing.
 */
const WIPE = { enterSpan: 0.28, exitSpan: 0.15 };

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
/**
 * The counter.
 *
 * Not linear — a real load never is — but it has to *finish*. An earlier curve
 * reached 100 at 0.91 and then sat there for the last quarter of the run,
 * which reads as the animation having stalled with the number stuck. This one
 * moves steadily, hesitates in the last fifth the way a real one does, and
 * lands on 100 at the end rather than before it.
 */
const ruleEase = cubicBezier(0.22, 0.55, 0.3, 1);
/** The wipe edge. Slower out of the gate than the glyphs, so it leads them. */
const wipeEase = cubicBezier(0.33, 0.9, 0.2, 1);

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

  // Each run also gets its own wipe rect, nested inside the shared band. The
  // band stops a travelling glyph spilling above or below the type area; the
  // wipe is what uncovers the run left to right.
  const uid = clipId.slice(-6);
  const wipes: Record<"hangul" | "latin", SVGRectElement> = {
    hangul: el("rect", { y: VIEW.top - 8, height: VIEW.height + 16 }),
    latin: el("rect", { y: VIEW.top - 8, height: VIEW.height + 16 }),
  };

  const clipped = el("g", { "clip-path": `url(#${clipId})` });
  const hangul = buildRun(HANGUL, width);
  const latin = buildRun(LATIN, width);

  for (const [key, run] of [
    ["hangul", hangul],
    ["latin", latin],
  ] as const) {
    const wipeClip = el("clipPath", { id: `${key}-wipe-${uid}` });
    wipeClip.append(wipes[key]);
    svg.append(wipeClip);
    const wrapper = el("g", { "clip-path": `url(#${key}-wipe-${uid})` });
    wrapper.append(run.group);
    clipped.append(wrapper);
  }

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

  // --- The meter -----------------------------------------------------------
  // A counter and a rule, in real DOM rather than in the SVG: it is the one
  // part of this that carries information, so it is real text in the site's
  // mono, selectable and readable, and it inherits the page's colour.
  const meter = document.createElement("div");
  meter.style.cssText =
    "display:flex;align-items:center;gap:.9rem;margin-top:1.4rem;" +
    'font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.7rem;' +
    "letter-spacing:.14em;font-variant-numeric:tabular-nums";

  const track = document.createElement("div");
  track.style.cssText = "flex:1;height:1px;background:currentColor;opacity:.18";
  const fill = document.createElement("div");
  fill.style.cssText = "height:1px;background:currentColor;transform-origin:left";
  track.append(fill);

  const percent = document.createElement("span");
  percent.style.cssText = "opacity:.62;min-width:3ch;text-align:right";

  meter.append(track, percent);

  const wrap = document.createElement("div");
  wrap.style.cssText = "width:100%";
  wrap.append(svg, meter);
  root.append(wrap);

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

    // The wipes lead the glyphs: the edge has already passed by the time a
    // letter finishes rising, so the reveal reads as uncovering rather than as
    // two effects running at once.
    const enterWipe = wipeEase(phase(t, T.enterFrom, WIPE.enterSpan, 0, 0));
    const exitWipe = wipeEase(phase(t, T.exitFrom, WIPE.exitSpan, 0, 0));
    const arriveWipe = wipeEase(phase(t, T.arriveFrom, WIPE.enterSpan, 0, 0));

    // The Hangul is uncovered from the left, then covered again from the left,
    // so the wipe carries straight on in one direction across the whole run.
    const hangulLeft = ruleX - 12 + (ruleWidth + 24) * exitWipe;
    wipes.hangul.setAttribute("x", hangulLeft.toFixed(2));
    wipes.hangul.setAttribute(
      "width",
      Math.max(0, ruleX - 12 + (ruleWidth + 24) * enterWipe - hangulLeft).toFixed(2),
    );

    wipes.latin.setAttribute("x", (-20).toFixed(2));
    wipes.latin.setAttribute("width", ((width + 40) * arriveWipe).toFixed(2));

    const progress = ruleEase(t);
    rule.setAttribute("width", (ruleWidth * progress).toFixed(2));
    fill.style.width = `${(progress * 100).toFixed(2)}%`;
    percent.textContent = String(Math.round(progress * 100)).padStart(3, "0");
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
      wrap.remove();
    },
    duration: DURATION,
  };
}
