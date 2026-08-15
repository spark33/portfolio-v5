#!/usr/bin/env node
/**
 * Watches the loading animation actually play.
 *
 *   npm run storybook
 *   npm run play                 # 16 frames across one run, dark
 *   npm run play -- 24 light     # 24 frames, light ground
 *
 * The counterpart to `npm run film`, and not a duplicate of it. `film` seeks —
 * exact, reproducible, and blind to anything that only exists between the
 * frames it asks for. This one shoots real rAF playback on a wall clock, so
 * what it captures is what a person sees.
 *
 * That distinction has already earned its keep: the field losing mass and
 * collapsing to a cluster halfway through was invisible in every seeked still
 * and obvious the moment playback was shot at a fixed cadence.
 *
 * Development tool; output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

import { paintGround, writeSheet } from "./lib/sheet.mjs";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";
const COUNT = Number(process.argv[2] ?? 16);
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

  await page.goto(`${BASE}/iframe.html?id=loader--playing&viewMode=story`, {
    waitUntil: "networkidle",
  });
  await paintGround(page, GROUND);
  await page.waitForFunction(() => Boolean(window.__loader));

  // Restarted so a strip begins where the animation does, then sampled a little
  // past the end — the last frames land after the loop has come round, which is
  // the only way to see whether it seams.
  const duration = await page.evaluate(() => {
    window.__loader.stop();
    window.__loader.play();
    return window.__loader.duration;
  });
  const step = Math.round((duration * 1.1) / COUNT);

  const shots = [];
  const startedAt = Date.now();
  for (let i = 0; i < COUNT; i++) {
    const file = path.join(OUT, `p${String(i).padStart(2, "0")}.png`);
    // Timestamped after the shot, not before: the label should say when the
    // pixels were read, and a screenshot is not instant.
    await page.screenshot({ path: file });
    shots.push({ label: `${Date.now() - startedAt}ms`, file });
    await page.waitForTimeout(step);
  }

  const out = await writeSheet(page, shots, {
    frame: FRAME,
    cols: COLS,
    ground: GROUND,
    out: path.join(OUT, `play-${GROUND}.png`),
  });
  process.stderr.write(`wrote ${out} (${COUNT} frames of live playback)\n`);

  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
