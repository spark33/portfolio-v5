import "./loader.css";
import { MORPH_POINTS, MORPHS } from "./morphs.ts";
import {
  BLOCK,
  blockX,
  buildParts,
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
   * Parts fuse into their syllable.
   *
   * A real morph, so it can take its time: earlier cuts had to snap here to
   * hide a crossfade between two different drawings of the same block. There
   * is nothing to hide now.
   */
  fuseFrom: 0.36,
  fuseSpan: 0.2,
  fuseStagger: 0.06,

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
/**
 * The fuse.
 *
 * Symmetric and unhurried. This is the one moment the piece exists for — nine
 * parts becoming three blocks — and rushing it wastes the only thing that
 * makes the animation this name's and not anyone else's.
 */
const fuseEase = cubicBezier(0.65, 0, 0.35, 1);
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

/** Interpolates a morph pair and renders it as path data. */
function blend(
  morph: { from: number[]; to: number[]; contours: number },
  t: number,
  render: (points: number[], contours: number) => string,
): string {
  const points = new Array<number>(morph.from.length);
  for (let i = 0; i < points.length; i++) {
    points[i] = morph.from[i] + (morph.to[i] - morph.from[i]) * t;
  }
  return render(points, morph.contours);
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

/** Line weight of the drawn outlines, in block units. */
const STROKE = 0.011;

/** Where in a part's arrival the outline finishes drawing and the fill takes
 *  over. The two overlap, so the form is never a bare outline for long. */
const DRAW = { span: 0.62, fillFrom: 0.45 };

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

  // --- The nine parts, which become the three syllables --------------------
  const parts = buildParts();

  /** Builds path data from a flat run of x, y pairs. */
  function toPath(points: number[], contours: number): string {
    let d = "";
    for (let c = 0; c < contours; c++) {
      const base = c * MORPH_POINTS * 2;
      d += `M${points[base].toFixed(3)} ${points[base + 1].toFixed(3)}`;
      for (let i = 1; i < MORPH_POINTS; i++) {
        d += `L${points[base + i * 2].toFixed(3)} ${points[base + i * 2 + 1].toFixed(3)}`;
      }
      d += "Z";
    }
    return d;
  }

  const partGroup = svgEl("g");
  const partNodes = parts.map((part) => {
    const morph = MORPHS.find(
      (entry) => entry.char === part.char && entry.syllable === SYLLABLES[part.syllable],
    );
    if (!morph) throw new Error(`no morph for ${part.char} — run npm run build:loader`);

    const from = toPath(morph.from, morph.contours);
    const to = toPath(morph.to, morph.contours);

    const outer = svgEl("g");
    const path = svgEl("path", {
      d: from,
      fill: "currentColor",
      stroke: "currentColor",
      // Butt, not round. A round cap on a zero-length dash renders as a dot,
      // so at rest — dash offset at full length, nothing meant to be drawn —
      // every contour start left a speck on screen.
      "stroke-linecap": "butt",
      "stroke-linejoin": "round",
      "stroke-width": STROKE,
    });

    // The morph points are already in block units, so the only transform left
    // is which block this part belongs to.
    const positioned = svgEl("g", { transform: `translate(${blockX(part.syllable)} 0)` });
    positioned.append(path);
    outer.append(positioned);
    partGroup.append(outer);

    // Total outline length, for the draw-on. Read once, from the state the
    // part is drawn in. A jamo with several contours returns their sum, so
    // they draw one after another — roughly the order they would be written.
    const length = path.getTotalLength();
    path.setAttribute("stroke-dasharray", String(length));

    return { outer, path, length, morph, from, to, current: from };
  });
  svg.append(partGroup);

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

      // The part travels to its cell...
      const away = 1 - locked;
      const leaving = exitEase(phase(t, T.exitFrom, T.exitSpan, T.exitStagger, part.syllable));

      node.outer.setAttribute(
        "transform",
        `translate(${(part.approach.x * away - 0.12 * leaving).toFixed(4)} ` +
          `${(part.approach.y * away - 0.22 * leaving).toFixed(4)})`,
      );
      node.outer.setAttribute("opacity", (1 - leaving).toFixed(3));

      // ...its outline draws itself on, and the fill catches up behind it.
      // This is the one thing here that could not be done any other way — a
      // stroke running along the letterform is what makes it read as drawn
      // rather than as a glyph being faded up.
      const drawn = Math.min(1, locked / DRAW.span);
      node.path.setAttribute("stroke-dashoffset", (node.length * (1 - drawn)).toFixed(3));

      const filled = Math.max(0, (locked - DRAW.fillFrom) / (1 - DRAW.fillFrom));
      node.path.setAttribute("fill-opacity", filled.toFixed(3));
      // The line fades as the fill arrives, so a part ends as a solid form
      // rather than a solid form wearing an outline. Gated on the draw having
      // begun, so nothing is painted before the part exists.
      node.path.setAttribute("stroke-opacity", (drawn > 0 ? 1 - filled : 0).toFixed(3));

      // ...and then it *becomes* its share of the syllable.
      //
      // Not a crossfade to a second drawing of the block — the same contours,
      // moved. The font redraws a jamo for its position but keeps its contour
      // structure, so every contour of 박 has exactly one counterpart among
      // ㅂㅏㄱ, and the whole assembly resolves with nothing appearing or
      // disappearing. It is also the only way the seam can be invisible: there
      // is no seam.
      const fused = fuseEase(phase(t, T.fuseFrom, T.fuseSpan, T.fuseStagger, part.syllable));
      const wanted =
        fused <= 0 ? node.from : fused >= 1 ? node.to : blend(node.morph, fused, toPath);

      if (wanted !== node.current) {
        node.path.setAttribute("d", wanted);
        node.current = wanted;
      }
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
      const gone = phase(t, T.fuseFrom, T.fuseSpan * 0.5, T.fuseStagger, index);
      frame.setAttribute("opacity", (drawn * (1 - gone) * 0.22).toFixed(3));
    });

    // --- Composed syllables -------------------------------------------------
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
