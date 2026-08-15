import { expect, test } from "@playwright/test";

/**
 * Guards the baked geometry.
 *
 * `npm run build:loader` is a manual step whose output is committed, so nothing
 * in the build fails if it drifts.
 */
test.describe("loader geometry", () => {
  function extent(points: number[], axis: 0 | 1): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (let i = axis; i < points.length; i += 2) {
      if (points[i] < min) min = points[i];
      if (points[i] > max) max = points[i];
    }
    return { min, max };
  }

  test("both stages sit inside the frame, in one coordinate space", async () => {
    const { FRAME, MORPHS } = await import("../src/loader/morphs.ts");

    // Both stages are drawn by a single path holding every contour at once — a
    // letter's counter only punches a hole when it shares a path with its
    // outline — and one path can carry no per-glyph transform. So every glyph
    // has to be baked in the frame's own coordinates. Baked per glyph instead,
    // they would all land on top of one another the instant that path took over.
    for (const stage of ["from", "latin"] as const) {
      const all = MORPHS.flatMap((entry) => entry[stage]);
      const x = extent(all, 0);
      const y = extent(all, 1);

      expect(x.min).toBeGreaterThanOrEqual(0);
      expect(x.max).toBeLessThanOrEqual(FRAME.width);
      expect(y.min).toBeGreaterThanOrEqual(0);
      expect(y.max).toBeLessThanOrEqual(FRAME.height);

      // Laid out at a single glyph's scale this would be a fraction of the
      // width. Two thirds is well clear of that and demands no particular
      // composition.
      expect(x.max - x.min).toBeGreaterThan(FRAME.width * 0.66);
    }
  });

  test("both stages share a scale, so the piece is one weight throughout", async () => {
    const { MORPHS } = await import("../src/loader/morphs.ts");

    // Not a direct measure of stroke weight, but it catches the thing that
    // destroys it: fitting each stage to the frame separately. The jamo line is
    // wider in em than SEAN PARK, so width-fitting sets it smaller — and a
    // stage drawn smaller is a stage drawn lighter.
    const heights = (["from", "latin"] as const).map((stage) => {
      const y = extent(MORPHS.flatMap((entry) => entry[stage]), 1);
      return y.max - y.min;
    });

    // Jamo run taller than caps do — vowels carry an ascender and a descender —
    // but not by half again, which is what a rescaled stage would show.
    expect(heights[0] / heights[1]).toBeGreaterThan(1);
    expect(heights[0] / heights[1]).toBeLessThan(1.35);
  });

  test("holds the same point count through the morph", async () => {
    const { MORPHS, MORPH_POINTS } = await import("../src/loader/morphs.ts");

    for (const entry of MORPHS) {
      const expected = entry.contours * MORPH_POINTS * 2;
      // A lerp between runs of different lengths reads past the end of one of
      // them and produces NaN coordinates, which render as nothing at all.
      expect(entry.from).toHaveLength(expected);
      expect(entry.latin).toHaveLength(expected);
    }
  });

  test("keeps eleven contours and collapses the rest", async () => {
    const { MORPHS, MORPH_POINTS } = await import("../src/loader/morphs.ts");

    // Twenty contours become eleven. The nine with no counterpart collapse to a
    // point inside themselves and stop having area — the lossy half of the
    // transliteration, said in geometry. If the matching ever silently drops
    // one more, a letter loses a stroke and nothing else complains.
    let kept = 0;
    let collapsed = 0;

    for (const entry of MORPHS) {
      for (let c = 0; c < entry.contours; c++) {
        const base = c * MORPH_POINTS * 2;
        let area = 0;
        for (let i = 0; i < MORPH_POINTS; i++) {
          const j = (i + 1) % MORPH_POINTS;
          area +=
            entry.latin[base + i * 2] * entry.latin[base + j * 2 + 1] -
            entry.latin[base + j * 2] * entry.latin[base + i * 2 + 1];
        }
        if (Math.abs(area) < 1e-9) collapsed += 1;
        else kept += 1;
      }
    }

    expect(kept).toBe(11);
    expect(collapsed).toBe(9);
  });

});
