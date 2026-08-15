import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

/**
 * Guards the subset font the loader animates.
 *
 * `npm run build:loader` is a manual step whose output is committed, so
 * nothing in the build fails if it drifts — the loader would fall back to a
 * system face and the weight animation would silently do nothing.
 */
const FONT = new URL("../public/loader/pretendard-var.woff2", import.meta.url);

function tables(): {
  axes: Array<[string, number, number]>;
  glyphs: number;
  names: string[];
  cmap: number[];
} {
  // fontTools reads the file; parsing woff2 in Node would mean shipping a
  // brotli-aware font parser purely to assert on a build artefact.
  const script = `
import json, sys
from fontTools.ttLib import TTFont
f = TTFont(sys.argv[1])
print(json.dumps({
  "axes": [[a.axisTag, a.minValue, a.maxValue] for a in f["fvar"].axes] if "fvar" in f else [],
  "glyphs": f["maxp"].numGlyphs,
  "names": sorted(f.keys()),
  "cmap": sorted(f.getBestCmap().keys()),
}))
`;
  const out = execFileSync("python3", ["-c", script, FONT.pathname], { encoding: "utf8" });
  return JSON.parse(out);
}

test.describe("loader font", () => {
  test("keeps the weight axis the animation travels", () => {
    const { axes } = tables();
    const wght = axes.find(([tag]) => tag === "wght");

    expect(wght).toBeDefined();
    // The loader interpolates between 45 and 930; a subset that flattened to a
    // static instance, or clipped the axis, would leave it animating nothing.
    expect(wght![1]).toBeLessThanOrEqual(45);
    expect(wght![2]).toBeGreaterThanOrEqual(930);
  });

  test("keeps gvar, without which the axis has no deltas to apply", () => {
    expect(tables().names).toContain("gvar");
  });

  test("carries the jamo the assembly is built from", () => {
    // The animation assembles each block from its parts, so the nine jamo have
    // to survive the subset alongside the syllables they compose into. Losing
    // them is the failure that would leave the loader assembling nothing.
    const { cmap } = tables();
    for (const char of "박상현SEANPRKㅂㅏㄱㅅㅇㅎㅕㄴ") {
      expect(cmap).toContain(char.codePointAt(0));
    }
  });

  test("stays small enough to block first paint on", () => {
    const bytes = readFileSync(FONT).byteLength;
    expect(bytes).toBeLessThan(6 * 1024);
  });
});

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
