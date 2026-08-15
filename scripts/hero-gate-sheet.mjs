#!/usr/bin/env node
/**
 * Contact sheet for the hero gate: one morph pair across its whole range,
 * tiled into a single image.
 *
 *   npm run storybook
 *   node scripts/hero-gate-sheet.mjs [pair] [spin]
 *
 * Judging a morph by dragging a slider means never seeing two frames at once,
 * which is exactly what is needed to spot a contour unwinding. Development
 * tool; output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = process.env.STORYBOOK_URL ?? "http://localhost:6006";
const STORY = "figures-hero-gate--one-morph";
const PAIR = process.argv[2] ?? "6";
const SPIN = process.argv[3] ?? "0";
const OUT = "shots/hero-gate";

const STEPS = [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1];
const FRAME = { width: 560, height: 520 };
const EXECUTABLE = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({
    executablePath: fs.existsSync(EXECUTABLE) ? EXECUTABLE : undefined,
    args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader"],
  });

  const page = await browser.newPage({ viewport: FRAME, deviceScaleFactor: 1 });
  page.on("pageerror", (err) => process.stderr.write(`page threw: ${err.message}\n`));
  page.on("console", (msg) => {
    if (msg.type() === "error") process.stderr.write(`console: ${msg.text()}\n`);
  });

  const shots = [];
  for (const step of STEPS) {
    const args = `pair:${PAIR};progress:${step};spin:${SPIN}`;
    await page.goto(`${BASE}/iframe.html?id=${STORY}&viewMode=story&args=${encodeURIComponent(args)}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(900);

    const file = path.join(OUT, `p${String(Math.round(step * 100)).padStart(3, "0")}.png`);
    await page.screenshot({ path: file });
    shots.push({ step, file });
  }

  const sheet = await page.evaluate(
    async ({ shots, frame, label }) => {
      const cols = 3;
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
        ctx.font = "600 20px monospace";
        ctx.fillText(`${label} ${shot.step.toFixed(2)}`, x + 14, y + 30);
      }
      return canvas.toDataURL("image/png");
    },
    {
      frame: FRAME,
      label: PAIR,
      shots: shots.map((s) => ({
        step: s.step,
        dataUrl: `data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}`,
      })),
    },
  );

  const sheetPath = path.join(OUT, `sheet-pair${PAIR}-spin${SPIN}.png`);
  fs.writeFileSync(sheetPath, Buffer.from(sheet.split(",")[1], "base64"));
  process.stderr.write(`wrote ${sheetPath}\n`);

  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
