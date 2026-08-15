import "./loader.css";

/**
 * The loading animation: 박상현 gains weight as the page loads, then hands off
 * to SEAN PARK.
 *
 * Real text in a subset of Pretendard Variable — eleven glyphs, under 3 KB —
 * animated along its weight axis. The axis is the idea rather than an effect:
 * the name arrives hairline and thickens as loading progresses, so the counter
 * and the letterforms are two readings of one signal, and the type reaches its
 * heaviest exactly as the load finishes.
 *
 * The whole animation is a pure function of normalised time, `apply(t)`.
 * Nothing is stateful and any frame can be rendered on demand, which is what
 * makes it possible to screenshot a filmstrip and iterate on the motion
 * instead of guessing at it.
 */

/**
 * Total duration in milliseconds.
 *
 * An earlier cut ran at 1150ms and read as a flicker — the eye registered that
 * something had changed without ever reading either name. A preloader has to
 * be legible twice over, which needs a real hold on each state.
 */
export const DURATION = 2600;

const KOREAN = [..."박상현"];
const LATIN = [..."SEAN PARK"];

/** How far a glyph travels as it enters or leaves, as a fraction of its size. */
const RISE = 0.42;

/**
 * Sideways drift on the swap, in em.
 *
 * The old name leaves slightly to the left and the new one comes in from the
 * right, so the exchange has a direction rather than both names occupying one
 * space.
 */
const DRIFT = { out: -0.1, in: 0.12 };

/**
 * The weight axis, per run.
 *
 * Two ranges rather than one sweep across the whole axis. A single ramp puts
 * the Hangul near 500 by the time it hands off, which is nowhere — too heavy
 * to read as delicate, too light to read as deliberate. Holding it in the thin
 * end and giving the Latin the heavy end keeps each name at a weight that
 * means something, while both still gain weight as the load progresses.
 */
const WEIGHT = {
  korean: { from: 45, to: 250 },
  latin: { from: 280, to: 930 },
};

/** Beats, in normalised time. */
const T = {
  enterFrom: 0.03,
  enterSpan: 0.2,
  enterStagger: 0.05,

  exitFrom: 0.44,
  exitSpan: 0.1,
  exitStagger: 0.018,

  // Nine glyphs at the old stagger spread the arrival over a third of the run,
  // which left a lone S sitting in an empty frame while the rest queued up. A
  // word should arrive as a word.
  arriveFrom: 0.5,
  arriveSpan: 0.26,
  arriveStagger: 0.013,
} as const;

/**
 * The wipe that reveals each run.
 *
 * A mask edge travelling across the type rather than opacity alone. It is what
 * separates a preloader that looks directed from one that looks defaulted: the
 * letters are already there and something uncovers them, which is a different
 * event from them fading up out of nothing.
 */
const WIPE = { enterSpan: 0.28, exitSpan: 0.15 };

/** CSS-style cubic bézier, solved for y given x. */
function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number) => {
    const u = 1 - t;
    return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
  };

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
 * The counter, and with it the weight.
 *
 * Not linear — a real load never is — but it has to finish. An earlier curve
 * reached 100 at 0.91 and sat there for the last quarter, which reads as a
 * stall with the number stuck.
 */
const progressEase = cubicBezier(0.22, 0.55, 0.3, 1);
/** The wipe edge. Leads the glyphs, so it uncovers rather than accompanies. */
const wipeEase = cubicBezier(0.33, 0.9, 0.2, 1);

/** Normalised progress of one staggered item within a window. */
function phase(t: number, from: number, span: number, stagger: number, index: number): number {
  const start = from + index * stagger;
  return Math.min(1, Math.max(0, (t - start) / span));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
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

/** Builds one run as real text, one span per glyph so it can be staggered. */
function buildRun(text: string[], modifier: string) {
  const run = document.createElement("div");
  run.className = `loader__run loader__run--${modifier}`;
  // The names duplicate copy that is already on the page, so they are not
  // announced. The meter below carries the state a reader actually needs.
  run.setAttribute("aria-hidden", "true");

  const glyphs = text.map((char) => {
    const span = document.createElement("span");
    span.className = "loader__glyph";
    // A space would collapse without this; the run is set with `white-space:
    // pre` and each glyph is its own inline-block.
    span.textContent = char;
    run.append(span);
    return span;
  });

  return { run, glyphs };
}

export function mountLoader(root: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const { autoplay = true, loop = true, onComplete } = options;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wrap = document.createElement("div");
  wrap.className = "loader";

  const stage = document.createElement("div");
  stage.className = "loader__stage";

  const korean = buildRun(KOREAN, "ko");
  const latin = buildRun(LATIN, "en");
  stage.append(korean.run, latin.run);

  // The meter is the part that carries information, so it is the part with a
  // role. A progressbar is what a loader actually is.
  const meter = document.createElement("div");
  meter.className = "loader__meter";
  meter.setAttribute("role", "progressbar");
  meter.setAttribute("aria-valuemin", "0");
  meter.setAttribute("aria-valuemax", "100");
  meter.setAttribute("aria-label", "Loading");

  const track = document.createElement("div");
  track.className = "loader__track";
  const fill = document.createElement("div");
  fill.className = "loader__fill";
  track.append(fill);

  const percent = document.createElement("span");
  percent.className = "loader__percent";

  meter.append(track, percent);
  wrap.append(stage, meter);
  root.append(wrap);

  /**
   * Renders the frame at normalised time.
   *
   * Every visual property is derived here and nowhere else, so seeking and
   * playing cannot disagree about what a given moment looks like.
   */
  function apply(t: number) {
    korean.glyphs.forEach((glyph, index) => {
      const entered = enterEase(phase(t, T.enterFrom, T.enterSpan, T.enterStagger, index));
      const left = exitEase(phase(t, T.exitFrom, T.exitSpan, T.exitStagger, index));

      // One expression for both halves of a glyph's life: it rises into place,
      // then keeps going the same way and leaves. Reversing direction on exit
      // would read as a mistake being undone.
      const y = RISE * (1 - entered) - RISE * left;
      const x = DRIFT.out * left;
      glyph.style.transform = `translate(${x.toFixed(3)}em, ${y.toFixed(3)}em)`;
      glyph.style.opacity = (entered * (1 - left)).toFixed(3);
    });

    latin.glyphs.forEach((glyph, index) => {
      const arrived = enterEase(phase(t, T.arriveFrom, T.arriveSpan, T.arriveStagger, index));
      const y = RISE * (1 - arrived);
      const x = DRIFT.in * (1 - arrived);
      glyph.style.transform = `translate(${x.toFixed(3)}em, ${y.toFixed(3)}em)`;
      glyph.style.opacity = arrived.toFixed(3);
    });

    const progress = progressEase(t);

    // Weight is set on the run rather than per glyph. Changing
    // font-variation-settings reflows the text it applies to, so two writes a
    // frame is the difference between this and twelve.
    const weight = (range: { from: number; to: number }) =>
      `"wght" ${lerp(range.from, range.to, progress).toFixed(1)}`;
    korean.run.style.fontVariationSettings = weight(WEIGHT.korean);
    latin.run.style.fontVariationSettings = weight(WEIGHT.latin);

    // Wipes lead the glyphs, so the reveal reads as uncovering rather than as
    // two effects running at once. The Hangul is uncovered from the left and
    // then covered again from the left, so the edge carries straight on in one
    // direction across the whole run.
    const enterWipe = wipeEase(phase(t, T.enterFrom, WIPE.enterSpan, 0, 0));
    const exitWipe = wipeEase(phase(t, T.exitFrom, WIPE.exitSpan, 0, 0));
    const arriveWipe = wipeEase(phase(t, T.arriveFrom, WIPE.enterSpan, 0, 0));

    const inset = (right: number, left: number) =>
      `inset(-25% ${(right * 100).toFixed(2)}% -25% ${(left * 100).toFixed(2)}%)`;
    korean.run.style.clipPath = inset(1 - enterWipe, exitWipe);
    latin.run.style.clipPath = inset(1 - arriveWipe, 0);

    const shown = Math.round(progress * 100);
    fill.style.width = `${(progress * 100).toFixed(2)}%`;
    percent.textContent = String(shown).padStart(3, "0");
    meter.setAttribute("aria-valuenow", String(shown));
  }

  let frameId = 0;
  let startedAt = 0;
  let running = false;

  function tick(now: number) {
    const t = (now - startedAt) / DURATION;

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
