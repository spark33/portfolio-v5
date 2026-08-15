#!/usr/bin/env node
/**
 * Bakes the loader's letterforms out of Pretendard Variable.
 *
 *   npm run build:loader
 *
 * The animation turns nine jamo into three syllables and then into SEAN PARK
 * as one continuous chain of the same twenty outlines. Nothing about that is
 * possible with live text: it needs every contour of one form paired with a
 * contour of the next, resampled to a shared point count and rotation-aligned
 * so a straight lerp between them is a valid outline at every step. That
 * matching is what this script does, once, so the runtime only interpolates.
 *
 * Emits src/loader/morphs.ts. No font ships — the outlines are the asset.
 */
import fs from "node:fs";

import opentype from "opentype.js";

const SOURCE = "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf";

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`${SOURCE} is missing — run npm install`);
  }

  writeMorphs();
}

// ---------------------------------------------------------------------------
// Morph pairs
// ---------------------------------------------------------------------------

/**
 * Points per contour after resampling. Every contour in a morph pair has
 * exactly this many, which is what makes interpolating them possible at all.
 */
const MORPH_N = 64;

/** Chordal tolerance for flattening, in font units at a 1000-unit em. */
const FLAT_TOLERANCE = 0.3;

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

/** A glyph's contours as closed polylines, in em, y-down as SVG wants. */
function contoursOf(font, char) {
  const path = font.charToGlyph(char).getPath(0, 0, 1);
  const out = [];
  let current = null;
  let cursor = null;

  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        if (current && current.length > 2) out.push(current);
        cursor = [cmd.x, cmd.y];
        current = [cursor];
        break;
      case "L":
        cursor = [cmd.x, cmd.y];
        current.push(cursor);
        break;
      case "Q":
        flattenQuadratic(cursor, [cmd.x1, cmd.y1], [cmd.x, cmd.y], current);
        cursor = [cmd.x, cmd.y];
        break;
      case "C":
        flattenCubic(cursor, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y], current);
        cursor = [cmd.x, cmd.y];
        break;
      case "Z":
        if (current && current.length > 2) out.push(current);
        current = null;
        break;
      default:
        throw new Error(`unhandled command ${cmd.type}`);
    }
  }
  if (current && current.length > 2) out.push(current);

  return out.map((points) => {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) < 1e-9) points.pop();
    return points;
  });
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

/**
 * Emits, per jamo, the matched point sets that morph it into its share of the
 * composed syllable.
 *
 * This works because the contour counts line up exactly: 박 has five contours
 * and its jamo have 2 + 2 + 1; 상 has six and 2 + 2 + 2; 현 has nine and
 * 4 + 3 + 2. The font redraws each jamo for its position in the block but
 * keeps the structure, so every contour of a syllable has exactly one
 * counterpart among its parts. There is no topology change to absorb — no
 * contour has to appear from nowhere or collapse to a point — which is what
 * makes this a clean 1:1 morph rather than an approximation.
 */
function writeMorphs() {
  const font = opentype.parse(fs.readFileSync(SOURCE).buffer);
  font.variation.set({ wght: 300 });

  const blocks = [
    { syllable: "박", jamo: ["ㅂ", "ㅏ", "ㄱ"] },
    { syllable: "상", jamo: ["ㅅ", "ㅏ", "ㅇ"] },
    { syllable: "현", jamo: ["ㅎ", "ㅕ", "ㄴ"] },
  ];

  const entries = [];

  // Bounding boxes come back in font units; the outlines come back in em,
  // because getPath was asked for font-size 1. Mixing the two puts every point
  // about two thousand times too far out and nothing renders at all.
  const em = font.unitsPerEm;
  const inkOfEm = (char) => {
    const box = font.charToGlyph(char).getBoundingBox();
    return { x1: box.x1 / em, y1: box.y1 / em, x2: box.x2 / em, y2: box.y2 / em };
  };

  for (const [blockIndex, block] of blocks.entries()) {
    /**
     * Everything is emitted in *frame* coordinates, not block-local ones.
     *
     * The runtime concatenates all twenty contours into one path for the final
     * morph — it has to, because a letter's counter only punches a hole when it
     * shares a path with its outline — and that path can carry no per-block
     * transform. Emitted block-local, the three syllables landed on top of one
     * another the instant that path took over.
     *
     * It also fixes the Latin assignment, which sorts contours by x to keep the
     * mapping monotonic: block-local, ㅂ from 박 and ㅎ from 현 both sat at
     * x ≈ 0.2 and the sort interleaved the three blocks.
     */
    const dx = blockIndex * (1 + BLOCK_GAP);
    const place = ([x, y]) => [x + dx, y];

    // The syllable's contours, fitted into the same box the assembled parts
    // occupy, so the morph is a change of shape and not also of scale.
    const syllableInk = inkOfEm(block.syllable);
    const target = contoursOf(font, block.syllable).map((points) =>
      resample(points, MORPH_N).map(([x, y]) => place(fitPoint(x, y, syllableInk, ASSEMBLED_BOX))),
    );

    // Each jamo's contours, already at their cell.
    const sources = block.jamo.map((char) => {
      const ink = inkOfEm(char);
      const cell = CELL_TABLE[roleOf(block.jamo, char)];
      return {
        char,
        contours: contoursOf(font, char).map((points) =>
          resample(points, MORPH_N).map(([x, y]) => place(fitPointUniform(x, y, ink, cell))),
        ),
      };
    });

    // Pair every source contour with a target contour: nearest centroids
    // first, and only where the winding agrees. Winding is not decoration —
    // it is which side is solid — so pairing an outline with a counter would
    // turn a hole inside out mid-morph.
    const candidates = [];
    sources.forEach((source, si) => {
      source.contours.forEach((sc, ci) => {
        const sCentre = centroidOf(sc);
        const sSign = Math.sign(signedArea(sc));
        target.forEach((tc, ti) => {
          if (Math.sign(signedArea(tc)) !== sSign) return;
          const tCentre = centroidOf(tc);
          candidates.push({
            si,
            ci,
            ti,
            cost: Math.hypot(sCentre[0] - tCentre[0], sCentre[1] - tCentre[1]),
          });
        });
      });
    });
    candidates.sort((a, b) => a.cost - b.cost);

    const takenTarget = new Set();
    const takenSource = new Set();
    const pairs = [];
    for (const candidate of candidates) {
      const key = `${candidate.si}:${candidate.ci}`;
      if (takenSource.has(key) || takenTarget.has(candidate.ti)) continue;
      takenSource.add(key);
      takenTarget.add(candidate.ti);
      pairs.push(candidate);
    }

    const expected = sources.reduce((sum, s) => sum + s.contours.length, 0);
    if (pairs.length !== expected || pairs.length !== target.length) {
      throw new Error(
        `${block.syllable}: matched ${pairs.length} of ${expected} contours against ${target.length}`,
      );
    }

    sources.forEach((source, si) => {
      const from = [];
      const to = [];
      source.contours.forEach((sc, ci) => {
        const pair = pairs.find((p) => p.si === si && p.ci === ci);
        const aligned = alignRotation(sc, target[pair.ti]);
        from.push(sc);
        to.push(aligned);
      });

      entries.push({
        char: source.char,
        syllable: block.syllable,
        from,
        to,
        contours: from.length,
      });
    });
  }

  // --- and on into SEAN PARK ------------------------------------------------
  //
  // Twenty contours become twelve. The eight with no counterpart collapse to a
  // point inside themselves and simply stop having area — which in 2D is the
  // whole of it. This is the step the 3D attempt could never land: there, a
  // collapsed contour turned an extruded cap into a fan and folded it outside
  // the letterform. Here there is no cap. It is also the lossy half of the
  // transliteration said in geometry rather than in a caption: 박상현 carries
  // more than SEAN PARK keeps.
  const latin = latinContours(font);

  const sourceContours = [];
  for (const [ei, entry] of entries.entries()) {
    entry.to.forEach((contour, ci) => sourceContours.push({ ei, ci, contour }));
  }

  // Assigned left to right, never crossing.
  //
  // A greedy nearest-match let contours travel the whole width to find a
  // partner — ㅎ from 현, on the right, ended up as part of a letter on the
  // far left — and the result reads as a shuffle rather than as one name
  // becoming another. Sorting both sides by x and walking them in step makes
  // the mapping monotonic: whatever is on the left stays on the left.
  //
  // Winding is handled separately, because it is not decoration: an outline
  // and a counter run opposite ways, and pairing one with the other turns a
  // hole inside out mid-morph.
  const assigned = new Map();

  for (const sign of [1, -1]) {
    const sources = sourceContours
      .filter((source) => Math.sign(signedArea(source.contour)) === sign)
      .sort((a, b) => centroidOf(a.contour)[0] - centroidOf(b.contour)[0]);

    const targets = latin
      .map((contour, ti) => ({ contour, ti }))
      .filter((target) => Math.sign(signedArea(target.contour)) === sign)
      .sort((a, b) => centroidOf(a.contour)[0] - centroidOf(b.contour)[0]);

    if (targets.length > sources.length) {
      throw new Error(
        `${targets.length} Latin contours of winding ${sign} against ${sources.length} sources`,
      );
    }

    // Spread the survivors evenly through the sources rather than taking the
    // first n, so the ones that collapse are distributed across the name
    // instead of all coming from one syllable.
    targets.forEach((target, i) => {
      const pick =
        targets.length === 1
          ? Math.floor(sources.length / 2)
          : Math.round((i * (sources.length - 1)) / (targets.length - 1));
      const source = sources[pick];
      assigned.set(`${source.ei}:${source.ci}`, target.ti);
    });
  }

  if (new Set(assigned.values()).size !== latin.length) {
    throw new Error(
      `only ${new Set(assigned.values()).size} of ${latin.length} Latin contours found a source`,
    );
  }

  for (const [ei, entry] of entries.entries()) {
    entry.latin = entry.to.map((contour, ci) => {
      const ti = assigned.get(`${ei}:${ci}`);
      if (ti === undefined) {
        // No counterpart: collapse to a point inside itself, so it shrinks
        // away rather than sliding off somewhere.
        const [cx, cy] = centroidOf(contour);
        return contour.map(() => [cx, cy]);
      }
      return alignRotation(contour, latin[ti]);
    });
  }

  for (const entry of entries) {
    entry.from = entry.from.flat(2).map((n) => +n.toFixed(4));
    entry.to = entry.to.flat(2).map((n) => +n.toFixed(4));
    entry.latin = entry.latin.flat(2).map((n) => +n.toFixed(4));
  }

  const serialised = entries
    .map(
      (entry) =>
        `  {\n` +
        `    char: ${JSON.stringify(entry.char)},\n` +
        `    syllable: ${JSON.stringify(entry.syllable)},\n` +
        `    contours: ${entry.contours},\n` +
        `    from: [${entry.from.join(",")}],\n` +
        `    to: [${entry.to.join(",")}],\n` +
        `    latin: [${entry.latin.join(",")}],\n` +
        `  },`,
    )
    .join("\n");

  const module = `/**
 * Morph pairs for the loader. Generated by scripts/build-loader.mjs — do not
 * edit by hand; re-run the script.
 *
 * Each entry is one jamo and the share of its composed syllable it becomes.
 * \`from\` and \`to\` hold the same number of points in the same order, laid out
 * as x, y pairs, ${MORPH_N} points per contour — so interpolating them is a
 * straight lerp and the result is a valid outline at every step.
 *
 * Coordinates are in block units, already placed: no transform is applied at
 * runtime beyond the block's own offset.
 */

export interface MorphPair {
  char: string;
  syllable: string;
  contours: number;
  /** The jamo, at its cell. */
  from: number[];
  /** Its share of the composed syllable. */
  to: number[];
  /** Where it goes in SEAN PARK, or collapsed to a point if it goes nowhere. */
  latin: number[];
}

/** Points per contour. */
export const MORPH_POINTS = ${MORPH_N};

export const MORPHS: MorphPair[] = [
${serialised}
];
`;

  fs.writeFileSync("src/loader/morphs.ts", module);

  const contours = entries.reduce((sum, entry) => sum + entry.contours, 0);
  process.stderr.write(
    `wrote src/loader/morphs.ts — ${entries.length} parts, ${contours} contours,` +
      ` ${MORPH_N} points each, ${(fs.statSync("src/loader/morphs.ts").size / 1024).toFixed(1)} KB\n`,
  );
}

/**
 * SEAN PARK's contours, typeset across the same width the blocks span.
 *
 * Same coordinate space as everything else, so the final morph is a change of
 * shape and nothing more — no transform, no reframe.
 */
function latinContours(font) {
  const em = font.unitsPerEm;
  const text = "SEAN PARK";
  const tracking = -0.012;

  // Measured at size 1 first, then scaled to fit. Set at a fixed size the run
  // came out wider than the three blocks it has to land inside, so it
  // overflowed the frame and the letters stacked on top of one another.
  let natural = 0;
  const advances = [...text].map((char) => {
    const advance = font.charToGlyph(char).advanceWidth / em;
    natural += advance + (char === " " ? 0 : tracking);
    return advance;
  });

  const size = (TOTAL_BLOCK_WIDTH * 0.96) / natural;
  const width = natural * size;
  const shift = (TOTAL_BLOCK_WIDTH - width) / 2;
  // Baseline placed so the cap height sits on the block's optical centre.
  const baseline = 0.82;

  const out = [];
  let pen = 0;
  [...text].forEach((char, index) => {
    if (char !== " ") {
      for (const contour of contoursOf(font, char)) {
        out.push(
          resample(contour, MORPH_N).map(([px, py]) => [
            shift + pen + px * size,
            baseline + py * size,
          ]),
        );
      }
    }
    pen += (advances[index] + (char === " " ? 0 : tracking)) * size;
  });

  return out;
}

/** Kept in step with src/loader/layout.ts. */
const BLOCK_GAP = 0.14;
const TOTAL_BLOCK_WIDTH = 3 * 1 + 2 * BLOCK_GAP;

/**
 * The regions of the square, for an initial + vertical vowel + final.
 *
 * The substance of the whole piece, and the one table worth reading if the
 * block proportions ever look wrong. Hangul is an assembly system: a syllable
 * is not a character that happens to look busy, it is a *block* built from two
 * or three jamo placed in fixed regions of a square. 박 is ㅂ over ㄱ with ㅏ
 * down the right-hand side.
 *
 * All three syllables of 박상현 share this structure, so one set of cells
 * covers the name. The proportions that matter: the vowel takes the right ~40%
 * and runs nearly the full height, because a vertical vowel is the tallest
 * thing in a block; it stops short of the bottom because the final sits under
 * the *whole* block rather than under the initial alone.
 *
 * In block units — one block is 1 × 1, origin top-left, y down as in SVG.
 */
const CELL_TABLE = {
  initial: { x: 0.05, y: 0.05, width: 0.47, height: 0.53 },
  vowel: { x: 0.58, y: 0.02, width: 0.37, height: 0.62 },
  final: { x: 0.09, y: 0.66, width: 0.78, height: 0.31 },
};

/** The box the assembled parts collectively occupy. */
const ASSEMBLED_BOX = { x: 0.05, y: 0.02, width: 0.9, height: 0.95 };

function roleOf(jamo, char) {
  return ["initial", "vowel", "final"][jamo.indexOf(char)];
}

/** Maps a y-down point through a non-uniform fit of `ink` into `box`. */
function fitPoint(x, y, ink, box) {
  const scaleX = box.width / (ink.x2 - ink.x1);
  const scaleY = box.height / (ink.y2 - ink.y1);
  return [box.x + (x - ink.x1) * scaleX, box.y + (y + ink.y2) * scaleY];
}

/**
 * Maps a y-down point through a uniform, centred fit of `ink` into `cell`.
 *
 * Uniform is the point. Stretching each jamo to fill its cell is what a real
 * Korean typeface does — it redraws the form for the position — but doing it by
 * scaling one drawing gives anisotropic strokes: ㄱ squashed into a wide flat
 * cell comes out with hairline horizontals and heavy verticals, and reads as
 * clunky no matter how well it is animated. A uniform scale keeps every stroke
 * the weight it was drawn at, at the cost of the parts sitting a little smaller
 * than the block they build. They read as parts, which is what they are.
 */
function fitPointUniform(x, y, ink, cell) {
  const inkWidth = ink.x2 - ink.x1;
  const inkHeight = ink.y2 - ink.y1;
  const scale = Math.min(cell.width / inkWidth, cell.height / inkHeight);
  const offsetX = cell.x + (cell.width - inkWidth * scale) / 2;
  const offsetY = cell.y + (cell.height - inkHeight * scale) / 2;
  return [offsetX + (x - ink.x1) * scale, offsetY + (y + ink.y2) * scale];
}

// Everything above is declaration; run last so nothing is touched before it
// has been initialised.
main();
