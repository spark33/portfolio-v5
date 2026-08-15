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
 * Development tool; output is gitignored.
 */
import fs from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

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

  if (GROUND === "light") {
    // Injected rather than set on a node: the story paints its own background
    // inline, and reaching for a particular element in Storybook's tree is a
    // selector that silently stops matching. The loader inherits its fill from
    // `currentColor`, so overriding the colour is all it takes.
    await page.addStyleTag({
      content: "div { background: #f4f2ee !important; color: #14151a !important; }",
    });
  }

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
    shots.push({ t, file });
  }

  const sheet = await page.evaluate(
    async ({ shots, frame, cols, ground }) => {
      const rows = Math.ceil(shots.length / cols);
      const canvas = document.createElement("canvas");
      canvas.width = frame.width * cols;
      canvas.height = frame.height * rows;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = ground === "light" ? "#f4f2ee" : "#0a0a0c";
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
        ctx.drawImage(img, x, y, frame.width, frame.height);
        ctx.fillStyle = ground === "light" ? "#14151a" : "#e9e6e1";
        ctx.font = "600 15px monospace";
        ctx.globalAlpha = 0.55;
        ctx.fillText(shot.t.toFixed(2), x + 12, y + 24);
        ctx.globalAlpha = 1;
      }
      return canvas.toDataURL("image/png");
    },
    {
      frame: FRAME,
      cols: COLS,
      ground: GROUND,
      shots: shots.map((s) => ({
        t: s.t,
        dataUrl: `data:image/png;base64,${fs.readFileSync(s.file).toString("base64")}`,
      })),
    },
  );

  const sheetPath = path.join(OUT, `film-${GROUND}.png`);
  fs.writeFileSync(sheetPath, Buffer.from(sheet.split(",")[1], "base64"));
  process.stderr.write(`wrote ${sheetPath} (${COUNT} frames)\n`);

  await browser.close();
}

main().catch((err) => {
  process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
