/**
 * The name, taken apart.
 *
 * 박상현 is three syllables and each is a *block* — Hangul is an assembly
 * system, a square built from two or three jamo placed in fixed regions of it.
 * ㅂ over ㄱ with ㅏ down the right-hand side is 박. Take the blocks apart and
 * you get nine pieces, and those nine pieces are what this animation is made
 * of: they arrive as a line of type, and then they become SEAN PARK.
 *
 * The composed syllables are not drawn. Assembling them and then immediately
 * pulling them apart again was a beat that showed the same name twice, and the
 * pieces are the more interesting half — a name you can read only if you know
 * how to put it back together.
 *
 * All the geometry lives in `morphs.ts`, baked by `scripts/build-loader.mjs`:
 * nine glyphs at one weight and one scale on one baseline, which is what makes
 * them read as a typeface rather than as shapes arranged to resemble one. What
 * is left here is only how they move.
 */

export type Kind = "consonant" | "vowel";

/**
 * Where a piece comes in from, in frame units.
 *
 * Split by kind, and the split is the script's own: a Korean syllable is built
 * consonant-first, and the vowel is what turns a consonant into one. So the
 * consonants rise into the line and the vowels — which are the tall vertical
 * strokes — come down into it, and the two directions cross.
 */
export const APPROACH: Record<Kind, { x: number; y: number }> = {
  consonant: { x: -0.07, y: 0.5 },
  vowel: { x: 0.05, y: -0.58 },
};

/**
 * The order the pieces land in: the six consonants, then the three vowels,
 * each in reading order.
 *
 * A construction order rather than reading order. It is also the one the
 * writing system uses — nothing is a syllable until a vowel arrives — so the
 * line finishes assembling in the same move that makes it readable.
 */
export const LOCK_ORDER = [0, 2, 3, 5, 6, 8, 1, 4, 7];
