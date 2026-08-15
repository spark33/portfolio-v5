#!/usr/bin/env node
/**
 * Filmstrip of the loading animation.
 *
 *   npm run storybook
 *   npm run film                 # 12 frames, dark
 *   npm run film -- 20 light     # 20 frames, light ground
 *
 * Seeks the animation directly rather than waiting on wall-clock time. The
 * animation is a pure function of normalised time, so every frame is exact and
 * the strip is reproducible — which is the difference between iterating on
 * motion and guessing at it.
 *
 * Blind, though, to anything that happens between the moments it asks for. Use
 * `npm run play` to shoot real playback; the two are a pair.
 *
 * Development tool; output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { paintGround, writeSheet } from "./lib/sheet.mjs";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";
const COUNT = Number(process.argv[2] ?? 12);
const GROUND = process.argv[3] ?? "dark";
const OUT = "shots/loader";

const FRAME = { width: 560, height: 300 };
const COLS = 4;
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXECUTABLE) ? EXECUTABLE : undefined,
  });
  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => process.stderr.write(`page threw: ${e.message}\n`));
  page.on("console", (m) => {
    if (m.type() === "error") process.stderr.write(`console: ${m.text()}\n`);
  });

  await page.goto(`${BASE}/iframe.html?id=loader--frame&viewMode=story&args=t:0`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => Boolean(window.__loader));

  await paintGround(page, GROUND);

  const shots = [];
  for (let i = 0; i < COUNT; i++) {
    const t = COUNT === 1 ? 0 : i / (COUNT - 1);
    // Seek, then wait one frame so the attribute writes have been laid out.
    await page.evaluate((value) => {
      window.__loader.seek(value);
    }, t);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));

    const file = path.join(OUT, `f${String(i).padStart(2, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ label: t.toFixed(2), file });
  }

  const out = await writeSheet(page, shots, {
    frame: FRAME,
    cols: COLS,
    ground: GROUND,
    out: path.join(OUT, `film-${GROUND}.png`),
  });
  process.stderr.write(`wrote ${out} (${COUNT} frames)\n`);

  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
