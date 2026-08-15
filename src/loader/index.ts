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
export const DURATION = 3800;

/** Beats, in normalised time. */
const T = {
  /** Parts fly in and lock into their cells. */
  assembleFrom: 0.02,
  assembleSpan: 0.26,
  assembleStagger: 0.028,

  /** Parts fuse into their syllable. */
  fuseFrom: 0.3,
  fuseSpan: 0.18,
  fuseStagger: 0.05,

  /**
   * The name flows into the one he goes by.
   *
   * The longest beat, and unhurried on purpose: the middle of this morph is
   * the only place the piece is neither Korean nor Latin, and that in-between
   * is the most interesting thing in it. Rushing past it to reach a legible
   * frame throws away the reason for doing the morph at all.
   */
  flowFrom: 0.58,
  flowSpan: 0.3,
  /** Unstaggered: by this point there are no parts left, only the name. */
  flowStagger: 0,
} as const;

/**
 * Every staggered beat has to close before the run ends.
 *
 * The flow used to start at 0.58 and stagger nine parts by 0.022 over a span
 * of 0.3, which puts the last of them finishing at 1.076 — so the final frame
 * caught them mid-morph and the name rendered as a scramble. Checked here
 * rather than left as arithmetic in a comment, because it is the kind of thing
 * that breaks silently every time a beat is retimed.
 */
const LAST = Math.max(
  T.assembleFrom + 8 * T.assembleStagger + T.assembleSpan,
  T.fuseFrom + 2 * T.fuseStagger + T.fuseSpan,
  T.flowFrom + T.flowSpan,
);
if (LAST > 1) {
  throw new Error(`loader beats run to ${LAST.toFixed(3)}, past the end of the sequence`);
}

/** The weight axis, per layer. */
const WEIGHT = {
  parts: { from: 45, to: 200 },
  composed: { from: 200, to: 340 },
  latin: { from: 300, to: 930 },
};

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
/**
 * The flow into Latin.
 *
 * Gentler at both ends than the fuse, and slower through the middle, so the
 * abstract stretch — where the forms are neither script — is the part that
 * gets the time.
 */
const flowEase = cubicBezier(0.5, 0.02, 0.5, 0.98);
/** Camera moves. Eased at both ends; a camera that snaps reads as a cut. */
const shotEase = cubicBezier(0.4, 0, 0.2, 1);

/** The counter, and with it the weight. Has to actually finish. */
const progressEase = cubicBezier(0.22, 0.55, 0.3, 1);

function phase(t: number, from: number, span: number, stagger: number, index: number): number {
  const start = from + index * stagger;
  return Math.min(1, Math.max(0, (t - start) / span));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Interpolates between two point runs and renders the result as path data. */
function blend(
  from: number[],
  to: number[],
  t: number,
  contours: number,
  render: (points: number[], contours: number) => string,
): string {
  const points = new Array<number>(from.length);
  for (let i = 0; i < points.length; i++) {
    points[i] = from[i] + (to[i] - from[i]) * t;
  }
  return render(points, contours);
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

/**
 * The camera.
 *
 * A viewBox that moves, which is the difference between type appearing on a
 * screen and a space you are moved through. It opens inside a single stroke —
 * so the first thing on screen is an abstract mark, not a name — pulls back as
 * the parts arrive, and then pushes in through the morph.
 *
 * That push is doing real work. Twenty contours becoming twelve means eight of
 * them shrink to nothing, and the field loses mass through the middle: on a
 * fixed camera the name visibly collapses and comes back, which reads as a
 * fault. Moving in as it contracts keeps it filling the frame, and the same
 * moment reads as a dive into the transformation instead.
 *
 * The aspect ratio is fixed. Animating it would change the element's own
 * height — `width: 100%; height: auto` takes its ratio from the viewBox — and
 * the whole page would shift on every frame.
 */
const FRAME = {
  width: TOTAL_WIDTH + PAD * 2,
  height: BLOCK.size + PAD * 2,
};

interface Shot {
  at: number;
  /** 1 is the whole frame; higher is closer. */
  zoom: number;
  /** Centre, in block units. */
  x: number;
  y: number;
}

const SHOTS: Shot[] = [
  // Inside the first stroke of ㅂ.
  { at: 0, zoom: 3.4, x: 0.28, y: 0.3 },
  { at: 0.3, zoom: 1, x: TOTAL_WIDTH / 2, y: BLOCK.size / 2 },
  { at: 0.56, zoom: 1, x: TOTAL_WIDTH / 2, y: BLOCK.size / 2 },
  // In through the collapse, and back out as the name resolves.
  { at: 0.76, zoom: 1.32, x: TOTAL_WIDTH / 2, y: BLOCK.size * 0.52 },
  { at: 1, zoom: 1.02, x: TOTAL_WIDTH / 2, y: BLOCK.size * 0.55 },
];

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
      // Constant on screen regardless of where the camera is.
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
    const latin = toPath(morph.latin, morph.contours);

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

    return { outer, path, length, morph, from, to, latin, current: from };
  });
  svg.append(partGroup);

  // --- The whole field, as one path ----------------------------------------
  //
  // The flow into Latin has to be a single element. A letter's outline and its
  // counter are separate contours, and `fill-rule` only punches a hole when
  // both live in the same path — split across nine, every counter rendered as
  // a solid blob and SEAN PARK came out unreadable.
  //
  // It also makes the last stage one movement rather than nine, which is what
  // it should be: by then there are no parts left, only the name.
  const fieldFrom: number[] = [];
  const fieldTo: number[] = [];
  let fieldContours = 0;
  for (const node of partNodes) {
    fieldFrom.push(...node.morph.to);
    fieldTo.push(...node.morph.latin);
    fieldContours += node.morph.contours;
  }

  const field = svgEl("path", {
    d: toPath(fieldFrom, fieldContours),
    fill: "currentColor",
    opacity: 0,
  });
  svg.append(field);

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
  /** Renders the frame at normalised time. */
  function apply(t: number) {
    const progress = progressEase(t);

    // --- Parts -------------------------------------------------------------
    LOCK_ORDER.forEach((partIndex, order) => {
      const node = partNodes[partIndex];
      const part = parts[partIndex];

      const locked = lockEase(phase(t, T.assembleFrom, T.assembleSpan, T.assembleStagger, order));

      const away = 1 - locked;
      node.outer.setAttribute(
        "transform",
        `translate(${(part.approach.x * away).toFixed(4)} ${(part.approach.y * away).toFixed(4)})`,
      );

      // The outline draws itself on, and the fill catches up behind it. A
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

      // Then it becomes its share of the syllable, and the syllable becomes
      // its share of SEAN PARK. One continuous chain of the same contours —
      // never a crossfade, never a cut, and nothing on screen that is not the
      // same twenty outlines it started with.
      const fused = fuseEase(phase(t, T.fuseFrom, T.fuseSpan, T.fuseStagger, part.syllable));

      const wanted =
        fused >= 1
          ? node.to
          : fused > 0
            ? blend(node.morph.from, node.morph.to, fused, node.morph.contours, toPath)
            : node.from;

      if (wanted !== node.current) {
        node.path.setAttribute("d", wanted);
        node.current = wanted;
      }
    });

    // The field takes over for the flow. At its first frame it is exactly what
    // the nine paths were drawing, so the handover is invisible.
    const flowed = flowEase(phase(t, T.flowFrom, T.flowSpan, 0, 0));
    const flowing = flowed > 0;
    partGroup.setAttribute("opacity", flowing ? "0" : "1");
    field.setAttribute("opacity", flowing ? "1" : "0");
    if (flowing) {
      field.setAttribute("d", blend(fieldFrom, fieldTo, flowed, fieldContours, toPath));
    }

    partGroup.style.fontVariationSettings = `"wght" ${lerp(
      WEIGHT.parts.from,
      WEIGHT.parts.to,
      progress,
    ).toFixed(1)}`;

    // --- Frames ------------------------------------------------------------
    // Present while there is something to assemble, gone once each block has.
    frames.forEach((frame, index) => {
      const drawn = lockEase(phase(t, T.assembleFrom, 0.16, 0.05, index));
      const gone = phase(t, T.fuseFrom, T.fuseSpan * 0.6, T.fuseStagger, index);
      frame.setAttribute("opacity", (drawn * (1 - gone) * 0.22).toFixed(3));
    });

    // --- Composed syllables -------------------------------------------------
    // --- Camera -------------------------------------------------------------
    let shot = SHOTS[SHOTS.length - 1];
    for (let i = 0; i < SHOTS.length - 1; i++) {
      const a = SHOTS[i];
      const b = SHOTS[i + 1];
      if (t <= b.at) {
        const k = shotEase(Math.min(1, Math.max(0, (t - a.at) / (b.at - a.at))));
        shot = {
          at: t,
          zoom: lerp(a.zoom, b.zoom, k),
          x: lerp(a.x, b.x, k),
          y: lerp(a.y, b.y, k),
        };
        break;
      }
    }

    const vw = FRAME.width / shot.zoom;
    const vh = FRAME.height / shot.zoom;
    svg.setAttribute(
      "viewBox",
      `${(shot.x - vw / 2).toFixed(4)} ${(shot.y - vh / 2).toFixed(4)} ${vw.toFixed(4)} ${vh.toFixed(4)}`,
    );

    // Stroke weight is in viewBox units, so it would thicken as the camera
    // pulls out. Scaling it by the zoom keeps the drawn line the same weight
    // on screen wherever the camera is.
    const strokeAt = STROKE / shot.zoom;
    for (const node of partNodes) {
      node.path.setAttribute("stroke-width", strokeAt.toFixed(5));
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
