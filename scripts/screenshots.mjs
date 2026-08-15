/**
 * Renders every page at the three widths the site is judged at and writes
 * them to shots/. Run against a preview server:
 *
 *     npm run build && npm run preview &
 *     npm run shots
 *
 * BASE overrides the origin; CHROME overrides the browser binary, which the
 * cloud environment needs because its Playwright browsers are pinned to a
 * different build than the npm package expects.
 */
import { mkdirSync, rmSync } from "node:fs";
import pkg from "@playwright/test";

const { chromium } = pkg;

const BASE = process.env.BASE ?? "http://localhost:4173";
const OUT = "shots";

const PAGES = [
  ["home", "/"],
  ["work-1", "/work/inherited-mental-model/"],
  ["work-2", "/work/two-concepts-one-product/"],
  ["work-3", "/work/no-reason-to-return/"],
  ["logician-ui", "/logician-ui/"],
  ["harness", "/harness/"],
  ["about", "/about/"],
  ["writing", "/blog/"],
];

const WIDTHS = [
  ["1440", 1440, 900],
  ["768", 768, 1024],
  ["390", 390, 844],
];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME || undefined,
});

for (const [label, width, height] of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });

  for (const [name, path] of PAGES) {
    const page = await context.newPage();
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Let the first-visit sequence finish so the shot is the settled state.
    await page.waitForTimeout(1600);
    await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: true });
    await page.close();
  }

  await context.close();
}

await browser.close();
console.log(`${PAGES.length * WIDTHS.length} shots → ${OUT}/`);
