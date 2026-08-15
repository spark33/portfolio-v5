import { ATLAS, GLYPHS } from "./glyphs.ts";
import type { BakedGlyph } from "./glyphs.ts";

/**
 * Layout for 박상현 → "Sean Park".
 *
 * Nothing here builds geometry. Each glyph is one tile of a signed-distance
 * atlas, and this module works out the rectangle in design space that each
 * tile is sampled through — in the composed Hangul state and again in the
 * resolved Latin one. The hero animates between the two and lets the field
 * decide what the shape does in between.
 *
 * Hangul block layout is positional, not metric: a jamo's place in the square
 * comes from its role and the vowel's orientation, and none of it is
 * recoverable from font metrics. So the cells are hardcoded and tuned by eye.
 * All three syllables here share one structure — initial, *vertical* vowel,
 * final — so one set of cells covers the name. A horizontal-vowel syllable
 * (고, 문) would need a second set, and there is none in this name.
 */

export { ATLAS } from "./glyphs.ts";

function glyph(char: string): BakedGlyph {
  const found = GLYPHS[char];
  if (!found) throw new Error(`glyph ${char} was not baked — see scripts/bake-glyphs.mjs`);
  return found;
}

// ---------------------------------------------------------------------------
// Rectangles
// ---------------------------------------------------------------------------

/**
 * The region of design space one atlas tile is sampled through.
 *
 * A tile is bigger than the glyph inside it: the outline was stretched to fill
 * only `ATLAS.ink` of the tile, and the rest is the margin the distance field
 * falls off into. So a rect that should show a glyph at a given ink size has
 * to be that size divided by `ink` — otherwise the field is clipped exactly
 * where the fills and the smooth-union need it most.
 */
export interface Rect {
  cx: number;
  cy: number;
  /** Half-width and half-height of the *tile*, not of the ink. */
  hx: number;
  hy: number;
}

function rectFromInk(x: number, y: number, width: number, height: number): Rect {
  return {
    cx: x + width / 2,
    cy: y + height / 2,
    hx: width / 2 / ATLAS.ink,
    hy: height / 2 / ATLAS.ink,
  };
}

// ---------------------------------------------------------------------------
// The name
// ---------------------------------------------------------------------------

export type Role = "initial" | "vowel" | "final";

/** World size of one syllable block, and the gap between blocks. */
const BLOCK = { size: 1, gap: 0.06 };

/**
 * Cells for an initial + vertical-vowel + final block, in block-local units:
 * (0,0) bottom-left, (1,1) top-right.
 *
 * - The vowel takes the right ~40% and runs nearly the full height, because a
 *   vertical vowel is the tallest thing in the block.
 * - It stops short of the bottom, at y = 0.36, because the final sits under
 *   the *whole* block rather than under the initial alone. Letting the vowel
 *   run to y = 0 is the most common way a synthesised block looks wrong.
 * - The final spans most of the width and is squat, which is what makes the
 *   block read as three tiers rather than two.
 */
const CELLS: Record<Role, { x: number; y: number; width: number; height: number }> = {
  initial: { x: 0.05, y: 0.42, width: 0.47, height: 0.53 },
  vowel: { x: 0.58, y: 0.36, width: 0.37, height: 0.62 },
  final: { x: 0.09, y: 0.03, width: 0.78, height: 0.31 },
};

export interface Jamo {
  /** Compatibility Jamo codepoint, U+3131–U+3163. */
  char: string;
  role: Role;
  /** 박 = 0, 상 = 1, 현 = 2. */
  syllable: number;
  /** Index into LATIN of the letter it becomes, or -1 if it fuses instead. */
  target: number;
}

/**
 * 박상현, decomposed. Nine jamo, each its own field — the composed syllable is
 * never a single glyph at any point in the sequence.
 *
 *   박 = ㅂ ㅏ ㄱ      상 = ㅅ ㅏ ㅇ      현 = ㅎ ㅕ ㄴ
 */
export const JAMO: readonly Jamo[] = [
  { char: "ㅂ", role: "initial", syllable: 0, target: 4 }, // → P
  { char: "ㅏ", role: "vowel", syllable: 0, target: 5 }, //   → a
  { char: "ㄱ", role: "final", syllable: 0, target: 6 }, //   → r
  { char: "ㅅ", role: "initial", syllable: 1, target: 0 }, // → S
  { char: "ㅏ", role: "vowel", syllable: 1, target: 2 }, //   → a
  { char: "ㅇ", role: "final", syllable: 1, target: -1 }, //  → fuses, see MERGE
  { char: "ㅎ", role: "initial", syllable: 2, target: 7 }, // → k
  { char: "ㅕ", role: "vowel", syllable: 2, target: 1 }, //   → e
  { char: "ㄴ", role: "final", syllable: 2, target: 3 }, //   → n
];

/** "Sean Park" — eight letters against nine jamo. */
export const LATIN = [..."SeanPark"] as const;

/**
 * The 9th jamo.
 *
 * Nine into eight does not divide, and faking a 1:1 map would be worse than
 * admitting the mismatch. ㅇ is the one that fuses, and the choice is not
 * arbitrary on either side of it:
 *
 * - Semantically, ㅏ and ㅇ are the vowel and final of 상 — together the "ang"
 *   of Sang-hyun, which "Sean" spells with a single "a". Two jamo collapsing
 *   into one letter is what actually happened to the name.
 * - Visually, ㅇ is a closed ring and "a" is a closed bowl. The ring settles
 *   into the counter and stays there as the one detail that remembers the
 *   Korean — it does not disappear, and it is not a ninth letter either.
 *
 * Because the field is a smooth union, this needs no special handling to look
 * physical: as the ring closes on the letter the two surfaces neck together
 * and become one mass. That is the merge, and it is the same operator holding
 * every other part of the mark together.
 */
export const MERGE = {
  /** Index into JAMO. */
  jamo: 5,
  /** Index into LATIN — the "a" of "Sean". */
  into: 2,
  /** Where in the transit it starts closing, as a fraction of the whole. */
  start: 0.62,
  /** Ink size of the settled ring, relative to the letter's height. */
  settledScale: 0.34,
  /** How far below the letter's centre the counter sits. */
  bowlDrop: 0.24,
} as const;

// ---------------------------------------------------------------------------
// Latin line
// ---------------------------------------------------------------------------

/** Chosen so "Sean Park" is close in width to 박상현 — the two states should
 *  read as one object seen twice, not as a zoom. */
const LATIN_SCALE = 0.74;

/** Word space between "Sean" and "Park", in ems, and where it falls. */
const WORD_SPACE = 0.3;
const SPACE_AFTER = 3;

// ---------------------------------------------------------------------------
// Built layout
// ---------------------------------------------------------------------------

export interface Pair {
  /** Atlas tile of the jamo. */
  from: number;
  /** Atlas tile of the Latin letter, or the jamo's own tile if it fuses. */
  to: number;
  /** True for the jamo that fuses rather than resolving into a letter. */
  fuses: boolean;
  composed: Rect;
  resolved: Rect;
}

export interface Layout {
  pairs: Pair[];
  /** Design-space extent of composed 박상현: width, height. */
  composedSize: [number, number];
  /** Design-space extent of resolved "Sean Park". */
  resolvedSize: [number, number];
}

export function buildLayout(): Layout {
  const count = 3;
  const pitch = BLOCK.size + BLOCK.gap;
  const totalWidth = count * BLOCK.size + (count - 1) * BLOCK.gap;
  const originX = (index: number) => -totalWidth / 2 + index * pitch;
  const originY = -BLOCK.size / 2;

  // --- Resolved "Sean Park", set from real advance widths ------------------
  let pen = 0;
  const latinInk = LATIN.map((char) => {
    const meta = glyph(char);
    const [x1, y1, x2, y2] = meta.bbox;
    const ink = {
      x: pen + x1 * LATIN_SCALE,
      y: y1 * LATIN_SCALE,
      width: (x2 - x1) * LATIN_SCALE,
      height: (y2 - y1) * LATIN_SCALE,
      tile: meta.tile,
    };
    pen += meta.advanceWidth * LATIN_SCALE;
    return ink;
  });
  // Advance past the word space only after the letter that precedes it, so the
  // space lands between the words rather than inside one.
  for (let i = SPACE_AFTER + 1; i < latinInk.length; i++) {
    latinInk[i].x += WORD_SPACE * LATIN_SCALE;
  }
  const runWidth = pen + WORD_SPACE * LATIN_SCALE;

  // Centre the run on both axes: horizontally on its advance width, vertically
  // on its ink, so the line sits where the blocks were rather than on the
  // baseline.
  const top = Math.max(...latinInk.map((g) => g.y + g.height));
  const bottom = Math.min(...latinInk.map((g) => g.y));
  const shiftX = -runWidth / 2;
  const shiftY = -(top + bottom) / 2;
  for (const ink of latinInk) {
    ink.x += shiftX;
    ink.y += shiftY;
  }

  // --- Pairs ---------------------------------------------------------------
  const pairs: Pair[] = JAMO.map((entry) => {
    const cell = CELLS[entry.role];
    const composed = rectFromInk(
      originX(entry.syllable) + cell.x * BLOCK.size,
      originY + cell.y * BLOCK.size,
      cell.width * BLOCK.size,
      cell.height * BLOCK.size,
    );

    const jamoTile = glyph(entry.char).tile;

    if (entry.target === -1) {
      // The ring settles into the counter of the letter its syllable-mate
      // becomes, at a fraction of that letter's size.
      const host = latinInk[MERGE.into];
      const size = host.height * MERGE.settledScale;
      return {
        from: jamoTile,
        to: jamoTile,
        fuses: true,
        composed,
        resolved: rectFromInk(
          host.x + host.width / 2 - size / 2,
          host.y + host.height / 2 - size / 2 - host.height * MERGE.bowlDrop,
          size,
          size,
        ),
      };
    }

    const ink = latinInk[entry.target];
    return {
      from: jamoTile,
      to: ink.tile,
      fuses: false,
      composed,
      resolved: rectFromInk(ink.x, ink.y, ink.width, ink.height),
    };
  });

  return {
    pairs,
    composedSize: [totalWidth, BLOCK.size],
    resolvedSize: [runWidth, top - bottom],
  };
}
