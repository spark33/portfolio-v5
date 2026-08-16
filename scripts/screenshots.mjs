/**
 * Renders every page at the three widths the site is judged at, in both
 * themes, and writes them to shots/. Run against a preview server:
 *
 *     npm run build && npm run preview &
 *     npm run shots
 *
 * BASE overrides the origin; CHROME overrides the browser binary, which the
 * cloud environment needs because its Playwright browsers are pinned to a
 * different build than the npm package expects. OUT overrides the directory,
 * so a pass can keep its own before/after set.
 */
import { mkdirSync, rmSync } from "node:fs";
import pkg from "@playwright/test";

const { chromium } = pkg;

const BASE = process.env.BASE ?? "http://localhost:4173";
const OUT = process.env.OUT ?? "shots";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;

const PAGES = [
  ["home", "/"],
  ["work-index", "/work/"],
  ["work-1", "/work/inherited-mental-model/"],
  ["work-2", "/work/two-concepts-one-product/"],
  ["work-3", "/work/no-reason-to-return/"],
  ["logician-ui", "/logician-ui/"],
  ["harness", "/harness/"],
  ["about", "/about/"],
  ["writing", "/blog/"],
  ["post", "/blog/cutting-transcript-latency/"],
  ["404", "/does-not-exist/"],
];

const WIDTHS = [
  ["1440", 1440, 900],
  ["768", 768, 1024],
  ["390", 390, 844],
];

const THEMES = ["light", "dark"];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
});

let count = 0;

for (const theme of THEMES) {
  for (const [label, width, height] of WIDTHS) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 2,
      colorScheme: theme,
    });

    for (const [name, path] of PAGES) {
      if (ONLY && !ONLY.includes(name)) continue;
      const page = await context.newPage();
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${OUT}/${name}-${label}-${theme}.png`,
        fullPage: true,
      });
      await page.close();
      count += 1;
    }

    await context.close();
  }
}

await browser.close();
console.log(`${count} shots → ${OUT}/`);
