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
 * Every form is baked outline data rather than live text — the whole point is
 * that a jamo turns into its share of a syllable and then into a Latin letter,
 * and only matched contours can do that. `scripts/build-loader.mjs` does the
 * matching once, at build time, against Pretendard Variable.
 *
 * The whole animation is a pure function of normalised time, `apply(t)`. Any
 * frame can be rendered on demand, which is what makes it possible to
 * screenshot a filmstrip and iterate on the motion instead of guessing at it.
 */

/** Total duration in milliseconds. */
export const DURATION = 3800;

/**
 * Where the sequence comes to rest.
 *
 * Not 1. The last beat is an exit — the camera dives back into the ink and the
 * whole thing fades out — which closes the loop seamlessly and hands off to the
 * page, but is not a frame anyone should be left looking at. Reduced motion
 * draws this instead, and it is the moment to screenshot for a still.
 */
export const REST = 0.88;

/** Beats, in normalised time. */
const T = {
  /**
   * Parts fly in and lock into their cells.
   *
   * Starting before zero on purpose. The camera opens hard inside the cell the
   * first part lands in, and a part that begins arriving at t = 0 is a hairline
   * there — the piece opened on three hundred milliseconds of one thin line in
   * an empty frame. Half a beat of head start means the first thing on screen
   * is solid ink at four times size, and what the pull-back reveals is that the
   * mass you were looking at is a letter.
   */
  assembleFrom: -0.06,
  assembleSpan: 0.22,
  assembleStagger: 0.026,

  /** Parts fuse into their syllable. */
  fuseFrom: 0.3,
  fuseSpan: 0.16,
  fuseStagger: 0.03,

  /**
   * The name flows into the one he goes by.
   *
   * The longest beat, and unhurried on purpose: the middle of this morph is
   * the only place the piece is neither Korean nor Latin, and that in-between
   * is the most interesting thing in it. Rushing past it to reach a legible
   * frame throws away the reason for doing the morph at all.
   */
  flowFrom: 0.52,
  flowSpan: 0.34,
  /** Unstaggered: by this point there are no parts left, only the name. */
  flowStagger: 0,

  /**
   * The exit.
   *
   * The camera dives back into a stroke while the whole frame fades out, which
   * does two jobs at once. Looping, it closes the seam: the last frame is a
   * near-black close-up of ink, which is exactly what the first frame is, so
   * the cut back to zero is invisible. Playing once, it is the handoff — the
   * loader is pulled into the page rather than switched off.
   */
  exitFrom: 0.93,
  exitSpan: 0.07,
  /** The other side of the blink, so a loop dissolves rather than cuts. */
  enterSpan: 0.03,
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
const LAST_FUSE = T.fuseFrom + 2 * T.fuseStagger + T.fuseSpan;
const LAST = Math.max(
  T.assembleFrom + 8 * T.assembleStagger + T.assembleSpan,
  LAST_FUSE,
  T.flowFrom + T.flowSpan,
);
if (LAST > REST) {
  throw new Error(`loader beats run to ${LAST.toFixed(3)}, past the resting frame at ${REST}`);
}
/**
 * The field takes over from the nine parts the instant the flow starts, and it
 * only holds the composed syllables — so a part still mid-fuse at that moment
 * would be yanked to its finished shape. Nothing on screen is allowed to jump.
 */
if (LAST_FUSE > T.flowFrom + 1e-9) {
  throw new Error(`fuse runs to ${LAST_FUSE.toFixed(3)}, past the flow at ${T.flowFrom}`);
}

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
/**
 * Camera moves. Leaves immediately and settles slowly, which is how a camera
 * behaves and is the opposite of easing in — a move that starts slowly reads
 * as the frame being dead for the first third of it.
 */
const shotEase = cubicBezier(0.22, 0.78, 0.24, 1);

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

/**
 * Where the camera opens and closes: hard inside the bottom-left block, on the
 * cell the very first part is drawn into. Opening anywhere else means opening
 * on an empty frame.
 */
const KEYHOLE = { zoom: 3.6, x: 0.44, y: 0.78 };

const SHOTS: Shot[] = [
  { at: 0, ...KEYHOLE },
  // Off the keyhole quickly. Held, it is three hundred milliseconds of one
  // hairline in an empty frame — a confident opening for about a third as long
  // as it lasted.
  { at: 0.11, zoom: 1.8, x: 0.86, y: 0.6 },
  { at: 0.28, zoom: 1, x: TOTAL_WIDTH / 2, y: BLOCK.size / 2 },
  { at: 0.5, zoom: 1, x: TOTAL_WIDTH / 2, y: BLOCK.size / 2 },
  // In through the collapse, and back out as the name resolves.
  { at: 0.7, zoom: 1.34, x: TOTAL_WIDTH / 2, y: BLOCK.size * 0.52 },
  { at: REST, zoom: 1.02, x: TOTAL_WIDTH / 2, y: BLOCK.size * 0.55 },
  // Held still while the name is legible. The one moment in the run the
  // camera is asked to do nothing, and it is the moment the piece is *for*.
  { at: 0.93, zoom: 1.02, x: TOTAL_WIDTH / 2, y: BLOCK.size * 0.55 },
  // Back into the keyhole, which is where the next pass starts.
  { at: 1, ...KEYHOLE },
];

/** Line weight of the drawn outlines, in block units. */
const STROKE = 0.011;

/**
 * The interior.
 *
 * Everything on screen is one plane of ink seen through a mask cut in the shape
 * of the name — so the type is a window, not a mark, and what shows through it
 * can be given a life of its own. What shows through is the piece itself,
 * enlarged and running ahead of where it currently is: the visible form is
 * always filled with the form it is about to become.
 *
 * That is what pays for the still moments. 박상현 holds legible for a beat in
 * the middle and SEAN PARK holds at the end, and on flat ink both read as the
 * animation having stopped. Filled with their own future they are the most
 * interesting frames in the run, because the shape is still and its interior
 * is not.
 *
 * Two layers at different scales and different amounts of lead, so the inside
 * has depth rather than a single moving line.
 */
const ECHOES = [
  { scale: 2.7, lead: 0.13, drift: { x: -0.55, y: 0.09 }, weight: 0.05 },
  { scale: 5.6, lead: 0.27, drift: { x: 0.34, y: -0.14 }, weight: 0.1 },
];

/** Where in a part's arrival the outline finishes drawing and the fill takes
 *  over. The two overlap, so the form is never a bare outline for long. */
const DRAW = { span: 0.62, fillFrom: 0.45 };

/** Distinguishes the mask of one mounted loader from another's. */
let mounted = 0;

export function mountLoader(root: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const { autoplay = true, loop = true, onComplete } = options;
  const uid = `loader-${++mounted}`;

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

  /**
   * The mask, and the single plane of ink seen through it.
   *
   * Nothing in this animation is painted directly. Every form — the parts, the
   * construction squares, the name — is a white shape inside this mask, and the
   * only thing with colour is one rectangle behind it. Inverting the
   * relationship that way costs nothing at rest and buys the interior: a
   * black shape added to the mask takes ink *away*, so the letterforms can be
   * cut into as well as drawn.
   */
  const defs = svgEl("defs");
  const mask = svgEl("mask", { id: `${uid}-ink` });
  // White paints; `currentColor` in here would resolve against the page's ink
  // colour and mask by however light that happens to be. Stroke stays off at
  // this level — SVG's default stroke-width is one *user* unit, which in a
  // viewBox three units wide dilates a letterform into a slab. Anything that
  // wants a stroke asks for one, with a width.
  const forms = svgEl("g", { fill: "#fff", stroke: "none" });
  const voids = svgEl("g", { fill: "none", stroke: "#000", "stroke-linejoin": "round" });

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
      stroke: "#fff",
      "stroke-width": 0.006,
      // Constant on screen regardless of where the camera is.
      "vector-effect": "non-scaling-stroke",
    }),
  );
  const frameGroup = svgEl("g");
  frameGroup.append(...frames);
  forms.append(frameGroup);

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
      fill: "#fff",
      stroke: "#fff",
      // Butt, not round. A round cap on a zero-length dash renders as a dot,
      // so at rest — dash offset at full length, nothing meant to be drawn —
      // every contour start left a speck on screen.
      "stroke-linecap": "butt",
      "stroke-linejoin": "round",
      "stroke-width": STROKE,
    });

    // The morph points are baked in frame coordinates — the same space the
    // final path uses, because that one has to hold all twenty contours at once
    // and can carry no per-block transform. So the only transform on a part is
    // the distance it still has to travel.
    outer.append(path);
    partGroup.append(outer);

    // Total outline length, for the draw-on. Read once, from the state the
    // part is drawn in. A jamo with several contours returns their sum, so
    // they draw one after another — roughly the order they would be written.
    const length = path.getTotalLength();
    path.setAttribute("stroke-dasharray", String(length));

    return { outer, path, length, morph, from, to, latin, current: from };
  });
  forms.append(partGroup);

  // --- The whole field, as one path ----------------------------------------
  //
  // The flow into Latin has to be a single element. A letter's outline and its
  // counter are separate contours, and `fill-rule` only punches a hole when
  // both live in the same path — split across nine, every counter rendered as
  // a solid blob and SEAN PARK came out unreadable.
  //
  // It also makes the last stage one movement rather than nine, which is what
  // it should be: by then there are no parts left, only the name.
  //
  // Three runs of the same twenty contours: where the parts start, the composed
  // syllables, and SEAN PARK. The whole animation is a walk along this chain,
  // which is what the interior echoes read ahead into.
  const chain = { start: [] as number[], mid: [] as number[], end: [] as number[] };
  let fieldContours = 0;
  for (const node of partNodes) {
    chain.start.push(...node.morph.from);
    chain.mid.push(...node.morph.to);
    chain.end.push(...node.morph.latin);
    fieldContours += node.morph.contours;
  }

  const field = svgEl("path", {
    d: toPath(chain.mid, fieldContours),
    fill: "#fff",
    opacity: 0,
  });
  forms.append(field);

  // --- The interior --------------------------------------------------------
  // Outlines rather than solids: a filled echo can swallow a letter whole,
  // where a line crossing one reads as an inlay and never costs legibility.
  const echoNodes = ECHOES.map(() => {
    const path = svgEl("path", { d: "" });
    voids.append(path);
    return path;
  });

  mask.append(forms, voids);

  /**
   * The sheen: one band of full ink crossing a plane that is otherwise held
   * back, travelling the width once over the run.
   *
   * Every stop is `currentColor` and only the opacity varies, so the piece
   * still takes its colour entirely from the page and works on any ground.
   * What it buys is that no frame is ever flat — even a completely still one
   * has light moving across it.
   */
  const sheen = svgEl("linearGradient", {
    id: `${uid}-sheen`,
    gradientUnits: "userSpaceOnUse",
    x1: 0,
    y1: BLOCK.size,
    x2: TOTAL_WIDTH * 0.62,
    y2: 0,
  });
  for (const [offset, opacity] of [
    [0, 0.72],
    [0.5, 1],
    [1, 0.72],
  ]) {
    sheen.append(
      svgEl("stop", { offset, "stop-color": "currentColor", "stop-opacity": opacity }),
    );
  }

  defs.append(mask, sheen);

  // The plane the mask is cut from. Big enough to cover every camera position,
  // since the viewBox moves under it.
  const plane = svgEl("rect", {
    x: -FRAME.width,
    y: -FRAME.height,
    width: FRAME.width * 3,
    height: FRAME.height * 3,
    fill: `url(#${uid}-sheen)`,
    mask: `url(#${uid}-ink)`,
  });
  svg.append(defs, plane);

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
   * The twenty contours at any moment of the chain, unstaggered.
   *
   * The visible animation staggers its beats; this does not, because it is read
   * at a time other than now and a stagger there would only smear the lead.
   */
  function chainAt(time: number): string {
    const flowed = flowEase(phase(time, T.flowFrom, T.flowSpan, 0, 0));
    if (flowed > 0) return blend(chain.mid, chain.end, flowed, fieldContours, toPath);
    const fused = fuseEase(phase(time, T.fuseFrom, T.fuseSpan, 0, 0));
    return blend(chain.start, chain.mid, fused, fieldContours, toPath);
  }

  /** Renders the frame at normalised time. */
  function apply(t: number) {
    // The counter has to finish when the *name* does, not when the run does —
    // the exit is not loading, it is leaving.
    const progress = progressEase(Math.min(1, t / REST));

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
      field.setAttribute("d", blend(chain.mid, chain.end, flowed, fieldContours, toPath));
    }

    // --- Frames ------------------------------------------------------------
    // Present while there is something to assemble, gone once each block has.
    // The first one is already drawn at t = 0 — the camera opens hard inside
    // it, and an empty first frame is a dead first frame.
    frames.forEach((frame, index) => {
      const drawn = lockEase(phase(t, -0.05, 0.16, 0.05, index));
      const gone = phase(t, T.fuseFrom, T.fuseSpan * 0.6, T.fuseStagger, index);
      frame.setAttribute("opacity", (drawn * (1 - gone) * 0.22).toFixed(3));
    });

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

    // --- Interior ------------------------------------------------------------
    // Each layer shows the chain some way ahead of now, enlarged about the
    // frame's centre and drifting. Clamped rather than wrapped: past the end
    // there is nothing further to read, and a wrap would put the beginning of
    // the next pass inside the last frame of this one.
    const cx = TOTAL_WIDTH / 2;
    const cy = BLOCK.size / 2;
    // The cuts fine down as the name arrives. They keep moving — that is what
    // the resting frames are for — but a name this piece spent four seconds
    // resolving should land crisp, not chewed.
    const settle = 1 - 0.55 * phase(t, 0.74, 0.12, 0, 0);
    ECHOES.forEach((echo, index) => {
      const node = echoNodes[index];
      node.setAttribute("d", chainAt(Math.min(REST, t + echo.lead)));
      node.setAttribute(
        "transform",
        `translate(${cx} ${cy}) scale(${echo.scale}) translate(${-cx} ${-cy})` +
          ` translate(${(echo.drift.x * t).toFixed(4)} ${(echo.drift.y * t).toFixed(4)})`,
      );
      // Undoing both the layer's own scale and the camera's, so a cut is the
      // same width on screen wherever it is and whenever it happens.
      node.setAttribute(
        "stroke-width",
        ((echo.weight * settle) / (echo.scale * shot.zoom)).toFixed(5),
      );
    });

    // The sheen crosses once over the run, so it is never in the same place
    // twice and the loop never catches it mid-repeat.
    sheen.setAttribute("gradientTransform", `translate(${(t * 2.2 - 1.1) * TOTAL_WIDTH} 0)`);

    // --- Exit ----------------------------------------------------------------
    // The dive is the camera's; this is the blink that goes with it. Out over
    // the dive, in over the first frames of the next pass — so a loop dissolves
    // through a beat of dark instead of cutting from a resolved name back to an
    // empty frame, and a single run hands off to the page rather than stopping.
    const blink =
      phase(t, 0, T.enterSpan, 0, 0) * (1 - phase(t, T.exitFrom, T.exitSpan, 0, 0));
    svg.style.opacity = blink.toFixed(3);

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
    // The resolved state, drawn once. `REST` and not 1: the last beat is the
    // exit, and a still of that is a close-up of a stroke fading out.
    apply(REST);
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
