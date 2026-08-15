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

function tables(): { axes: Array<[string, number, number]>; glyphs: number; names: string[] } {
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

  test("carries every glyph the loader renders, and no more", () => {
    // 박 상 현 S E A N P R K, plus .notdef and the space.
    expect(tables().glyphs).toBe(12);
  });

  test("stays small enough to block first paint on", () => {
    const bytes = readFileSync(FONT).byteLength;
    expect(bytes).toBeLessThan(6 * 1024);
  });
});
