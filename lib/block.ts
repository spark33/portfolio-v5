/**
 * The block — 모아쓰기.
 *
 * Hangul does not run its letters in a line. It gathers them into a square:
 * 가 holds two jamo, 뷁 holds four, and both occupy exactly the same frame.
 * The frame was fixed in 1443 and is not negotiable; the entire design problem
 * is how the parts are arranged to fit inside it.
 *
 * That is not a metaphor for this site's argument — it is the argument, in the
 * writing system the author's own name is written in. And it is the site's own
 * grid at a different scale: `--u` never changes either, and every layout
 * decision on this site is a composition inside a cell count somebody else set.
 *
 * ## Why this replaced a seal
 *
 * The first version of the site's second system was a 인장 impression: a
 * cinnabar block with a broken edge, skipped paste and the name carved out.
 * It was cut, and the reason is worth keeping. The object was inherited rather
 * than argued — `src/tokens.css` had mentioned seal paste in a comment and the
 * brief listed it as a lead, so it arrived pre-approved without ever being
 * tested against the person it represents. And the execution put it in the
 * wrong register: weathered ink and worn stone are a heritage artefact, and the
 * subject is someone shipping a multi-LLM product in Seoul in 2026. A seal says
 * *this is old and authentic*. 모아쓰기 says *this is a system, and I work
 * inside it* — which is what the site is for.
 *
 * ## The geometry is measured, not styled
 *
 * A pixel scan of Pretendard 600 (the probe is in the iteration log) says two
 * things, and both are load-bearing:
 *
 * 1. 바 occupies rows 210–487 of the scan; 박 occupies 201–465. Adding a third
 *    jamo makes the block **shorter**, not taller — 초성 and 중성 compress
 *    upward to make room for the 종성. The frame never grows to accommodate
 *    what you put in it.
 * 2. There is a real gap in the ink at 60.2–64.8% of the glyph's height in both
 *    박 and 상: the boundary the 종성 begins below. 62% is that measurement,
 *    not a proportion that looked right.
 *
 * The accent fills below that line, because the 종성 is the one element in the
 * system that is purely a fitting problem: it arrives last, into height the
 * vowel has already taken.
 */

/** Fitted to the scan, in the SVG's 100-unit block. */
const FONT_SIZE = 78;
/** Pretendard 600 sets a 종성-bearing block 0.88em tall. */
const GLYPH_HEIGHT = 0.88 * FONT_SIZE;
/** Glyph top is 0.7967em above the alphabetic baseline. */
const BASELINE = +((100 - GLYPH_HEIGHT) / 2 + 0.7967 * FONT_SIZE).toFixed(2);
/** 62% of the glyph's height, expressed against that baseline. */
const DIVISION = +(BASELINE - 0.2511 * FONT_SIZE).toFixed(2);

/** 박상현. Three syllables, three frames, one geometry. */
const SYLLABLES = ["박", "상", "현"];

export interface BlockOptions {
  /** Suffixes every id. One mark per page, one key per page. */
  key: string;
  /** Reaches assistive tech; the SVG is otherwise a picture of a name. */
  label: string;
  /** Extra classes on the <svg>. Placement lives in CSS, never here. */
  className?: string;
}

export function block({ key, label, className = "" }: BlockOptions) {
  const cells = SYLLABLES.map((syllable, i) => {
    const x = i * 100;
    const top = `bt-${key}-${i}`;
    const bottom = `bb-${key}-${i}`;

    // The same glyph twice, clipped above and below the division, so one
    // character crosses from ink on paper to paper on the accent. Not two
    // glyphs pretending to be one: a single letterform cut by the boundary
    // its own final consonant sits under.
    const glyph = (fill: string) =>
      `<text x="${x + 50}" y="${BASELINE}" text-anchor="middle" ` +
      `font-family="Pretendard, sans-serif" font-weight="600" ` +
      `font-size="${FONT_SIZE}" fill="${fill}">${syllable}</text>`;

    return `
        <clipPath id="${top}"><rect x="${x}" y="0" width="100" height="${DIVISION}" /></clipPath>
        <clipPath id="${bottom}"><rect x="${x}" y="${DIVISION}" width="100" height="${100 - DIVISION}" /></clipPath>
        <rect x="${x}" y="${DIVISION}" width="100" height="${100 - DIVISION}" fill="currentColor" />
        <g clip-path="url(#${top})">${glyph("var(--ink)")}</g>
        <g clip-path="url(#${bottom})">${glyph("var(--paper)")}</g>
        <rect x="${x + 0.5}" y="0.5" width="99" height="99" fill="none"
          stroke="var(--ink)" stroke-width="1" vector-effect="non-scaling-stroke" />`;
  }).join("");

  return `<svg class="block ${className}" viewBox="0 0 300 100" role="img" aria-label="${label}" focusable="false">${cells}
      </svg>`;
}

/**
 * The mark's foot, for the places a 300-unit-wide object cannot go.
 *
 * The current-page marker in the navigation is 7px, which is below the size at
 * which three frames and three glyphs are anything but mud. What survives that
 * far down is the proportion: the 종성 band is the bottom 41.8% of the block,
 * so the marker is a bar at exactly that aspect. Same measurement, same accent,
 * no second idea.
 */
export const JONGSEONG_RATIO = +((100 - DIVISION) / 100).toFixed(3);
