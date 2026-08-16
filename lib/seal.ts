/**
 * The impression — 인.
 *
 * `src/tokens.css` has always said the accent is "인주, the colour of the paste
 * in a Korean official seal", and until now the site rendered that claim as a
 * 0.4em square. A seal is not a square: it is an object pressed into a surface,
 * and everything that makes it recognisable is what goes wrong in the pressing
 * — the edge breaks, the paste skips, the block bites unevenly into the board.
 *
 * It is load-bearing rather than ornamental, and the rule is one sentence: the
 * seal stamps the page's record. The home page and the about page stamp the
 * four figures; a case study stamps its outcome. A record nobody can verify is
 * exactly the thing a seal exists to make official, which is also the site's
 * argument about its own author, so the placement is the point rather than a
 * spot that looked empty.
 *
 * Drawn as one inline SVG with its own defs. Every id is suffixed, so a second
 * seal on the same page cannot capture the first one's filter — the shell
 * emits one per page today and that is a rule, not a guarantee.
 *
 * 백문방인: the characters are bitten *out* of a solid block rather than
 * standing on a white ground. That is the form that still reads at 40px wide,
 * which is the size it is on the card a juror sees before they open anything.
 * The characters are 박상현 set in Pretendard — his own name, not invented
 * seal script — so nothing here is a fabricated artefact.
 */

/** The block's edge, authored rather than a rect: no side of a carved stone is straight. */
const EDGE = [
  "M5.2 4.0",
  "L23.0 3.1 L41.0 4.6 L58.0 3.4 L76.0 4.4 L94.6 3.6",
  "L95.8 22.0 L94.6 40.0 L96.2 58.0 L95.0 77.0 L96.0 95.4",
  "L77.0 96.4 L59.0 95.2 L41.0 96.6 L23.0 95.4 L4.6 96.2",
  "L3.4 77.0 L4.6 59.0 L3.2 41.0 L4.4 23.0 Z",
].join(" ");

/**
 * Where the paste ran thin.
 *
 * The first version was five hand-placed ellipses and it read as five holes
 * punched in a sticker. Ink does not thin in five places, it thins everywhere
 * at once and unevenly, so this is a second noise field thresholded into
 * sparse blotches: the colour matrix throws the noise's colour away, paints
 * black, and derives alpha from luminance with a negative slope and an offset:
 * alpha = 0.94 − 1.8·v, clamped at zero. fractalNoise sits around v = 0.5, so
 * a little over half the block erases slightly and the darkest tenth erases
 * hard. In the mask, erased means the board shows through — which is what an
 * unstamped patch is.
 *
 * The first attempt at this used −1.15 with an offset of 0.78, which needs
 * v < 0.226 to erase anything at all. That is the tail of the distribution, so
 * it erased nothing and the block came out flat. Worth stating rather than
 * quietly correcting: with a threshold this steep, "no visible effect" and
 * "no effect" look identical.
 */
const MOTTLE_MATRIX = "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -0.6 -0.6 -0.6 0 0.94";

/** The three syllables, stacked in one column — the arrangement a three-character 인장 uses. */
const SYLLABLES = ["박", "상", "현"];

export interface SealOptions {
  /** Suffixes every id in the emitted defs. One seal per page, one key per page. */
  key: string;
  /** Reaches assistive tech; the SVG is otherwise a picture of a name. */
  label: string;
  /** Extra classes on the <svg>. Placement lives in CSS, never here. */
  className?: string;
}

export function seal({ key, label, className = "" }: SealOptions) {
  const bite = `seal-bite-${key}`;
  const carve = `seal-carve-${key}`;
  const mottle = `seal-mottle-${key}`;

  // 23.5, not 27: three syllable blocks stacked at a 24-unit pitch have to
  // clear both their neighbours and the edge once the displacement has bitten
  // into it, and a character touching the edge reads as a mistake rather than
  // as wear. The block is the mark; the name is what is carved out of it.
  const text = SYLLABLES.map(
    (syllable, i) =>
      `<text x="50" y="${26 + i * 24}" text-anchor="middle" dominant-baseline="central" ` +
      `font-family="Pretendard, sans-serif" font-weight="600" font-size="23.5" fill="#000">${syllable}</text>`,
  ).join("");

  return `<svg class="seal ${className}" viewBox="0 0 100 100" role="img" aria-label="${label}" focusable="false">
      <defs>
        <filter id="${bite}" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="4" seed="11" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="${mottle}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="4" seed="5" />
          <feColorMatrix values="${MOTTLE_MATRIX}" />
        </filter>
        <mask id="${carve}" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
          <path d="${EDGE}" fill="#fff" />
          <rect width="100" height="100" filter="url(#${mottle})" />
          ${text}
        </mask>
      </defs>
      <g filter="url(#${bite})">
        <rect width="100" height="100" fill="currentColor" mask="url(#${carve})" />
      </g>
    </svg>`;
}
