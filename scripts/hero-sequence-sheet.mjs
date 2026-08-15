#!/usr/bin/env node
/**
 * Contact sheet of the whole hero sequence, tiled into one image.
 *
 *   npm run storybook
 *   node scripts/hero-sequence-sheet.mjs
 *
 * Development tool; output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";
const STORY = "figures-hero--scrub";
const OUT = "shots/hero-sequence";
const STEPS = [0, 0.3, 0.42, 0.52, 0.62, 0.7, 0.78, 0.86, 0.92, 0.96, 0.98, 1];
const FRAME = { width: 640, height: 470 };
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXECUTABLE) ? EXECUTABLE : undefined,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => process.stderr.write(`page threw: ${e.message}\n`));
  page.on("console", (m) => {
    if (m.type() === "error") process.stderr.write(`console: ${m.text()}\n`);
  });

  const shots = [];
  for (const step of STEPS) {
    await page.goto(
      `${BASE}/iframe.html?id=${STORY}&viewMode=story&args=progress:${step}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(1100);
    const file = path.join(OUT, `p${String(Math.round(step * 100)).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ step, file });
  }

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
        await new Promise((ok, no) => {
          img.onload = ok;
          img.onerror = no;
          img.src = shot.dataUrl;
        });
        const x = (i % cols) * frame.width;
        const y = Math.floor(i / cols) * frame.height;
        ctx.drawImage(img, x, y);
        ctx.fillStyle = "#fff";
        ctx.font = "600 20px monospace";
        ctx.fillText(`${(shot.step * 9.5).toFixed(2)}s`, x + 14, y + 30);
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

  const sheetPath = path.join(OUT, "sheet.png");
  fs.writeFileSync(sheetPath, Buffer.from(sheet.split(",")[1], "base64"));
  process.stderr.write(`wrote ${sheetPath}\n`);
  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
