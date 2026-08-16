import "./loader.css";
import { FRAME, MORPHS, MORPH_POINTS } from "./morphs.ts";

/**
 * The loading animation.
 *
 *   ●                    one circle
 *   ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ   the name, taken apart
 *   SEAN PARK            the name he goes by
 *
 * Three states and one continuous morph through all of them, drawn by a single
 * path. There is no arrival, no assembly and no handover: every frame in the
 * run is the same twenty contours interpolated somewhere along the chain.
 *
 * The circle is ㅇ. 상 has one, so the name already contains a perfect circle —
 * it does not have to be invented and it does not have to come from anywhere.
 * Every contour starts as a copy of ㅇ's own ring, at ㅇ's own place and size,
 * so the first frame is one small disc and ㅇ is the piece that never moves.
 *
 * 박상현 is three Hangul blocks, each a square assembled from two or three
 * jamo; taken apart it is the nine pieces the disc opens into. The composed
 * syllables are not drawn — showing them and immediately pulling them apart
 * again showed the same name twice, and the pieces are the more interesting
 * half. That is also why this cannot be a stock preloader wearing someone's
 * name: it is specific to *this* name in *this* script.
 *
 * Every form is baked outline data rather than live text — the whole point is
 * that a circle turns into a jamo turns into a Latin letter, and only matched
 * contours can do that. `scripts/build-loader.mjs` does the matching once, at
 * build time, against Pretendard Variable, at one weight and one scale for
 * every glyph.
 *
 * The whole animation is a pure function of normalised time, `apply(t)`. Any
 * frame can be rendered on demand, which is what makes it possible to
 * screenshot a filmstrip and iterate on the motion instead of guessing at it.
 */

/** Total duration in milliseconds. */
export const DURATION = 2600;

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
   * The disc opens into the line.
   *
   * Unstaggered, which took a couple of goes to accept. Every contour starts as
   * the *same* circle in the *same* place, so one that leaves before its
   * neighbours is briefly an identical circle sitting next to the one it left —
   * it reads as the disc budding a duplicate, not as the disc opening. Moving
   * them together means every frame is the whole line at one fraction of its
   * spread, which reads as the mark stretching out into type.
   *
   * What carries the interest instead is `OPEN`: the circles fly apart before
   * they change shape, so the beat has two readable halves rather than one
   * smeared one.
   */
  openFrom: 0.05,
  openSpan: 0.34,

  /**
   * The line flows into the name he goes by.
   *
   * The longest beat, and unhurried on purpose: the middle of this morph is
   * the only place the piece is neither Korean nor Latin, and that in-between
   * is the most interesting thing in it. Rushing past it to reach a legible
   * frame throws away the reason for doing the morph at all.
   */
  flowFrom: 0.5,
  flowSpan: 0.34,

  /**
   * The exit.
   *
   * The camera closes back on the circle while the whole frame fades out, which
   * does two jobs at once. Looping, it closes the seam: the last frame is
   * framed exactly as the first. Playing once, it is the handoff — the loader
   * is pulled away rather than switched off.
   */
  exitFrom: 0.93,
  exitSpan: 0.07,
  /**
   * There is no fade *in*. The mark has to be there when the run starts, and
   * any ramp at all opens the animation on an empty frame. Looping, the cut
   * from the faded-out end back to a small disc on an empty field is the
   * gentlest cut there is — the frame is nearly black on both sides of it.
   */
} as const;

/**
 * Every beat has to close before the run comes to rest.
 *
 * Checked here rather than left as arithmetic in a comment, because it is the
 * kind of thing that breaks silently every time a beat is retimed — a span
 * running past `REST` leaves the final frame mid-morph, and the name renders as
 * a scramble.
 */
const LAST = Math.max(T.openFrom + T.openSpan, T.flowFrom + T.flowSpan);
if (LAST > REST) {
  throw new Error(`loader beats run to ${LAST.toFixed(3)}, past the resting frame at ${REST}`);
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

/**
 * How the opening splits between travelling and unfolding.
 *
 * `travel` is the fraction of the beat the circles spend flying apart — they
 * are in place well before they finish becoming letters — and `unfoldFrom` is
 * how far in the shape change starts. The overlap is deliberate: no gap where
 * a row of circles sits still waiting to turn into something.
 */
const OPEN = { travel: 0.62, unfoldFrom: 0.24 };

/** The circles flying apart: leaves decisively, settles slowly. */
const moveEase = cubicBezier(0.22, 0.86, 0.26, 1);
/** The letterforms unfolding, gentler at both ends than the travel. */
const openEase = cubicBezier(0.5, 0.02, 0.35, 1);
/**
 * The flow into Latin.
 *
 * Gentle at both ends and slower through the middle, so the
 * abstract stretch — where the forms are neither script — is what gets the
 * time.
 */
const flowEase = cubicBezier(0.5, 0.02, 0.5, 0.98);
/**
 * Camera moves. Leaves immediately and settles slowly, which is how a camera
 * behaves and is the opposite of easing in — a move that starts slowly reads
 * as the frame being dead for the first third of it.
 */
const shotEase = cubicBezier(0.22, 0.78, 0.24, 1);

/**
 * The counter.
 *
 * Has to actually finish, and has to not finish early. The old curve reached 92
 * before the pieces had even stopped arriving and then crawled the last eight
 * over two seconds, which reads as a progress bar lying — the one thing a
 * counter can do that is worse than not being there.
 */
const progressEase = cubicBezier(0.5, 0.1, 0.4, 1);

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

/**
 * The camera.
 *
 * A viewBox that moves, which is the difference between type appearing on a
 * screen and a space you are moved through. It opens close on the disc, pulls
 * back as the line opens out of it, and pushes in through the morph.
 *
 * The aspect ratio is fixed. Animating it would change the element's own
 * height — `width: 100%; height: auto` takes its ratio from the viewBox — and
 * the whole page would shift on every frame. `FRAME` comes from `morphs.ts`,
 * which derives it from the geometry it just laid out, so there is no second
 * copy of the composition to drift.
 */
interface Shot {
  at: number;
  /** 1 is the whole frame; higher is closer. */
  zoom: number;
  /** Centre, in frame units. */
  x: number;
  y: number;
}

const CENTRE = { x: FRAME.width / 2, y: FRAME.height / 2 };

/**
 * Where the camera opens and closes: on the circle.
 *
 * Measured off the seed's own outline rather than written down, because "framed
 * on the disc" is the requirement and a hand-picked coordinate stops meaning
 * that the moment the layout moves.
 */
function onSeed(points: number[]): Shot {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (let i = 0; i < points.length; i += 2) {
    x1 = Math.min(x1, points[i]);
    x2 = Math.max(x2, points[i]);
    y1 = Math.min(y1, points[i + 1]);
    y2 = Math.max(y2, points[i + 1]);
  }
  // Close, but not inside it. The disc should read as a small mark with room
  // around it — it is about to become a whole name, and a crop implies the
  // opposite.
  const zoom = Math.min(3.2, Math.max(1.6, FRAME.height / ((y2 - y1) * 2.1)));
  return { at: 0, zoom, x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

function shots(open: Shot): Shot[] {
  return [
    { ...open, at: 0 },
    // Held close while it is still a mark. The camera pulling back before the
    // disc has done anything shrinks it away before anyone has seen it.
    { at: 0.09, zoom: open.zoom * 0.72, ...CENTRE },
    { at: 0.34, zoom: 1, ...CENTRE },
    { at: 0.5, zoom: 1, ...CENTRE },
    // In through the middle of the morph, where nine of the twenty contours
    // shrink to nothing: on a fixed camera the field visibly loses mass and
    // comes back, which reads as a fault. Moving in as it contracts keeps it
    // filling the frame, and the same moment reads as a dive into the change.
    { at: 0.74, zoom: 1.22, x: CENTRE.x, y: CENTRE.y * 0.98 },
    { at: REST, zoom: 1.02, ...CENTRE },
    // Held still while the name is legible. The one moment in the run the
    // camera is asked to do nothing, and it is the moment the piece is *for*.
    { at: 0.93, zoom: 1.02, ...CENTRE },
    // Back to the circle, which is where the next pass starts.
    { ...open, at: 1 },
  ];
}

/** The camera's whole path, opening and closing on the circle. */
const SHOTS = shots(onSeed(MORPHS[0].seed));

/**
 * The interior.
 *
 * Everything on screen is one plane of ink seen through a mask cut in the shape
 * of the name — so the type is a window, not a mark, and what shows through it
 * can be given a life of its own. What shows through is the piece itself,
 * enlarged and running ahead of where it currently is: the visible form is
 * always filled with the form it is about to become.
 *
 * That is what pays for the still moments. The assembled line holds for a beat
 * before the morph and SEAN PARK holds at the end, and on flat ink both read
 * as the animation having stopped. Filled with their own future they are the
 * most interesting frames in the run, because the shape is still and its
 * interior is not.
 *
 * Two layers at different scales and different amounts of lead, so the inside
 * has depth rather than a single moving line.
 */
const ECHOES = [
  { scale: 2.2, lead: 0.13, drift: { x: -0.5, y: 0.07 }, weight: 0.022 },
  { scale: 4, lead: 0.27, drift: { x: 0.3, y: -0.1 }, weight: 0.044 },
];

/**
 * The weights above are read against the type's own stem, not against the
 * frame. A line of nine glyphs is set a good deal smaller than three composed
 * blocks were, and cuts that were an inlay at the old size took a third out of
 * every stroke at this one. Roughly a quarter of a stem for the fine layer and
 * a half for the broad one is the range where they read as cut into the
 * letterform rather than as damage to it.
 */

/** Distinguishes the mask of one mounted loader from another's. */
let mounted = 0;

export function mountLoader(root: HTMLElement, options: LoaderOptions = {}): LoaderHandle {
  const { autoplay = true, loop = true, onComplete } = options;
  const uid = `loader-${++mounted}`;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const wrap = document.createElement("div");
  wrap.className = "loader";

  const svg = svgEl("svg", {
    viewBox: `0 0 ${FRAME.width} ${FRAME.height}`,
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
   * Nothing in this animation is painted directly. Every form — the pieces and
   * the name they become — is a white shape inside this mask, and the only
   * thing with colour is one rectangle behind it. Inverting the
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
  // Not fully black. A cut at full strength severs a stroke, and half the
  // glyphs in the first stage are thin vertical strokes — ㅏ came apart into
  // three pieces every time a cut crossed it. At two thirds the letterform
  // stays whole and the interior still reads as inlaid rather than painted.
  const voids = svgEl("g", {
    fill: "none",
    stroke: "#000",
    "stroke-opacity": 0.66,
    "stroke-linejoin": "round",
  });

  // --- The nine pieces, which become SEAN PARK -----------------------------
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

  // --- The whole run, as one path -------------------------------------------
  //
  // One element for everything. A letter's outline and its counter are separate
  // contours, and `fill-rule` only punches a hole when both live in the same
  // path — split across nine, every counter rendered as a solid blob and SEAN
  // PARK came out unreadable. It is also simply what the animation is: not nine
  // things that later become one, but one field of twenty contours moving along
  // a chain from a circle to a name.
  //
  // Three flat runs of the same twenty contours, in the order the path draws
  // them, so a frame is two lerps and a string.
  const chain = { seed: [] as number[], jamo: [] as number[], latin: [] as number[] };

  /**
   * One contour's slice of those runs, with where it starts and where it lands.
   *
   * The centroids are the whole reason this is per contour rather than per
   * piece. Twenty circles that change shape while they are still travelling
   * spend the first third of the run as a lump — every one of them is halfway
   * between a circle and a letter *and* halfway to where it is going, and the
   * frame reads as a smear. Splitting the two lets the circles fly apart first
   * and unfold once they are in place, which is legible at every frame in
   * between: a mark, then a row of marks, then type.
   */
  const bits: Array<{
    at: number;
    length: number;
    from: [number, number];
    to: [number, number];
  }> = [];
  let contours = 0;

  function centroid(points: number[], at: number, length: number): [number, number] {
    let x = 0;
    let y = 0;
    for (let i = at; i < at + length; i += 2) {
      x += points[i];
      y += points[i + 1];
    }
    return [x / (length / 2), y / (length / 2)];
  }

  for (const morph of MORPHS) {
    const base = chain.seed.length;
    chain.seed.push(...morph.seed);
    chain.jamo.push(...morph.jamo);
    chain.latin.push(...morph.latin);

    const span = MORPH_POINTS * 2;
    for (let c = 0; c < morph.contours; c++) {
      const at = base + c * span;
      bits.push({
        at,
        length: span,
        from: centroid(chain.seed, at, span),
        to: centroid(chain.jamo, at, span),
      });
    }
    contours += morph.contours;
  }

  const field = svgEl("path", { d: "", fill: "#fff" });
  forms.append(field);

  /**
   * The whole chain at one moment: every point through both morphs at once.
   *
   * Composed rather than branched, so there is no moment where one stage hands
   * over to another and therefore no handover to get wrong. Before the flow
   * starts its factor is 0 and that lerp is a no-op; the arithmetic is cheap
   * enough not to be worth avoiding.
   */
  function chainAt(t: number): string {
    const points = new Array<number>(chain.seed.length);

    const opening = phase(t, T.openFrom, T.openSpan, 0, 0);
    const moved = moveEase(Math.min(1, opening / OPEN.travel));
    const formed = openEase(Math.max(0, (opening - OPEN.unfoldFrom) / (1 - OPEN.unfoldFrom)));
    const flowed = flowEase(phase(t, T.flowFrom, T.flowSpan, 0, 0));

    for (const bit of bits) {
      const cx = bit.from[0] + (bit.to[0] - bit.from[0]) * moved;
      const cy = bit.from[1] + (bit.to[1] - bit.from[1]) * moved;

      for (let i = bit.at; i < bit.at + bit.length; i += 2) {
        // Each point relative to its own contour's centre, so the shape can
        // unfold on a schedule of its own while the centre travels on another.
        const sx = chain.seed[i] - bit.from[0];
        const sy = chain.seed[i + 1] - bit.from[1];
        const x = cx + sx + (chain.jamo[i] - bit.to[0] - sx) * formed;
        const y = cy + sy + (chain.jamo[i + 1] - bit.to[1] - sy) * formed;

        points[i] = x + (chain.latin[i] - x) * flowed;
        points[i + 1] = y + (chain.latin[i + 1] - y) * flowed;
      }
    }

    return toPath(points, contours);
  }

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
   * The sheen: a soft band crossing a plane that is otherwise full ink,
   * travelling the width once over the run.
   *
   * Dark edges around a lit core, so it reads as light catching an edge rather
   * than as a wash. The core is the site's own accent — the one place colour
   * enters a piece that is otherwise entirely the page's ink on the page's
   * ground, and it follows the theme because that token already does.
   *
   * A dip rather than a highlight, which matters at the ends. Sweeping a
   * *bright* band across a held-back plane means that once it has passed, the
   * name sits at whatever the gradient's floor is forever — the resolved frame
   * the whole piece builds to landed at 72% ink and read as washed out. This
   * way full ink is the resting state and the band is something that happens
   * to it.
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
    y1: FRAME.height,
    x2: FRAME.width * 0.62,
    y2: 0,
  });
  const INK = "currentColor";
  // The site's own accent, and monochrome wherever that token is not defined.
  // Theme-aware for free: `--accent` is already a different colour on each
  // ground, chosen there for contrast against it.
  const LIT = "var(--accent, currentColor)";
  for (const [offset, colour, opacity] of [
    [0, INK, 1],
    [0.3, INK, 1],
    [0.42, INK, 0.7],
    [0.5, LIT, 1],
    [0.58, INK, 0.7],
    [0.7, INK, 1],
    [1, INK, 1],
  ] as Array<[number, string, number]>) {
    sheen.append(svgEl("stop", { offset, "stop-color": colour, "stop-opacity": opacity }));
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

  /**
   * How hard to cut, given how big this is being drawn.
   *
   * The cuts are in viewBox units, so left alone they are a constant *fraction*
   * of the letterform — which is right at hero size and wrong at two hundred
   * pixels, where taking a third out of a stroke fourteen pixels tall stops
   * being a treatment and starts being damage. Eased toward a floor rather than
   * switched at a breakpoint, and clamped at both ends: unmeasured, or drawn
   * large, it is simply 1.
   *
   * Read from a resize observer rather than inside `apply`, which stays a pure
   * function of time.
   */
  let cutScale = 1;
  const REFERENCE_WIDTH = 640;

  const resize = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    if (width > 0) cutScale = Math.min(1, Math.max(0.42, width / REFERENCE_WIDTH));
  });
  resize.observe(wrap);

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

  /** Renders the frame at normalised time. */
  function apply(t: number) {
    // The counter has to finish when the *name* does, not when the run does —
    // the exit is not loading, it is leaving.
    const progress = progressEase(Math.min(1, t / REST));

    field.setAttribute("d", chainAt(t));

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

    // --- Interior ------------------------------------------------------------
    // Each layer shows the chain some way ahead of now, enlarged about the
    // frame's centre and drifting. Clamped rather than wrapped: past the end
    // there is nothing further to read, and a wrap would put the beginning of
    // the next pass inside the last frame of this one.
    const { x: cx, y: cy } = CENTRE;
    // The cuts are choreographed rather than constant: barely there on the two
    // states that have to be read, full strength through the middle, where the
    // forms are neither script and legibility is not the job. They never stop
    // moving — that is what the resting frames are for — but the disc is a
    // small mark and the name is the thing the whole run resolves to, and
    // neither should land chewed.
    const bite =
      0.25 + 0.75 * phase(t, 0.44, 0.14, 0, 0) * (1 - 0.92 * phase(t, 0.76, 0.1, 0, 0));
    const settle = bite * cutScale;
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
    sheen.setAttribute("gradientTransform", `translate(${(t * 2.2 - 1.1) * FRAME.width} 0)`);

    // --- Exit ----------------------------------------------------------------
    // The camera closes back on the circle; this is the fade that goes with it.
    // A loop dissolves through a beat of dark instead of cutting from a
    // resolved name back to a bare mark, and a single run hands off to the page
    // rather than stopping.
    svg.style.opacity = (1 - phase(t, T.exitFrom, T.exitSpan, 0, 0)).toFixed(3);

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
      resize.disconnect();
      wrap.remove();
    },
    duration: DURATION,
  };
}
