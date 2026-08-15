import "./loader.css";
import {
  BLOCK,
  blockX,
  buildParts,
  fitSyllable,
  LOCK_ORDER,
  SYLLABLES,
  TOTAL_WIDTH,
} from "./layout.ts";

/**
 * The loading animation.
 *
 *   ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ   nine parts, arriving
 *   박 상 현              three blocks, assembled
 *   SEAN PARK            the name he goes by
 *
 * The mechanic is the meaning. Hangul is an assembly system — a syllable is a
 * square built from jamo placed in fixed regions of it — and loading is
 * assembly, so the animation builds the name the way the writing system builds
 * it. The parts fly in along the axis their role occupies, the bottom tier of
 * each block locking before the tier above it, and only once a block is
 * complete does it resolve into the syllable itself.
 *
 * That is also why this cannot be a stock preloader wearing someone's name:
 * the animation is specific to *this* name, in *this* script, and would have
 * to be rebuilt from scratch for any other.
 *
 * Real text throughout, in a 3.6 KB subset of Pretendard Variable, animated
 * along its weight axis: the parts arrive hairline and gain weight as they
 * lock, so the letterforms and the counter are two readings of one signal.
 *
 * The whole animation is a pure function of normalised time, `apply(t)`. Any
 * frame can be rendered on demand, which is what makes it possible to
 * screenshot a filmstrip and iterate on the motion instead of guessing at it.
 */

/** Total duration in milliseconds. */
export const DURATION = 3200;

const LATIN = [..."SEAN PARK"];

/** Beats, in normalised time. */
const T = {
  /** Parts fly in and lock into their cells. */
  assembleFrom: 0.02,
  assembleSpan: 0.26,
  assembleStagger: 0.028,

  /**
   * Parts give way to the composed syllable.
   *
   * Short on purpose. A standalone jamo is not drawn the same as the same jamo
   * inside a block — the font redraws it to fit — so however well the two are
   * fitted to one box, a slow crossfade shows both forms at once. Making it a
   * snap turns that from a ghost into the moment the block locks.
   */
  composeFrom: 0.4,
  composeSpan: 0.04,
  composeStagger: 0.05,

  /** The composed name gives way to the Latin one. */
  exitFrom: 0.64,
  exitSpan: 0.09,
  exitStagger: 0.018,

  // Starts only once the last block has cleared, so no Latin letter is ever
  // drawn underneath a syllable that is still on screen.
  arriveFrom: 0.75,
  arriveSpan: 0.24,
  arriveStagger: 0.013,
} as const;

/** The weight axis, per layer. */
const WEIGHT = {
  parts: { from: 45, to: 200 },
  composed: { from: 200, to: 340 },
  latin: { from: 300, to: 930 },
};

/** How far the Latin drifts in, in em. */
const DRIFT_IN = 0.12;

/** Word space between SEAN and PARK, in block units. */
const WORD_SPACE = 0.2;

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

/** A part travelling to its cell: covers ground fast, then seats. */
const lockEase = cubicBezier(0.16, 1, 0.3, 1);
/** Leaving: accelerates away, so an exit reads as decisive rather than sad. */
const exitEase = cubicBezier(0.55, 0, 0.85, 0.3);
/** The counter, and with it the weight. Has to actually finish. */
const progressEase = cubicBezier(0.22, 0.55, 0.3, 1);

function phase(t: number, from: number, span: number, stagger: number, index: number): number {
  const start = from + index * stagger;
  return Math.min(1, Math.max(0, (t - start) / span));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export interface LoaderOptions {
  autoplay?: boolean;
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

function svgEl<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Vertical padding around the blocks, in block units. */
const PAD = 0.34;

export function mountLoader(root: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const { autoplay = true, loop = true, onComplete } = options;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wrap = document.createElement("div");
  wrap.className = "loader";

  const svg = svgEl("svg", {
    viewBox: `${-PAD} ${-PAD} ${TOTAL_WIDTH + PAD * 2} ${BLOCK.size + PAD * 2}`,
    width: "100%",
    fill: "currentColor",
    // The names duplicate copy that is already on the page. The meter below
    // carries the state a reader actually needs.
    "aria-hidden": "true",
    focusable: "false",
  });
  svg.setAttribute("font-family", "Pretendard Loader, system-ui, sans-serif");

  // --- The construction squares -------------------------------------------
  // One per block, drawn as the parts arrive and gone once the block resolves.
  // They make the system visible: this is a square being filled, not letters
  // drifting into place.
  const frames = SYLLABLES.map((_, index) =>
    svgEl("rect", {
      x: blockX(index),
      y: 0,
      width: BLOCK.size,
      height: BLOCK.size,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 0.006,
      "vector-effect": "non-scaling-stroke",
    }),
  );
  const frameGroup = svgEl("g");
  frameGroup.append(...frames);
  svg.append(frameGroup);

  // --- The nine parts ------------------------------------------------------
  const parts = buildParts();
  const partGroup = svgEl("g");
  const partNodes = parts.map((part) => {
    // An outer group carries the approach; the inner text carries the fit, so
    // the two never have to be composed by hand.
    const outer = svgEl("g");
    const text = svgEl("text", { x: 0, y: 0, "font-size": 1, transform: part.transform });
    text.textContent = part.char;
    // Each block is offset here rather than in the fit, so the fit stays in
    // block-local units and is readable next to the cell table.
    const positioned = svgEl("g", { transform: `translate(${blockX(part.syllable)} 0)` });
    positioned.append(text);
    outer.append(positioned);
    partGroup.append(outer);
    return outer;
  });
  svg.append(partGroup);

  // --- The three composed syllables ---------------------------------------
  const composedGroup = svgEl("g");
  const composedNodes = SYLLABLES.map((char, index) => {
    // Fitted to the box the parts filled, not set at a nominal size, so the
    // handover is the same shape tightening rather than a second image
    // ghosting over the first.
    const text = svgEl("text", { x: 0, y: 0, "font-size": 1, transform: fitSyllable(char) });
    text.textContent = char;

    const positioned = svgEl("g", { transform: `translate(${blockX(index)} 0)` });
    positioned.append(text);

    const outer = svgEl("g");
    outer.append(positioned);
    composedGroup.append(outer);
    return outer;
  });
  svg.append(composedGroup);

  // --- SEAN PARK -----------------------------------------------------------
  const latinGroup = svgEl("g");
  const latinNodes = LATIN.map((char) => {
    const text = svgEl("text", {
      y: BLOCK.size * 0.78,
      "font-size": BLOCK.size * 0.62,
      "text-anchor": "middle",
    });
    text.textContent = char;
    latinGroup.append(text);
    return text;
  });
  svg.append(latinGroup);

  // --- The meter -----------------------------------------------------------
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
  wrap.append(svg, meter);
  root.append(wrap);

  /**
   * Lays SEAN PARK out across the full width.
   *
   * Measured rather than assumed: SVG text has no layout engine to ask, and
   * the advance widths depend on the weight, which moves. Measuring once at
   * the weight the word settles at is close enough, and it is the only DOM
   * read in the whole animation.
   */
  let latinPlaced = false;
  function placeLatin() {
    if (latinPlaced || !svg.isConnected) return;

    latinGroup.style.fontVariationSettings = `"wght" ${WEIGHT.latin.to}`;

    // A <text> holding only a space measures zero — SVG has no line box to
    // hang whitespace on — so the word space is set explicitly. Without this
    // the two words run together as SEANPARK.
    const widths = latinNodes.map((node, index) =>
      LATIN[index] === " " ? WORD_SPACE : node.getComputedTextLength(),
    );
    const ink = widths.reduce((sum, width, index) => (LATIN[index] === " " ? sum : sum + width), 0);
    if (ink === 0) return; // Font has not landed yet; try again next frame.

    const total = widths.reduce((sum, width) => sum + width, 0);

    let pen = (TOTAL_WIDTH - total) / 2;
    latinNodes.forEach((node, index) => {
      node.setAttribute("x", (pen + widths[index] / 2).toFixed(4));
      pen += widths[index];
    });

    latinPlaced = true;
  }

  /** Renders the frame at normalised time. */
  function apply(t: number) {
    placeLatin();

    const progress = progressEase(t);

    // --- Parts -------------------------------------------------------------
    LOCK_ORDER.forEach((partIndex, order) => {
      const node = partNodes[partIndex];
      const part = parts[partIndex];

      const locked = lockEase(phase(t, T.assembleFrom, T.assembleSpan, T.assembleStagger, order));
      const gone = phase(t, T.composeFrom, T.composeSpan, T.composeStagger, part.syllable);

      const away = 1 - locked;
      node.setAttribute(
        "transform",
        `translate(${(part.approach.x * away).toFixed(4)} ${(part.approach.y * away).toFixed(4)})`,
      );
      node.setAttribute("opacity", (locked * (1 - gone)).toFixed(3));
    });

    partGroup.style.fontVariationSettings = `"wght" ${lerp(
      WEIGHT.parts.from,
      WEIGHT.parts.to,
      progress,
    ).toFixed(1)}`;

    // --- Frames ------------------------------------------------------------
    // Present while there is something to assemble, gone once each block has.
    frames.forEach((frame, index) => {
      const drawn = lockEase(phase(t, T.assembleFrom, 0.16, 0.05, index));
      const gone = phase(t, T.composeFrom, T.composeSpan, T.composeStagger, index);
      frame.setAttribute("opacity", (drawn * (1 - gone) * 0.22).toFixed(3));
    });

    // --- Composed syllables -------------------------------------------------
    composedNodes.forEach((node, index) => {
      // Takes over exactly as its parts give way. Both are the same size in
      // the same place, so the handover is a tightening rather than a cut.
      const shown = phase(t, T.composeFrom, T.composeSpan, T.composeStagger, index);
      const left = exitEase(phase(t, T.exitFrom, T.exitSpan, T.exitStagger, index));
      node.setAttribute("opacity", (shown * (1 - left)).toFixed(3));

      // A settle on the way in: the block overshoots very slightly and comes
      // back, which is what a part seating into place does and what covers the
      // last of the swap.
      const settle = 1 + 0.035 * Math.exp(-7 * shown) * Math.sin(Math.PI * 2.4 * shown);
      const centre = blockX(index) + BLOCK.size / 2;
      node.setAttribute(
        "transform",
        `translate(${(-0.12 * left).toFixed(4)} ${(-0.2 * left).toFixed(4)}) ` +
          `translate(${centre.toFixed(4)} ${(BLOCK.size / 2).toFixed(4)}) ` +
          `scale(${settle.toFixed(4)}) ` +
          `translate(${(-centre).toFixed(4)} ${(-BLOCK.size / 2).toFixed(4)})`,
      );
    });

    composedGroup.style.fontVariationSettings = `"wght" ${lerp(
      WEIGHT.composed.from,
      WEIGHT.composed.to,
      progress,
    ).toFixed(1)}`;

    // --- SEAN PARK ----------------------------------------------------------
    latinNodes.forEach((node, index) => {
      const arrived = lockEase(phase(t, T.arriveFrom, T.arriveSpan, T.arriveStagger, index));
      node.setAttribute("opacity", arrived.toFixed(3));
      node.setAttribute(
        "transform",
        `translate(${(DRIFT_IN * (1 - arrived)).toFixed(4)} ${(0.26 * (1 - arrived)).toFixed(4)})`,
      );
    });

    if (latinPlaced) {
      latinGroup.style.fontVariationSettings = `"wght" ${lerp(
        WEIGHT.latin.from,
        WEIGHT.latin.to,
        progress,
      ).toFixed(1)}`;
    }

    // --- Meter --------------------------------------------------------------
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
