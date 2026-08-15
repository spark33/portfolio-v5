/**
 * Eases for the hero.
 *
 * GSAP accepts a plain `(t: number) => number` as an ease, so none of this
 * needs CustomEase or any other plugin — and writing the curves out means the
 * overshoot is a number that can be tuned per transform rather than a preset
 * that happens to look close.
 *
 * Nothing here is linear and nothing is a GSAP default. Every transform in the
 * sequence uses one of these.
 */

/** Smoothstep. Used as an input warp, never on its own — it has no overshoot. */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * A decaying cosine: the mass arrives, overshoots once, and settles.
 *
 *   f(t) = 1 − e^(−decay·t)·cos(freq·t)
 *
 * `freq` is pinned to 3π/2 rather than exposed, because that is the value that
 * puts cos(freq) exactly at zero — so f(0) = 0 and f(1) = 1 *exactly*, with one
 * overshoot in between. Any other frequency lands off its target at t = 1 and
 * has to be renormalised, which distorts the curve it was chosen for.
 *
 * That leaves `decay` as the only dial, and it maps to something physical:
 * the overshoot peaks at t = 2/3 with magnitude e^(−2·decay/3).
 *
 *   decay 6.0 → ~1.8%  a hairline of give
 *   decay 4.5 → ~5%    a part seating into place
 *   decay 3.2 → ~12%   visibly sprung
 */
function damped(decay: number): (t: number) => number {
  const freq = (3 * Math.PI) / 2;
  return (t) => 1 - Math.exp(-decay * t) * Math.cos(freq * t);
}

/**
 * Blending one outline into another.
 *
 * Pure smoothstep, and the one curve here with no overshoot by design. The
 * others overshoot a *transform*, which is a rigid move that can safely go
 * past its target and come back. This drives a `mix()` between two distance
 * fields, where going past the target means evaluating the blend outside
 * [0, 1] and distorting the letterform into something the typeface never
 * contained. Overshoot belongs on transforms, never on shape.
 */
export const flow = smoothstep;

/** A part seating into a detent. The workhorse — most transforms use this. */
export const seat = damped(4.5);

/** Tighter, for transforms that should read as precise rather than sprung. */
export const detent = damped(6);

/**
 * Slow to start, quick through the middle, then settles. This is the
 * "mechanism operating" curve: the input warp holds the mass still at the
 * start, so a stagger reads as parts releasing in sequence rather than as one
 * move with a delay on it.
 */
export const mechanism = (t: number): number => damped(4.2)(smoothstep(t));

/**
 * The 9th jamo merging into its neighbour. Front-loaded: it covers most of the
 * distance early and then eases the last stretch out over a long tail, so it
 * looks drawn in and seated rather than dropped.
 */
export const absorb = (t: number): number => {
  const eased = 1 - Math.pow(1 - t, 3);
  return damped(8)(eased);
};

/** Camera moves. No overshoot at all — a camera that springs reads as a mistake. */
export const camera = (t: number): number => {
  // Quintic in-out, normalised by construction.
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
};
