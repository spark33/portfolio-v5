/**
 * Screenshot a URL at 1440 / 390 (viewport-only, first screen) and at a
 * 300px-wide thumbnail rendered from the 1440 shot — which is what a juror
 * sees before anything else.
 *
 *   node shoot.mjs <url> <outdir> <name> [theme]
 */
import { mkdirSync } from "node:fs";
import pkg from "@playwright/test";

const { chromium } = pkg;
const [url, out, name, theme = "light"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });

for (const [label, width, height] of [["1440", 1440, 900], ["390", 390, 844]]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: Number(process.env.SCALE ?? 2),
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${out}/${name}-${label}-${theme}.png` });
  await context.close();
}

// The thumbnail: the 1440 first screen, rendered into a 300px-wide frame.
{
  const context = await browser.newContext({
    viewport: { width: 300, height: 188 },
    deviceScaleFactor: 1,
    colorScheme: theme,
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // Render at 1440 and scale the whole document down to 300px wide.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 900 }, scale: "css" });
  const shot = await browser.newContext({ viewport: { width: 300, height: 188 } });
  const viewer = await shot.newPage();
  await viewer.setContent(
    `<body style="margin:0"><img style="width:300px;display:block" src="data:image/png;base64,${buf.toString("base64")}"></body>`,
  );
  await viewer.waitForTimeout(150);
  await viewer.screenshot({ path: `${out}/${name}-300-${theme}.png` });
  await shot.close();
  await context.close();
}

await browser.close();
console.log(`${name} → ${out}/`);
