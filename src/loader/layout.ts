/**
 * How a Korean syllable is put together.
 *
 * This is the whole idea of the loader, so it is worth being exact about it.
 * Hangul is an assembly system: a syllable is not a character that happens to
 * look busy, it is a *block* built from two or three jamo placed in fixed
 * regions of a square. 박 is ㅂ over ㄱ with ㅏ down the right-hand side.
 * Nothing else in common use works this way, and "loading" is assembly — which
 * is why the animation builds the name the way the writing system does rather
 * than sliding some letters around.
 *
 * All coordinates are in block units: one block is 1 × 1, with the origin at
 * its top-left and y running down, as in SVG.
 *
 * The cell table itself lives in `scripts/build-loader.mjs`, because that is
 * what consumes it: every jamo is fitted to its cell once, at build time, and
 * baked into `morphs.ts` in frame coordinates. Nothing here needs to place a
 * glyph at runtime.
 */

export type Role = "initial" | "vowel" | "final";

export interface Part {
  char: string;
  role: Role;
  /** 박 = 0, 상 = 1, 현 = 2. */
  syllable: number;
  /** Where it flies in from, as a translation applied before its own shape. */
  approach: { x: number; y: number };
}

/** 박상현, decomposed. */
const PARTS: Array<{ char: string; role: Role; syllable: number }> = [
  { char: "ㅂ", role: "initial", syllable: 0 },
  { char: "ㅏ", role: "vowel", syllable: 0 },
  { char: "ㄱ", role: "final", syllable: 0 },
  { char: "ㅅ", role: "initial", syllable: 1 },
  { char: "ㅏ", role: "vowel", syllable: 1 },
  { char: "ㅇ", role: "final", syllable: 1 },
  { char: "ㅎ", role: "initial", syllable: 2 },
  { char: "ㅕ", role: "vowel", syllable: 2 },
  { char: "ㄴ", role: "final", syllable: 2 },
];

export const SYLLABLES = [..."박상현"];

/** Block pitch, and the gap between blocks. */
export const BLOCK = { size: 1, gap: 0.14 };

export const TOTAL_WIDTH = 3 * BLOCK.size + 2 * BLOCK.gap;

export function blockX(index: number): number {
  return index * (BLOCK.size + BLOCK.gap);
}

/**
 * The nine parts, placed.
 *
 * Each arrives from outside the block along the axis its role occupies —
 * initials from the left, vowels from the right, finals from below. The
 * approach direction is what makes the assembly read as construction rather
 * than as nine things converging on a point.
 */
export function buildParts(): Part[] {
  const approaches: Record<Role, { x: number; y: number }> = {
    initial: { x: -0.55, y: -0.12 },
    vowel: { x: 0.6, y: 0 },
    final: { x: 0, y: 0.55 },
  };

  return PARTS.map((part) => ({ ...part, approach: approaches[part.role] }));
}

/**
 * Order the parts lock in: finals, then initials, then vowels.
 *
 * A real construction order rather than reading order — the bottom tier of
 * every block settles before the tier above it, which is what makes three
 * blocks look like they are being built rather than typed.
 */
export const LOCK_ORDER = [2, 5, 8, 0, 3, 6, 1, 4, 7];
