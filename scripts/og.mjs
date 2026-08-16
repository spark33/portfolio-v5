/**
 * Regenerates public/og.png, the 1200×630 share card.
 *
 *     node scripts/og.mjs
 *
 * The output is committed, exactly like the fonts, so a production build needs
 * neither a browser nor the network. Run this again when the claim, the record
 * or the palette changes — nothing checks that it is current, because the only
 * honest check would be rendering it, which is the thing we are avoiding at
 * build time.
 *
 * It is drawn from the same tokens and the same content module as the site,
 * not from a copy of the values, so the card cannot quietly disagree with the
 * page it advertises. CHROME overrides the browser binary.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import pkg from "@playwright/test";

const { chromium } = pkg;

// Read the tokens rather than restate them: one file decides these colours.
const tokens = readFileSync("src/tokens.css", "utf8");
const token = (name) =>
  new RegExp(`--${name}:\\s*([^;]+);`).exec(tokens)?.[1].trim() ?? "";

const PAPER = token("paper");
const INK = token("ink");
const INK_2 = token("ink-secondary");
const SEAL = token("seal");
const LATTICE = token("lattice-ink");

const { person, record, thesis } = await import(
  pathToFileURL(resolve("content/site.ts")).href
);

const WIDTH = 1200;
const HEIGHT = 630;
/** Nineteen cells across the card, as everywhere else. */
const CELL = WIDTH / 19;

const figures = record
  .map(
    (f) => `<div class="figure">
        <span class="label">${f.label}</span>
        <b>${f.value}</b>
      </div>`,
  )
  .join("\n      ");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="stylesheet" href="./fonts.css" />
    <style>
      * { margin: 0; box-sizing: border-box; }
      body {
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        background: ${PAPER};
        color: ${INK};
        font-family: "Schibsted Grotesk", sans-serif;
        font-synthesis-weight: none;
        -webkit-font-smoothing: antialiased;
        position: relative;
        overflow: hidden;
      }
      /* The same two rules the site draws, at the card's scale: a lattice on
         a nineteen-cell pitch, and star points on a six-cell pitch starting
         four cells in. Same numbers as src/board.css. */
      .board {
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(to right, ${LATTICE} 1px, transparent 1px),
          linear-gradient(to bottom, ${LATTICE} 1px, transparent 1px);
        background-size: ${CELL}px ${CELL}px;
        opacity: 0.16;
      }
      .hoshi {
        position: absolute;
        inset: 0;
        background-image: radial-gradient(circle 3px at center, ${INK} 100%, transparent 0);
        background-size: ${CELL * 6}px ${CELL * 6}px;
        background-position: ${CELL * 4}px ${CELL * 4}px;
        opacity: 0.3;
      }
      .frame {
        position: relative;
        height: 100%;
        padding: ${CELL * 1.2}px ${CELL}px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .mono {
        font-family: "IBM Plex Mono", monospace;
        font-size: 15px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
        color: ${INK_2};
      }
      .top { display: flex; justify-content: space-between; align-items: baseline; }
      .top b { color: ${INK}; font-weight: 500; }
      h1 {
        font-size: 74px;
        line-height: 0.98;
        letter-spacing: -0.03em;
        font-weight: 600;
        max-width: 15ch;
        margin-top: ${CELL * 0.6}px;
      }
      .rule { border-top: 1px solid ${INK_2}; opacity: 0.45; }
      .foot { display: flex; gap: ${CELL}px; padding-top: ${CELL * 0.5}px; }
      .figure { display: grid; gap: 6px; }
      .figure b {
        font-size: 34px;
        line-height: 1;
        letter-spacing: -0.026em;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .label { font-family: "IBM Plex Mono", monospace; font-size: 12px;
        letter-spacing: 0.14em; text-transform: uppercase; color: ${INK_2}; }
      /* The one accent, in the one place: the seal. */
      .seal {
        position: absolute;
        right: ${CELL}px;
        bottom: ${CELL * 1.2}px;
        width: 34px;
        height: 34px;
        background: ${SEAL};
      }
    </style>
  </head>
  <body>
    <div class="board"></div>
    <div class="hoshi"></div>
    <div class="frame">
      <div class="top mono">
        <span><b>${person.nameEn}</b> ${person.nameKo}</span>
        <span>${person.role} · ${person.org} · ${person.location}</span>
      </div>

      <h1>${thesis.claim}</h1>

      <div>
        <div class="rule"></div>
        <div class="foot">
      ${figures}
        </div>
      </div>
    </div>
    <div class="seal"></div>
  </body>
</html>
`;

// Written beside the fonts so `./fonts.css` and its `/fonts/…` urls resolve
// off the same directory the site serves them from.
const scratch = resolve("public/__og.html");
writeFileSync(scratch, html);
writeFileSync(
  resolve("public/fonts.css"),
  readFileSync("src/fonts.css", "utf8").replaceAll("url(/fonts/", "url(./fonts/"),
);

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
});

try {
  const page = await browser.newPage({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(scratch).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "public/og.png" });
  console.log(`public/og.png — ${WIDTH}×${HEIGHT}`);
} finally {
  await browser.close();
  rmSync(scratch, { force: true });
  rmSync(resolve("public/fonts.css"), { force: true });
}
