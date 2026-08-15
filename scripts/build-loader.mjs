#!/usr/bin/env node
/**
 * Subsets Pretendard Variable down to the glyphs the loader draws.
 *
 *   npm run build:loader
 *
 * The whole point is the weight axis. Pretendard Variable carries wght 45–930,
 * and the loader animates along it — the name gains weight as the page loads —
 * so the subset has to keep `fvar` and `gvar` rather than flattening to a
 * static instance.
 *
 * Eleven glyphs and a space come to under 3 KB as woff2, which is less than
 * the SVG path data this replaced, and it buys real selectable text instead of
 * a wall of <path> elements.
 *
 * Needs fonttools and brotli:  python3 -m pip install fonttools brotli
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SOURCE = "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf";
/**
 * Deliberately not in public/fonts/.
 *
 * scripts/fetch-fonts.py rebuilds that directory from scratch and unlinks every
 * *.woff2 it finds, so a font living there that it does not know about is one
 * `python3 scripts/fetch-fonts.py` away from vanishing — and the loader would
 * quietly fall back to a system face with the weight axis animating nothing.
 */
const OUT = path.join("public", "loader", "pretendard-var.woff2");

/** Every character the loader can render. */
const TEXT = "박상현SEANPRK ";

function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`${SOURCE} is missing — run npm install`);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  execFileSync(
    "python3",
    [
      "-m",
      "fontTools.subset",
      SOURCE,
      `--text=${TEXT}`,
      "--flavor=woff2",
      // The loader sets plain spans; none of the layout features are reachable,
      // and dropping them takes the file down by more than half.
      "--layout-features=",
      "--no-hinting",
      "--desubroutinize",
      `--output-file=${OUT}`,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const bytes = fs.statSync(OUT).size;
  process.stderr.write(`wrote ${OUT} — ${TEXT.trim().length + 1} glyphs, ${(bytes / 1024).toFixed(1)} KB\n`);
}

main();
