import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { ATLAS, buildLayout, JAMO, LATIN, MERGE } from "../src/figures/hangul-hero/layout.ts";

/**
 * Layout and atlas tests — no browser needed.
 *
 * These guard the seam between `scripts/bake-glyphs.mjs` and the figure. The
 * bake is a manual step whose output is committed, so nothing in the build
 * fails if the two drift apart: the shader just samples the wrong tiles and
 * draws a name that is subtly not the name. That is exactly the kind of break
 * a test is for.
 */
test.describe("hangul hero layout", () => {
  test("박상현 decomposes into nine jamo across three syllables", () => {
    expect(JAMO).toHaveLength(9);

    for (const syllable of [0, 1, 2]) {
      const block = JAMO.filter((jamo) => jamo.syllable === syllable);
      // Every syllable in this name is initial + vertical vowel + final, which
      // is what lets one set of cells describe all three.
      expect(block.map((jamo) => jamo.role)).toEqual(["initial", "vowel", "final"]);
    }

    expect(JAMO.map((jamo) => jamo.char).join("")).toBe("ㅂㅏㄱㅅㅏㅇㅎㅕㄴ");
  });

  test("eight jamo take a letter each and exactly one fuses", () => {
    expect(LATIN.join("")).toBe("SeanPark");

    const resolving = JAMO.filter((jamo) => jamo.target >= 0);
    const fusing = JAMO.filter((jamo) => jamo.target === -1);

    expect(resolving).toHaveLength(8);
    expect(fusing).toHaveLength(1);

    // The mapping is a bijection onto the letters: no letter is left without a
    // source and none is claimed twice.
    expect([...resolving.map((jamo) => jamo.target)].sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7,
    ]);

    // The one that fuses is ㅇ, and it goes to the "a" its own syllable-mate
    // becomes — 상's vowel and final collapsing into one letter.
    expect(JAMO[MERGE.jamo].char).toBe("ㅇ");
    expect(JAMO[MERGE.jamo].syllable).toBe(1);
    expect(LATIN[MERGE.into]).toBe("a");
    expect(JAMO.find((jamo) => jamo.target === MERGE.into)?.syllable).toBe(1);
  });

  test("the fuse happens in the final third of the transit", () => {
    expect(MERGE.start).toBeGreaterThanOrEqual(2 / 3 - 0.05);
    expect(MERGE.start).toBeLessThan(1);
  });

  test("every pair points at a real tile, and the fusing one has no letter", () => {
    const { pairs } = buildLayout();
    const tiles = ATLAS.cols * ATLAS.rows;

    expect(pairs).toHaveLength(9);

    for (const pair of pairs) {
      for (const tile of [pair.from, pair.to]) {
        expect(Number.isInteger(tile)).toBe(true);
        expect(tile).toBeGreaterThanOrEqual(0);
        expect(tile).toBeLessThan(tiles);
      }
    }

    // The jamo that fuses keeps its own outline the whole way — it never
    // blends toward a letter, because it does not become one.
    const fusing = pairs.filter((pair) => pair.fuses);
    expect(fusing).toHaveLength(1);
    expect(fusing[0].from).toBe(fusing[0].to);
  });

  test("the Latin line is set from advance widths, not stretched to fit", () => {
    const { pairs } = buildLayout();
    const letters = pairs.filter((pair) => !pair.fuses);

    // Both "a"s are the same glyph, so any distortion applied to one and not
    // the other would show up as a difference in tile size here.
    const aWidths = [pairs[1], pairs[4]].map((pair) => pair.resolved.hx);
    expect(aWidths[0]).toBeCloseTo(aWidths[1], 6);

    for (const pair of letters) {
      expect(pair.resolved.hx).toBeGreaterThan(0);
      expect(pair.resolved.hy).toBeGreaterThan(0);
    }
  });

  test("both states are centred, so the morph is not also a drift", () => {
    const { pairs, composedSize, resolvedSize } = buildLayout();

    const span = (get: (pair: (typeof pairs)[number]) => { cx: number; hx: number }) => {
      const centres = pairs.map(get);
      const min = Math.min(...centres.map((r) => r.cx - r.hx));
      const max = Math.max(...centres.map((r) => r.cx + r.hx));
      return (min + max) / 2;
    };

    expect(span((pair) => pair.composed)).toBeCloseTo(0, 1);
    expect(span((pair) => pair.resolved)).toBeCloseTo(0, 1);

    // The two states should be comparable in width — the piece is one object
    // seen twice, and a large mismatch would read as a zoom.
    expect(resolvedSize[0] / composedSize[0]).toBeGreaterThan(0.8);
    expect(resolvedSize[0] / composedSize[0]).toBeLessThan(1.3);
  });

  test("the atlas on disk is the size its metadata claims", () => {
    const bytes = readFileSync(
      new URL("../src/figures/hangul-hero/glyphs.sdf.bin", import.meta.url),
    ).byteLength;

    // One byte per texel, single channel. A mismatch means the bake was run
    // with different constants than the ones the shader is reading.
    expect(bytes).toBe(ATLAS.tile * ATLAS.cols * ATLAS.tile * ATLAS.rows);
  });
});
