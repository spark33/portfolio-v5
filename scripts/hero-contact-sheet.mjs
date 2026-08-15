#!/usr/bin/env node
/**
 * Screenshots the Hangul hero's scrub story across the transform and tiles the
 * frames into one contact sheet, so the whole decomposition can be judged in a
 * single image instead of by dragging a slider.
 *
 * Point it at a running Storybook:
 *
 *   npm run storybook
 *   node scripts/hero-contact-sheet.mjs [outDir]
 *
 * Development tool. Output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";
const STORY = "figures-hangul-hero--decomposition";
const OUT = process.argv[2] ?? "shots/hero";

const STEPS = [0, 0.12, 0.25, 0.36, 0.46, 0.56, 0.66, 0.74, 0.82, 0.9, 0.96, 1];
const FRAME = { width: 720, height: 560 };

// Playwright's own resolution logic lives in playwright.config.ts; mirror the
// one bit of it that matters here rather than importing a TS config.
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXECUTABLE) ? EXECUTABLE : undefined,
    // WebGL in headless Chromium needs a rasteriser; SwiftShader is the one
    // that is always present.
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: 1 });
  page.on("console", (msg) => {
    if (msg.type() === "error") process.stderr.write(`page error: ${msg.text()}\n`);
  });
  page.on("pageerror", (err) => process.stderr.write(`page threw: ${err.message}\n`));

  const shots = [];
  for (const step of STEPS) {
    const url = `${BASE}/iframe.html?id=${STORY}&viewMode=story&args=progress:${step}`;
    await page.goto(url, { waitUntil: "networkidle" });
    // The scene renders on demand, so there is nothing to settle beyond the
    // seek itself; this is for the first paint of the geometry.
    await page.waitForTimeout(700);

    const file = path.join(OUT, `p${String(Math.round(step * 100)).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ step, file });
    process.stderr.write(`${file}\n`);
  }

  // Tile them, drawn in the browser we already have open.
  const sheet = await page.evaluate(
    async ({ shots, frame }) => {
      const cols = 4;
      const rows = Math.ceil(shots.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = frame.width * cols;
      canvas.height = frame.height * rows;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (const [i, shot] of shots.entries()) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = shot.dataUrl;
        });
        const x = (i % cols) * frame.width;
        const y = Math.floor(i / cols) * frame.height;
        ctx.drawImage(img, x, y);
        ctx.fillStyle = "#fff";
        ctx.font = "600 22px monospace";
        ctx.fillText(shot.step.toFixed(2), x + 16, y + 34);
      }
      return canvas.toDataURL("image/png");
    },
    {
      frame: FRAME,
      shots: shots.map((s) => ({
        step: s.step,
        dataUrl: `data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}`,
      })),
    },
  );

  const sheetPath = path.join(OUT, "contact-sheet.png");
  fs.writeFileSync(sheetPath, Buffer.from(sheet.split(",")[1], "base64"));
  process.stderr.write(`\nwrote ${sheetPath}\n`);

  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
