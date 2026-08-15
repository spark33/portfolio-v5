import { expect, test } from "@playwright/test";

import { HANGUL, LATIN, VIEW } from "../src/loader/glyphs.ts";

/**
 * Guards the seam between scripts/build-loader.mjs and the loader.
 *
 * The bake is a manual step whose output is committed, so nothing in the build
 * fails if the two drift apart — the loader would simply draw the wrong name,
 * or nothing at all.
 */
test.describe("loader glyphs", () => {
  test("both runs are present and complete", () => {
    expect(HANGUL.glyphs.map((g) => g.char).join("")).toBe("박상현");
    // The space carries no outline, so it is not a glyph — "SEAN PARK" is
    // eight drawn shapes.
    expect(LATIN.glyphs.map((g) => g.char).join("")).toBe("SEANPARK");
  });

  test("every glyph has real path data", () => {
    for (const glyph of [...HANGUL.glyphs, ...LATIN.glyphs]) {
      expect(glyph.d.length).toBeGreaterThan(20);
      expect(glyph.d.startsWith("M")).toBe(true);
      expect(glyph.d).not.toContain("NaN");
    }
  });

  test("glyphs advance left to right along each run", () => {
    for (const run of [HANGUL, LATIN]) {
      expect(run.width).toBeGreaterThan(0);

      // SVG path data omits the separator before a negative number, so
      // "M73.14-79.88" has to be parsed with a pattern rather than split on
      // punctuation — splitting yields "73.14-79.88", which is NaN.
      const startX = run.glyphs.map((glyph) => {
        const match = /^M(-?[\d.]+)/.exec(glyph.d);
        expect(match).not.toBeNull();
        return Number(match![1]);
      });

      // Each glyph starts further right than the one before it, which is the
      // cheapest check that the pen actually advanced between them.
      for (let i = 1; i < startX.length; i++) {
        expect(startX[i]).toBeGreaterThan(startX[i - 1]);
      }
    }
  });

  test("the viewBox has the baseline inside it", () => {
    // Ascenders run negative from the baseline at zero, descenders positive.
    expect(VIEW.top).toBeLessThan(0);
    expect(VIEW.top + VIEW.height).toBeGreaterThan(0);
  });
});
