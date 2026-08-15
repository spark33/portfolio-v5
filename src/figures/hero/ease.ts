/**
 * Eases for the hero sequence.
 *
 * GSAP takes a plain `(t: number) => number`, so the curves the spec names can
 * be written out directly rather than approximated with presets. Nothing here
 * is linear and nothing is a GSAP default.
 */

/**
 * A CSS-style cubic-bézier easing, solved by Newton with a bisection fallback.
 *
 * `cubic-bezier(x1, y1, x2, y2)` describes a curve parameterised by t, but an
 * ease needs y as a function of *x*. Newton converges in two or three
 * iterations across almost the whole domain; the fallback covers the flat
 * regions of aggressive curves like (0.16, 1, 0.3, 1), where the derivative
 * approaches zero and Newton stalls.
 */
export function cubicBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (t: number) => number {
  const curve = (a: number, b: number, t: number) => {
    const inverse = 1 - t;
    return 3 * inverse * inverse * t * a + 3 * inverse * t * t * b + t * t * t;
  };
  const slope = (a: number, b: number, t: number) => {
    const inverse = 1 - t;
    return (
      3 * inverse * inverse * a +
      6 * inverse * t * (b - a) +
      3 * t * t * (1 - b)
    );
  };

  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 6; i++) {
      const error = curve(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return curve(y1, y2, t);
      const derivative = slope(x1, x2, t);
      if (Math.abs(derivative) < 1e-6) break;
      t -= error / derivative;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      const value = curve(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t;
      else high = t;
      t = (low + high) / 2;
    }

    return curve(y1, y2, t);
  };
}

/** Blocks coming apart: fast out, long settle. */
export const separation = cubicBezier(0.16, 1, 0.3, 1);

/** The morph itself: symmetric, mechanical. */
export const morph = cubicBezier(0.65, 0, 0.35, 1);

/** Camera moves, with the ~2% overshoot applied separately — see `overshoot`. */
export const cameraCurve = cubicBezier(0.22, 1, 0.36, 1);

/**
 * The camera ease with a small overshoot past its target.
 *
 * Written as a wrapper rather than baked into the bézier because a cubic
 * bézier cannot leave the unit square: `cubic-bezier(0.22, 1, 0.36, 1)` has no
 * overshoot in it, and asking for one means going outside what that notation
 * can express.
 */
export const camera = (t: number): number => {
  const eased = cameraCurve(t);
  // Peaks near the end of the move and returns to nothing by the time it
  // lands, so the overshoot is a lean rather than a bounce.
  return eased + 0.02 * Math.sin(Math.PI * Math.min(eased, 1)) * (1 - t);
};

/**
 * Arrival settle: a 2–3° rotation damped out over the tail of a move.
 *
 * Real objects do not stop instantly, and this is worth more to how the piece
 * reads than any amount of shader work. Returns a multiplier in roughly
 * [-1, 1] that decays to zero, to be scaled by the angle wanted.
 */
export const settle = (t: number): number => {
  if (t >= 1) return 0;
  return Math.exp(-6.5 * t) * Math.sin(Math.PI * 3.2 * t);
};
