#!/usr/bin/env node
/**
 * Bakes the loader's letterforms out of Pretendard Variable.
 *
 *   npm run build:loader
 *
 * Two stages, and one continuous morph between them: the nine jamo of 박상현
 * set as a line, becoming SEAN PARK. Nothing about that is possible with live
 * text — it needs every contour of one stage paired with a contour of the next,
 * resampled to a shared point count and rotation-aligned so a straight lerp
 * between them is a valid outline at every step. That matching happens here,
 * once, so the runtime only interpolates.
 *
 * Outlines come from `scripts/glyph-outlines.py`, in the font's own units.
 *
 * Emits src/loader/morphs.ts. No font ships; the outlines are the asset.
 *
 * Needs fonttools:  python3 -m pip install fonttools
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const SOURCE = "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf";

/**
 * The weight the whole piece is drawn at.
 *
 * One weight for everything, which is the point. The parts used to be fitted
 * individually into cells of an invented grid, so each jamo got its own scale
 * and therefore its own stroke weight, and nine glyphs of visibly different
 * colour read as shapes arranged to resemble Hangul rather than as type.
 */
const WEIGHT = 340;

/** 박상현, taken apart. Consonants carry the name; vowels open it out. */
const JAMO = [
  { char: "ㅂ", kind: "consonant", syllable: 0 },
  { char: "ㅏ", kind: "vowel", syllable: 0 },
  { char: "ㄱ", kind: "consonant", syllable: 0 },
  { char: "ㅅ", kind: "consonant", syllable: 1 },
  { char: "ㅏ", kind: "vowel", syllable: 1 },
  { char: "ㅇ", kind: "consonant", syllable: 1 },
  { char: "ㅎ", kind: "consonant", syllable: 2 },
  { char: "ㅕ", kind: "vowel", syllable: 2 },
  { char: "ㄴ", kind: "consonant", syllable: 2 },
];

const LATIN = "SEAN PARK";

/**
 * Spacing for the jamo line, as a fraction of the em, measured as the closest
 * approach between neighbouring ink.
 *
 * Compatibility jamo are full-width — every one of them advances 0.864 em,
 * because they are meant to be composed into a square and not set in a row.
 * Their ink sits in wildly different places inside that square (ㅏ is a narrow
 * stroke hard against the right edge; ㅂ nearly fills it), so metric spacing
 * gives gaps that swing between a third and two thirds of an em. Optical
 * spacing is what a designer does at display size, and it is the difference
 * between a line of type and nine glyphs dropped next to each other.
 */
const TRACK = { within: 0.17, between: 0.46 };

/** How wide both stages are set, and the air around them. */
const CONTENT_WIDTH = 3;
const PAD = { x: 0.22, y: 0.2 };

/** Latin tracking, in em. Caps at display size need a little taken out. */
const LATIN_TRACK = -0.014;

/**
 * Points per contour after resampling. Every contour in a morph pair has
 * exactly this many, which is what makes interpolating them possible at all.
 */
const MORPH_N = 64;

/**
 * Chordal tolerance for flattening, in font units.
 *
 * In *font units*, and the flattening runs in font units, because this number
 * being read in the wrong ones is what wrecked the first version of this
 * pipeline. It was written as 0.3 font units and compared against deviations
 * measured in em, where a whole glyph is about 1 — so the test passed on the
 * first try every time and every curve in the piece was flattened to a single
 * straight chord. That is why ㅇ was a polygon and the letterforms read as
 * shapes arranged to resemble Hangul rather than as type.
 */
const FLAT_TOLERANCE = 0.3;

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`${SOURCE} is missing — run npm install`);
  }
  writeMorphs();
}

/**
 * Every glyph the loader draws, as flattened closed polylines in em, y down as
 * SVG wants — the font measures up from the baseline and SVG measures down.
 */
function readGlyphs() {
  const chars = [...new Set([...JAMO.map((j) => j.char), ...LATIN.replace(/ /g, "")])].join("");
  const raw = JSON.parse(
    execFileSync("python3", ["scripts/glyph-outlines.py", SOURCE, String(WEIGHT), chars], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  );

  const em = raw.unitsPerEm;
  const glyphs = {};

  for (const [char, glyph] of Object.entries(raw.glyphs)) {
    glyphs[char] = {
      advance: glyph.advance / em,
      // Flattened in font units, then converted — see FLAT_TOLERANCE. The font
      // measures up from the baseline and SVG measures down, hence the flip.
      contours: glyph.contours.map((contour) => {
        let cursor = contour.start;
        const points = [cursor];

        for (const [type, ...values] of contour.segments) {
          const p = [];
          for (let i = 0; i < values.length; i += 2) p.push([values[i], values[i + 1]]);

          if (type === "L") points.push(p[0]);
          else if (type === "Q") flattenQuadratic(cursor, p[0], p[1], points);
          else flattenCubic(cursor, p[0], p[1], p[2], points);

          cursor = p[p.length - 1];
        }

        // The pen leaves the contour open; the closing edge back to the start
        // is implied, so a duplicated endpoint would only be a zero-length one.
        const first = points[0];
        const last = points[points.length - 1];
        if (Math.hypot(last[0] - first[0], last[1] - first[1]) < 1e-9) points.pop();
        return points.map(([x, y]) => [x / em, -y / em]);
      }),
    };
  }

  return glyphs;
}

/** The bounding box of a set of contours. */
function boxOf(contours) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const contour of contours) {
    for (const [x, y] of contour) {
      if (x < x1) x1 = x;
      if (y < y1) y1 = y;
      if (x > x2) x2 = x;
      if (y > y2) y2 = y;
    }
  }
  return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}

function mapContours(contours, fn) {
  return contours.map((contour) => contour.map(([x, y]) => fn(x, y)));
}

function deviation(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function flattenCubic(p0, c0, c1, p1, out, depth = 0) {
  if (depth > 14 || Math.max(deviation(c0, p0, p1), deviation(c1, p0, p1)) <= FLAT_TOLERANCE) {
    out.push(p1);
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const a = mid(p0, c0);
  const b = mid(c0, c1);
  const c = mid(c1, p1);
  const d = mid(a, b);
  const e = mid(b, c);
  const f = mid(d, e);
  flattenCubic(p0, a, d, f, out, depth + 1);
  flattenCubic(f, e, c, p1, out, depth + 1);
}

function flattenQuadratic(p0, c, p1, out, depth = 0) {
  if (depth > 14 || deviation(c, p0, p1) <= FLAT_TOLERANCE) {
    out.push(p1);
    return;
  }
  const m0 = [(p0[0] + c[0]) / 2, (p0[1] + c[1]) / 2];
  const m1 = [(c[0] + p1[0]) / 2, (c[1] + p1[1]) / 2];
  const mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2];
  flattenQuadratic(p0, m0, mid, out, depth + 1);
  flattenQuadratic(mid, m1, p1, out, depth + 1);
}

function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function centroidOf(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

/**
 * Resamples a closed contour to a fixed count, spaced by arc length, starting
 * from a canonical seed — topmost point, leftmost on a tie.
 *
 * Arc length rather than parameter value: parameter-spaced points bunch at
 * corners and starve long straight runs, and during a morph that bunching
 * shows as a rubber-band drag on one region while the rest moves cleanly.
 */
function resample(points, count) {
  let seed = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [sx, sy] = points[seed];
    if (y < sy || (y === sy && x < sx)) seed = i;
  }

  const ordered = [...points.slice(seed), ...points.slice(0, seed)];
  const lengths = ordered.map((p, i) => {
    const q = ordered[(i + 1) % ordered.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const perimeter = lengths.reduce((sum, l) => sum + l, 0);

  const out = [];
  const step = perimeter / count;
  let edge = 0;
  let consumed = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (edge < lengths.length - 1 && consumed + lengths[edge] < target) {
      consumed += lengths[edge];
      edge++;
    }
    const t = lengths[edge] === 0 ? 0 : (target - consumed) / lengths[edge];
    const a = ordered[edge];
    const b = ordered[(edge + 1) % ordered.length];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  return out;
}

/**
 * Rotates `target`'s point order to line up with `source`.
 *
 * The step that matters most. Two contours resampled independently start
 * wherever their own seed landed, and interpolating mismatched orders makes
 * the shape unwind and cartwheel — the most recognisable way a contour morph
 * looks wrong. Never reversed: winding carries which side is solid, and
 * flipping one to win a little matching cost turns a counter inside out.
 */
function alignRotation(source, target) {
  let best = target;
  let bestCost = Infinity;

  for (let offset = 0; offset < target.length; offset++) {
    let cost = 0;
    for (let i = 0; i < source.length; i++) {
      const s = source[i];
      const t = target[(i + offset) % target.length];
      cost += (s[0] - t[0]) ** 2 + (s[1] - t[1]) ** 2;
      if (cost >= bestCost) break;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = target.slice(offset).concat(target.slice(0, offset));
    }
  }

  return best;
}


/** Bands of a contour set, as the leftmost and rightmost ink in each. */
function profile(contours, top, bottom, bands) {
  const left = new Array(bands).fill(Infinity);
  const right = new Array(bands).fill(-Infinity);
  const step = (bottom - top) / bands;

  for (const contour of contours) {
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i];
      const b = contour[(i + 1) % contour.length];
      // Sampled along each edge rather than at its ends, so a long diagonal
      // registers in every band it crosses instead of only two.
      const steps = Math.max(1, Math.ceil(Math.abs(b[1] - a[1]) / step));
      for (let k = 0; k <= steps; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / steps;
        const y = a[1] + ((b[1] - a[1]) * k) / steps;
        const band = Math.min(bands - 1, Math.max(0, Math.floor((y - top) / step)));
        if (x < left[band]) left[band] = x;
        if (x > right[band]) right[band] = x;
      }
    }
  }

  return { left, right };
}

/**
 * The nine jamo, set as a line.
 *
 * One scale for all of them and one baseline, which is the whole of what makes
 * them read as a typeface rather than as an arrangement. Only the spacing is a
 * decision — see `TRACK` — and it is made by closest approach rather than
 * between bounding boxes.
 *
 * Bounding boxes are the obvious way and they are wrong here. ㅏ is a stem hard
 * against the right of its square with a short branch off the left; box it and
 * the branch sets the left edge, so the eye sees the stem sitting far from the
 * glyph before it and the branch almost touching the one after. Measuring the
 * real gap in horizontal bands is what a designer is doing by eye, and it is
 * the difference between glyphs that are spaced and glyphs that are placed.
 */
const BANDS = 96;

function jamoLine(glyphs) {
  const boxes = JAMO.map((part) => boxOf(glyphs[part.char].contours));
  const top = Math.min(...boxes.map((b) => b.y1));
  const bottom = Math.max(...boxes.map((b) => b.y2));
  const profiles = JAMO.map((part) => profile(glyphs[part.char].contours, top, bottom, BANDS));

  let pen = 0;
  const placed = [];
  const shifts = [];

  JAMO.forEach((part, index) => {
    if (index === 0) {
      shifts.push(-boxes[0].x1);
    } else {
      const want = JAMO[index - 1].syllable === part.syllable ? TRACK.within : TRACK.between;
      const before = profiles[index - 1];
      const now = profiles[index];

      // The tightest the pair can sit before any band touches. Bands where only
      // one of them has ink say nothing about the gap between them.
      let clearance = Infinity;
      for (let band = 0; band < BANDS; band++) {
        if (before.right[band] === -Infinity || now.left[band] === Infinity) continue;
        clearance = Math.min(clearance, now.left[band] - before.right[band]);
      }
      // Two glyphs that never share a band — a high ㄱ over a low ㄴ — have no
      // gap to measure, so the boxes are all there is.
      if (clearance === Infinity) clearance = boxes[index].x1 - boxes[index - 1].x2;

      shifts.push(shifts[index - 1] + want - clearance);
    }

    placed.push(mapContours(glyphs[part.char].contours, (x, y) => [x + shifts[index], y]));
  });

  return placed;
}

/** SEAN PARK, set with the font's own advances and a little tracking taken out. */
function latinLine(glyphs) {
  let pen = 0;
  const placed = [];

  for (const char of LATIN) {
    if (char === " ") {
      // A word space of the font's own, rather than an invented gap.
      pen += glyphs.A.advance * 0.5;
      continue;
    }
    for (const contour of glyphs[char].contours) {
      placed.push(contour.map(([x, y]) => [x + pen, y]));
    }
    pen += glyphs[char].advance + LATIN_TRACK;
  }

  return placed;
}

/**
 * Places both stages in the frame, at one scale.
 *
 * One scale, not one width. Scaling each stage to fill the frame would set the
 * jamo line — nine full-width glyphs and their gaps, a good deal wider in em
 * than SEAN PARK is — noticeably smaller, and a stage drawn smaller is a stage
 * drawn lighter. The whole point of this rebuild is that every glyph in the
 * piece is the same typeface at the same weight and the same size, so the
 * scale is taken from whichever stage is wider and both get it.
 *
 * They share a baseline, too, rather than each being centred on its own ink.
 * Both were set with the baseline at y = 0, so keeping that is free, and it is
 * what a typesetter would do: SEAN PARK's caps stand on the line the jamo
 * stand on.
 */
function placeStages(stages) {
  const scale = CONTENT_WIDTH / Math.max(...stages.map((s) => boxOf(s).width));
  const scaled = stages.map((s) => mapContours(s, (x, y) => [x * scale, y * scale]));

  const union = boxOf(scaled.flat());
  const frame = {
    width: CONTENT_WIDTH + PAD.x * 2,
    height: union.height + PAD.y * 2,
  };
  const dy = frame.height / 2 - (union.y1 + union.y2) / 2;

  return {
    frame,
    stages: scaled.map((s) => {
      const box = boxOf(s);
      const dx = frame.width / 2 - (box.x1 + box.x2) / 2;
      return mapContours(s, (x, y) => [x + dx, y + dy]);
    }),
  };
}

function writeMorphs() {
  const glyphs = readGlyphs();

  const jamoParts = jamoLine(glyphs);
  const latinRaw = latinLine(glyphs);

  // The frame is derived, not chosen: the content width plus air, and whatever
  // height the two stages together need. Deriving it here keeps one source of
  // truth — the runtime reads it off the module rather than holding a copy
  // that can drift out of step with the geometry.
  const { frame, stages } = placeStages([jamoParts.flat(), latinRaw]);
  const [jamo, latin] = stages;

  // Placing flattens, so hand the contours back to the part they came from.
  const parts = [];
  let cursor = 0;
  for (const [index, part] of JAMO.entries()) {
    const count = jamoParts[index].length;
    parts.push({ ...part, contours: jamo.slice(cursor, cursor + count) });
    cursor += count;
  }

  // --- Resample -------------------------------------------------------------
  for (const part of parts) {
    part.contours = part.contours.map((contour) => resample(contour, MORPH_N));
  }
  const targets = latin.map((contour) => resample(contour, MORPH_N));

  // --- Match ----------------------------------------------------------------
  //
  // Twenty contours become eleven. The nine with no counterpart collapse to a
  // point inside themselves and stop having area, which is the lossy half of
  // the transliteration said in geometry rather than in a caption: 박상현
  // carries more than SEAN PARK keeps.
  //
  // Assigned left to right and never crossing. A greedy nearest-match lets a
  // contour travel the whole width to find a partner, and the result reads as
  // a shuffle rather than as one name becoming another.
  //
  // Winding is handled separately, because it is not decoration: an outline and
  // a counter run opposite ways, and pairing one with the other turns a hole
  // inside out mid-morph. The two scripts differ here — the jamo carry three
  // true counters, in ㅂ, ㅇ and ㅎ, while Pretendard's Latin caps cut theirs as
  // hairline slits in a single contour — so all three Korean counters are among
  // the ones that collapse, and they close as the name resolves.
  const sources = [];
  parts.forEach((part, pi) => {
    part.contours.forEach((contour, ci) => sources.push({ pi, ci, contour }));
  });

  const assigned = new Map();
  for (const sign of [1, -1]) {
    const from = sources
      .filter((source) => Math.sign(signedArea(source.contour)) === sign)
      .sort((a, b) => centroidOf(a.contour)[0] - centroidOf(b.contour)[0]);
    const to = targets
      .map((contour, ti) => ({ contour, ti }))
      .filter((target) => Math.sign(signedArea(target.contour)) === sign)
      .sort((a, b) => centroidOf(a.contour)[0] - centroidOf(b.contour)[0]);

    if (to.length > from.length) {
      throw new Error(`${to.length} Latin contours of winding ${sign} against ${from.length} jamo`);
    }

    // Spread the survivors evenly through the sources rather than taking the
    // first n, so the ones that collapse are distributed across the name
    // instead of all coming from one syllable.
    to.forEach((target, i) => {
      const pick =
        to.length === 1
          ? Math.floor(from.length / 2)
          : Math.round((i * (from.length - 1)) / (to.length - 1));
      assigned.set(`${from[pick].pi}:${from[pick].ci}`, target.ti);
    });
  }

  if (new Set(assigned.values()).size !== targets.length) {
    throw new Error(
      `only ${new Set(assigned.values()).size} of ${targets.length} Latin contours found a jamo`,
    );
  }

  for (const [pi, part] of parts.entries()) {
    part.latin = part.contours.map((contour, ci) => {
      const ti = assigned.get(`${pi}:${ci}`);
      if (ti === undefined) {
        // No counterpart: collapse to a point inside itself, so it shrinks away
        // rather than sliding off somewhere.
        const [cx, cy] = centroidOf(contour);
        return contour.map(() => [cx, cy]);
      }
      return alignRotation(contour, targets[ti]);
    });
  }

  // --- Seed -----------------------------------------------------------------
  //
  // The animation opens on a circle, and the circle is ㅇ.
  //
  // 상 has one, so the name already contains a perfect circle — it does not
  // have to be invented, and it does not have to arrive from anywhere. Every
  // one of the twenty contours starts as a copy of ㅇ's own ring, at ㅇ's own
  // place and size, so the first frame is a single small disc and ㅇ is the one
  // piece that never moves. Everything else unfurls out of it.
  //
  // A disc rather than a ring, incidentally, and by arithmetic rather than by
  // choice: seventeen copies wound one way and three the other leave a nonzero
  // winding everywhere inside, so the coincident stack fills. The ring only
  // appears once ㅇ's counter separates from its outline.
  const circle = parts
    .find((part) => part.char === "ㅇ")
    .contours.reduce((a, b) => (Math.abs(signedArea(b)) > Math.abs(signedArea(a)) ? b : a));
  const reversed = [...circle].reverse();

  for (const part of parts) {
    // Rotated to line up with the contour it becomes. Twenty differently
    // rotated copies of a circle are still one circle on screen, and without
    // the alignment every piece would corkscrew as it opened.
    part.seed = part.contours.map((contour) =>
      alignRotation(contour, signedArea(contour) < 0 ? reversed : circle),
    );
  }

  // --- Emit -----------------------------------------------------------------
  // Five places, not four. A slit is on the order of a thousandth of the frame
  // wide, and rounding its two sides onto each other closes the counter it cuts.
  const flat = (contours) => contours.flat(2).map((n) => +n.toFixed(5));

  const serialised = parts
    .map(
      (part) =>
        `  {\n` +
        `    char: ${JSON.stringify(part.char)},\n` +
        `    kind: ${JSON.stringify(part.kind)},\n` +
        `    contours: ${part.contours.length},\n` +
        `    seed: [${flat(part.seed).join(",")}],\n` +
        `    jamo: [${flat(part.contours).join(",")}],\n` +
        `    latin: [${flat(part.latin).join(",")}],\n` +
        `  },`,
    )
    .join("\n");

  const module = `/**
 * The loader's letterforms. Generated by scripts/build-loader.mjs — do not edit
 * by hand; re-run the script.
 *
 * Each entry is one jamo of 박상현, in the three states it passes through:
 * a copy of ㅇ's circle, itself set in the line, and the share of SEAN PARK it
 * becomes. All three hold the same number of points in the same order, laid out
 * as x, y pairs, ${MORPH_N} points per contour — so interpolating them is a
 * straight lerp and the result is a valid outline at every step.
 *
 * Coordinates are frame units: the same space \`FRAME\` describes, shared by all
 * three states. They have to be, because the whole run is drawn as a single
 * path holding all ${sources.length} contours at once — a letter's counter only punches a
 * hole when it shares a path with its outline — and one path can carry no
 * per-glyph transform.
 *
 * Set in Pretendard Variable at weight ${WEIGHT}, one weight and one scale for
 * every glyph.
 */

export interface Morph {
  char: string;
  kind: "consonant" | "vowel";
  contours: number;
  /** A copy of ㅇ's ring, where ㅇ sits. Every piece starts here. */
  seed: number[];
  /** The jamo, set in the line. */
  jamo: number[];
  /** Where it goes in SEAN PARK, or collapsed to a point if it goes nowhere. */
  latin: number[];
}

/** The viewBox both stages are laid out inside, at rest. */
export const FRAME = { width: ${frame.width.toFixed(4)}, height: ${frame.height.toFixed(4)} };

/** Points per contour. */
export const MORPH_POINTS = ${MORPH_N};

export const MORPHS: Morph[] = [
${serialised}
];
`;

  fs.writeFileSync("src/loader/morphs.ts", module);

  const kept = new Set(assigned.values()).size;
  process.stderr.write(
    `wrote src/loader/morphs.ts — ${parts.length} jamo, ${sources.length} contours,` +
      ` ${kept} kept and ${sources.length - kept} collapsed,` +
      ` frame ${frame.width.toFixed(2)}×${frame.height.toFixed(2)},` +
      ` ${(fs.statSync("src/loader/morphs.ts").size / 1024).toFixed(1)} KB\n`,
  );
}

// Everything above is declaration; run last so nothing is touched before it
// has been initialised.
main();
