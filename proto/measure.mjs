/**
 * Measures the advance width of each step of the name resolution, in ems, at
 * the weight and tracking it is actually set in.
 *
 * The strip sizes itself from its own measure — `measure / --fit` — so `--fit`
 * has to be at least the em-width of the longest step or the type overflows,
 * and CSS has no unit for "the width of this string". This is where the number
 * in src/home.css comes from; `the name fills its measure and never wraps`
 * fails if it drifts.
 *
 *   CHROME=/opt/pw-browsers/chromium node proto/measure.mjs
 */
import pkg from "@playwright/test";

const { chromium } = pkg;
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });

for (const width of [1440, 1024, 768, 390, 320]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  await page.goto(process.env.URL ?? "http://localhost:4173/");
  await page.evaluate(() => document.fonts.ready);

  const rows = await page.evaluate(() => {
    const measure = document.querySelector(".resolve").getBoundingClientRect().width
      - parseFloat(getComputedStyle(document.querySelector(".resolve")).paddingLeft) * 2;
    return [...document.querySelectorAll(".resolve-value")].map((el) => {
      const style = getComputedStyle(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      const w = range.getBoundingClientRect().width;
      return {
        text: el.textContent.trim(),
        weight: style.fontWeight,
        size: +parseFloat(style.fontSize).toFixed(1),
        ems: +(w / parseFloat(style.fontSize)).toFixed(3),
        pctOfMeasure: +((w / measure) * 100).toFixed(1),
        lines: el.getClientRects().length,
      };
    });
  });

  console.log(`\n${width}px — measure ${await page.evaluate(() => Math.round(document.querySelector(".resolve").clientWidth - parseFloat(getComputedStyle(document.querySelector(".resolve")).paddingLeft) * 2))}px`);
  console.table(rows);
  await context.close();
}

await browser.close();
