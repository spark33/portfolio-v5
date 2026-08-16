/**
 * The 300px thumbnail — the first thing a juror sees.
 *
 * A submission is browsed as a card long before it is opened, so the question
 * "what is this at 300px wide" is a real design constraint rather than a
 * curiosity. Rendered by shrinking a 1440×900 viewport with deviceScaleFactor
 * rather than by resampling afterwards, so it is the browser's own downscale.
 *
 *     BASE=http://localhost:4173 URL=/ OUT=shots-thumb node scripts/thumb.mjs
 */
import { mkdirSync } from "node:fs";
import pkg from "@playwright/test";

const { chromium } = pkg;

const BASE = process.env.BASE ?? "http://localhost:4173";
const OUT = process.env.OUT ?? "shots-thumb";
const URLS = (process.env.URLS ?? "/").split(",");
const NAME = process.env.NAME ?? "home";

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
});

let count = 0;

for (const theme of ["light", "dark"]) {
  for (const [width, height, scale, label] of [
    [1440, 900, 300 / 1440, "300"],
    [1440, 900, 1, "1440"],
    [390, 844, 1, "390"],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      colorScheme: theme,
    });

    for (const url of URLS) {
      const slug = url === "/" ? NAME : url.replace(/[/.]/g, "-").replace(/^-|-$/g, "");
      const page = await context.newPage();
      await page.goto(BASE + url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `${OUT}/${slug}-${label}-${theme}.png`,
        fullPage: label !== "300",
      });
      await page.close();
      count += 1;
    }

    await context.close();
  }
}

await browser.close();
console.log(`${count} → ${OUT}/`);
