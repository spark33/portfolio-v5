import { expect, test } from "@playwright/test";

/**
 * Guards the baked morph geometry.
 *
 * Every stage has to be in the same coordinate space, because the last stage is
 * drawn as one path holding all twenty contours — it has to be, since a
 * letter's counter only punches a hole when it shares a path with its outline —
 * and one path can carry no per-block transform. Emitted block-local, the three
 * syllables landed on top of one another the instant that path took over, and
 * the flow rendered as a heap in the left third of the frame.
 */
test.describe("loader geometry", () => {
  const TOTAL_WIDTH = 3 + 2 * 0.14;

  function extent(points: number[]): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < points.length; i += 2) {
      if (points[i] < min) min = points[i];
      if (points[i] > max) max = points[i];
    }
    return { min, max };
  }

  test("every stage spans all three blocks, in one coordinate space", async () => {
    const { MORPHS } = await import("../src/loader/morphs.ts");

    for (const stage of ["from", "to", "latin"] as const) {
      const all = MORPHS.flatMap((entry) => entry[stage]);
      const { min, max } = extent(all);

      expect(min).toBeGreaterThanOrEqual(-0.05);
      expect(max).toBeLessThanOrEqual(TOTAL_WIDTH + 0.05);
      // Stacked at one block this would be about 1. Two thirds of the width is
      // well clear of that and well short of demanding a particular layout.
      expect(max - min).toBeGreaterThan(TOTAL_WIDTH * 0.66);
    }
  });

  test("holds the same point count through the whole chain", async () => {
    const { MORPHS, MORPH_POINTS } = await import("../src/loader/morphs.ts");

    for (const entry of MORPHS) {
      const expected = entry.contours * MORPH_POINTS * 2;
      // A lerp between runs of different lengths reads past the end of one of
      // them and produces NaN coordinates, which render as nothing at all.
      expect(entry.from).toHaveLength(expected);
      expect(entry.to).toHaveLength(expected);
      expect(entry.latin).toHaveLength(expected);
    }
  });
});
