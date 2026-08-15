#!/usr/bin/env node
/**
 * Bakes glyph outlines for the Hangul hero into JSON, so the figure never
 * parses a font at runtime.
 *
 * The source face is Noto Sans KR Bold (SIL Open Font License 1.1) — the only
 * family in reach that covers both the Hangul Compatibility Jamo block and
 * Latin, which matters because the hero morphs one into the other and a seam
 * between two different designers' letterforms would show.
 *
 * The 6 MB TTF is a build-time input only: it is downloaded to a gitignored
 * cache, read here, and never shipped. What ships is the ~20 KB of contours
 * this writes to src/figures/hangul-hero/glyphs.json, which IS committed.
 *
 *   node scripts/bake-glyphs.mjs
 *
 * Re-run when GLYPHS changes. Output is deterministic, so a no-op re-run
 * leaves the working tree clean.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import opentype from "opentype.js";

// Pinned so a Google Fonts revision cannot silently reshape the hero. Bump it
// deliberately; the diff on glyphs.json is the review.
const FONT_URL =
  "https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf";
const CACHE = path.join("node_modules", ".cache", "hangul-hero", "NotoSansKR-Bold.ttf");
const DIR = path.join("src", "figures", "hangul-hero");
// Emitted as TypeScript rather than JSON so that every consumer agrees on how
// to load it: Vite, `tsc`, and Playwright's plain Node ESM loader all read a
// module the same way, while a bare JSON import needs a different incantation
// in each. It also means the metadata is type-checked rather than cast.
const OUT = path.join(DIR, "glyphs.ts");
const ATLAS = path.join(DIR, "glyphs.sdf.bin");

// --- Signed distance atlas ---------------------------------------------------
// Each glyph gets one square tile holding a signed distance field of its
// outline. The hero renders no geometry at all: it evaluates these fields in a
// fragment shader and smooth-unions them, which is what lets the strokes flow
// into one another instead of sliding past each other as separate solids.

const TILE = 128;
const COLS = 4;
const ROWS = 4;

/**
 * Fraction of the tile the glyph's bounding box is stretched to fill.
 *
 * Stretched, not fitted: every tile holds its glyph normalised to the same
 * square, so morphing between any two is a straight blend of two samples at
 * one uv. The real proportions are carried by the world rectangle each tile is
 * drawn into, and the anisotropy that introduces is absorbed in the shader,
 * which takes its gradient from screen-space derivatives of the *combined*
 * field rather than trusting any single tile to be metric.
 *
 * The remaining 17% margin on each side is what the distance field needs to
 * fall off into.
 */
const INK = 0.66;

/** Distances are clamped to ±SPREAD tile-widths before being encoded to a byte. */
const SPREAD = 0.25;

/** Subdivisions per curve when flattening outlines to segments. */
const CURVE_STEPS = 12;

// Hangul Compatibility Jamo (U+3131–U+3163) plus the Latin target letters.
// Every glyph the figure can ever draw, deduplicated — 박상현 uses ㅏ twice and
// "Sean Park" uses "a" twice.
const GLYPHS = [
  ..."ㅂㅏㄱㅅㅇㅎㅕㄴ", // 박 = ㅂㅏㄱ, 상 = ㅅㅏㅇ, 현 = ㅎㅕㄴ
  ..."SeanPrk", // "Sean Park", minus the repeated "a"
];

/** Font units are integers in a 1000-unit em; 4 decimals of an em is far below
 *  a pixel at any size the hero renders, and keeps the JSON small. */
const PRECISION = 1e4;

function round(n) {
  // `+` drops "-0", which would otherwise churn the diff between runs.
  return +(Math.round(n * PRECISION) / PRECISION).toFixed(4) + 0;
}

function download() {
  if (fs.existsSync(CACHE)) return;
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  process.stderr.write(`fetching ${FONT_URL}\n`);
  // curl rather than fetch() so this works behind the same proxy setup that
  // scripts/fetch-fonts.py already relies on.
  execFileSync("curl", ["-sSfL", "--max-time", "180", "-o", CACHE, FONT_URL], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/**
 * opentype's `glyph.path` is already in y-up font units, which is the same
 * handedness THREE.Shape uses — so the contours transfer without a flip. Only
 * the scale changes, from font units to ems.
 *
 * Commands are kept as commands rather than flattened to polylines: three.js
 * tessellates the curves itself at whatever resolution the geometry asks for,
 * and storing control points instead of sampled points is both smaller and
 * resolution-independent.
 */
function extract(font, char) {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) {
    throw new Error(`${char} (U+${char.codePointAt(0).toString(16)}) is not in the font`);
  }

  const em = font.unitsPerEm;
  const commands = glyph.path.commands.map((c) => {
    const out = { type: c.type };
    // Each command carries a different subset of these; copying only the ones
    // present keeps the JSON free of nulls.
    for (const key of ["x", "y", "x1", "y1", "x2", "y2"]) {
      if (c[key] !== undefined) out[key] = round(c[key] / em);
    }
    return out;
  });

  if (commands.length === 0) {
    throw new Error(`${char} has an empty outline`);
  }

  const b = glyph.getBoundingBox();
  return {
    advanceWidth: round(glyph.advanceWidth / em),
    // [x1, y1, x2, y2] in ems, y-up, baseline at 0. The layout module fits
    // jamo to their cells with this and never has to walk the contours.
    bbox: [b.x1, b.y1, b.x2, b.y2].map((n) => round(n / em)),
    commands,
  };
}

/**
 * Flattens a glyph's outline into line segments in tile space, where the
 * glyph's bounding box has been stretched to the centred INK square.
 */
function flatten(glyph) {
  const [bx1, by1, bx2, by2] = glyph.bbox;
  const sx = INK / (bx2 - bx1);
  const sy = INK / (by2 - by1);
  const ox = (1 - INK) / 2;
  const oy = (1 - INK) / 2;

  // y is flipped here: font units are y-up, and the atlas is written in image
  // order, top row first.
  const map = (x, y) => [(x - bx1) * sx + ox, 1 - ((y - by1) * sy + oy)];

  const segments = [];
  let start = null;
  let cursor = null;

  const line = (to) => {
    if (cursor) segments.push([cursor[0], cursor[1], to[0], to[1]]);
    cursor = to;
  };

  const curve = (from, control, to, control2) => {
    for (let i = 1; i <= CURVE_STEPS; i++) {
      const t = i / CURVE_STEPS;
      const u = 1 - t;
      let x;
      let y;
      if (control2) {
        x = u * u * u * from[0] + 3 * u * u * t * control[0] + 3 * u * t * t * control2[0] + t * t * t * to[0];
        y = u * u * u * from[1] + 3 * u * u * t * control[1] + 3 * u * t * t * control2[1] + t * t * t * to[1];
      } else {
        x = u * u * from[0] + 2 * u * t * control[0] + t * t * to[0];
        y = u * u * from[1] + 2 * u * t * control[1] + t * t * to[1];
      }
      line([x, y]);
    }
  };

  for (const cmd of glyph.commands) {
    switch (cmd.type) {
      case "M":
        // An open contour would leave the winding test with a gap to leak
        // through, so every subpath is closed before the next one starts.
        if (start && cursor) line(start);
        cursor = map(cmd.x, cmd.y);
        start = cursor;
        break;
      case "L":
        line(map(cmd.x, cmd.y));
        break;
      case "Q":
        curve(cursor, map(cmd.x1, cmd.y1), map(cmd.x, cmd.y));
        break;
      case "C":
        curve(cursor, map(cmd.x1, cmd.y1), map(cmd.x, cmd.y), map(cmd.x2, cmd.y2));
        break;
      case "Z":
        if (start) line(start);
        break;
      default:
        throw new Error(`unhandled command ${cmd.type}`);
    }
  }
  if (start && cursor && (cursor[0] !== start[0] || cursor[1] !== start[1])) line(start);

  return segments;
}

/** Shortest distance from a point to a segment. */
function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = px - (x1 + t * dx);
  const cy = py - (y1 + t * dy);
  return Math.sqrt(cx * cx + cy * cy);
}

/**
 * Non-zero winding number, by counting signed crossings of a ray cast in +x.
 *
 * TrueType relies on non-zero winding rather than even-odd, and the two
 * disagree on exactly the glyphs that matter here — the ring of ㅇ and the
 * bowls of a, e and P — so this has to be the non-zero rule.
 */
function windingNumber(px, py, segments) {
  let winding = 0;
  for (const [x1, y1, x2, y2] of segments) {
    if (y1 <= py) {
      if (y2 > py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) > 0) winding++;
    } else if (y2 <= py && (x2 - x1) * (py - y1) - (px - x1) * (y2 - y1) < 0) {
      winding--;
    }
  }
  return winding;
}

/** Rasterises one glyph's signed distance field into a TILE × TILE byte tile. */
function rasterise(glyph) {
  const segments = flatten(glyph);
  const tile = new Uint8Array(TILE * TILE);

  for (let row = 0; row < TILE; row++) {
    const py = (row + 0.5) / TILE;
    for (let col = 0; col < TILE; col++) {
      const px = (col + 0.5) / TILE;

      let nearest = Infinity;
      for (const [x1, y1, x2, y2] of segments) {
        const d = distanceToSegment(px, py, x1, y1, x2, y2);
        if (d < nearest) nearest = d;
      }

      // Negative inside, positive outside — the convention the shader expects.
      const signed = windingNumber(px, py, segments) !== 0 ? -nearest : nearest;
      const clamped = Math.max(-SPREAD, Math.min(SPREAD, signed));
      tile[row * TILE + col] = Math.round(((clamped / SPREAD) * 0.5 + 0.5) * 255);
    }
  }

  return tile;
}

function main() {
  download();

  const font = opentype.parse(fs.readFileSync(CACHE).buffer);
  const glyphs = {};
  for (const char of new Set(GLYPHS)) {
    glyphs[char] = extract(font, char);
  }

  const chars = Object.keys(glyphs);
  if (chars.length > COLS * ROWS) {
    throw new Error(`${chars.length} glyphs will not fit a ${COLS}×${ROWS} atlas`);
  }

  // Rasterise into one interleaved atlas so the shader binds a single texture.
  const atlas = new Uint8Array(TILE * COLS * TILE * ROWS);
  const atlasWidth = TILE * COLS;

  chars.forEach((char, index) => {
    const tile = rasterise(glyphs[char]);
    const col = index % COLS;
    const row = Math.floor(index / COLS);

    for (let y = 0; y < TILE; y++) {
      const destination = (row * TILE + y) * atlasWidth + col * TILE;
      atlas.set(tile.subarray(y * TILE, (y + 1) * TILE), destination);
    }

    glyphs[char].tile = index;
    // Contours are not needed at runtime any more — the field is the artefact.
    // They stay out of the JSON so the payload is metadata only.
    delete glyphs[char].commands;
  });

  fs.writeFileSync(ATLAS, Buffer.from(atlas));

  const entries = chars
    .map((char) => {
      const { advanceWidth, bbox, tile } = glyphs[char];
      return `  "${char}": { advanceWidth: ${advanceWidth}, bbox: [${bbox.join(", ")}], tile: ${tile} },`;
    })
    .join("\n");

  const module = `/**
 * Glyph metadata for the Hangul hero. Generated by scripts/bake-glyphs.mjs —
 * do not edit by hand; re-run the script instead.
 *
 * Source: Noto Sans KR Bold (SIL Open Font License 1.1)
 * ${FONT_URL}
 *
 * The outlines themselves are not here. They are rasterised into signed
 * distance fields in ${path.basename(ATLAS)}, one tile per glyph, and this
 * module only says where each glyph's tile is and how big its ink was. All
 * measurements are in ems, y-up, baseline at 0.
 */

export interface AtlasMeta {
  /** Filename of the distance-field atlas, alongside this module. */
  file: string;
  /** Edge length of one tile, in texels. */
  tile: number;
  cols: number;
  rows: number;
  /** Fraction of a tile the glyph's bounding box was stretched to fill. */
  ink: number;
  /** Tile-widths of distance the encoded byte range spans, ±. */
  spread: number;
}

export interface BakedGlyph {
  advanceWidth: number;
  /** [x1, y1, x2, y2] of the ink, in ems. */
  bbox: [number, number, number, number];
  /** Index of this glyph's tile in the atlas, in row-major order. */
  tile: number;
}

export const ATLAS: AtlasMeta = {
  file: ${JSON.stringify(path.basename(ATLAS))},
  tile: ${TILE},
  cols: ${COLS},
  rows: ${ROWS},
  ink: ${INK},
  spread: ${SPREAD},
};

export const GLYPHS: Record<string, BakedGlyph> = {
${entries}
};
`;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, module);

  const kb = (file) => (fs.statSync(file).size / 1024).toFixed(1);
  process.stderr.write(
    `wrote ${OUT} (${kb(OUT)} KB) and ${ATLAS} (${kb(ATLAS)} KB) — ${chars.length} glyphs\n`,
  );
}

main();
