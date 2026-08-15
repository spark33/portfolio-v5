import { JAMO_INK, JAMO_PATH, SYLLABLE_INK } from "./metrics.ts";

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
 */

export type Role = "initial" | "vowel" | "final";

export interface Cell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The regions of the square, for an initial + vertical vowel + final.
 *
 * All three syllables of 박상현 share this structure, so one set of cells
 * covers the name. The proportions that matter: the vowel takes the right
 * ~40% and runs nearly the full height because a vertical vowel is the tallest
 * thing in a block, and it stops short of the bottom because the final sits
 * under the *whole* block rather than under the initial alone.
 */
export const CELLS: Record<Role, Cell> = {
  initial: { x: 0.05, y: 0.05, width: 0.47, height: 0.53 },
  vowel: { x: 0.58, y: 0.02, width: 0.37, height: 0.62 },
  final: { x: 0.09, y: 0.66, width: 0.78, height: 0.31 },
};

export interface Part {
  char: string;
  role: Role;
  /** 박 = 0, 상 = 1, 현 = 2. */
  syllable: number;
  /** The jamo's outline, as SVG path data. */
  d: string;
  /** SVG transform placing that outline in its cell. */
  transform: string;
  /** Uniform scale applied by that transform, so stroke width can undo it. */
  scale: number;
  /** Where it flies in from, as a translation applied before that. */
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
 * Fits a jamo's ink into a cell.
 *
 * An SVG <text> at font-size 1 with its origin at (0, 0) puts its ink exactly
 * where the font says it is — x1..x2 across, and -y2..-y1 down, since the font
 * measures up from the baseline and SVG measures down. That exactness is why
 * the assembly is drawn in SVG rather than in HTML, where the same placement
 * would depend on line-height and half-leading.
 */
/**
 * Fits a jamo into its cell at a *uniform* scale, centred.
 *
 * Uniform is the whole point. Stretching each jamo to fill its cell is what a
 * real Korean typeface does — it redraws the form for the position — but doing
 * it by scaling one drawing gives anisotropic strokes: ㄱ squashed into a wide
 * flat cell comes out with hairline horizontals and heavy verticals, and reads
 * as clunky no matter how well it is animated. A uniform scale keeps every
 * stroke the weight the designer drew, at the cost of the parts sitting a
 * little smaller than the block they are building. That reads as parts, which
 * is what they are.
 */
function fit(char: string, cell: Cell): { transform: string; scale: number } {
  const ink = JAMO_INK[char];
  if (!ink) throw new Error(`no ink box for ${char} — re-run npm run build:loader`);

  const inkWidth = ink.x2 - ink.x1;
  const inkHeight = ink.y2 - ink.y1;
  const scale = Math.min(cell.width / inkWidth, cell.height / inkHeight);

  const x = cell.x + (cell.width - inkWidth * scale) / 2 - ink.x1 * scale;
  const y = cell.y + (cell.height - inkHeight * scale) / 2 + ink.y2 * scale;

  return {
    transform: `translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(${scale.toFixed(4)})`,
    scale,
  };
}

function fitInk(ink: { x1: number; y1: number; x2: number; y2: number }, cell: Cell): string {
  const scaleX = cell.width / (ink.x2 - ink.x1);
  const scaleY = cell.height / (ink.y2 - ink.y1);

  const x = cell.x - ink.x1 * scaleX;
  const y = cell.y + ink.y2 * scaleY;

  return `translate(${x.toFixed(4)} ${y.toFixed(4)}) scale(${scaleX.toFixed(4)} ${scaleY.toFixed(4)})`;
}

/**
 * The box the assembled parts collectively occupy.
 *
 * The composed syllable is fitted to this rather than set at a nominal size,
 * so the handover from nine parts to one block is a tightening of the same
 * shape in the same place. Set at a nominal size it sits smaller and slightly
 * high, and the crossfade reads as a ghost.
 */
const ASSEMBLED: Cell = { x: 0.05, y: 0.02, width: 0.9, height: 0.95 };

/** Fits a composed syllable into the box its parts filled. */
export function fitSyllable(char: string): string {
  const ink = SYLLABLE_INK[char];
  if (!ink) throw new Error(`no ink box for ${char} — re-run npm run build:loader`);
  return fitInk(ink, ASSEMBLED);
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

  return PARTS.map((part) => {
    const placed = fit(part.char, CELLS[part.role]);
    const d = JAMO_PATH[part.char];
    if (!d) throw new Error(`no outline for ${part.char} — re-run npm run build:loader`);

    return {
      ...part,
      d,
      transform: placed.transform,
      scale: placed.scale,
      approach: approaches[part.role],
    };
  });
}

/**
 * Order the parts lock in: finals, then initials, then vowels.
 *
 * A real construction order rather than reading order — the bottom tier of
 * every block settles before the tier above it, which is what makes three
 * blocks look like they are being built rather than typed.
 */
export const LOCK_ORDER = [2, 5, 8, 0, 3, 6, 1, 4, 7];
