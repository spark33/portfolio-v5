/**
 * Regenerates page screenshots into shots/ (gitignored).
 *
 * Uses the same Chromium resolution as playwright.config.ts, and expects a
 * preview server on :4173 — start one with `npm run preview -- --port 4173`.
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = "shots";
const THEMES = ["light", "dark"];
const PAGES = [
  { name: "home", path: "/" },
  { name: "blog", path: "/blog/" },
  { name: "post", path: "/blog/cutting-transcript-latency/" },
];

const bundled = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(bundled) ? bundled : undefined;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath });

for (const theme of THEMES) {
  for (const { name, path } of PAGES) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1000 },
      deviceScaleFactor: 2,
      colorScheme: theme,
    });

    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const file = `${OUT}/${theme}-${name}.png`;
    await page.screenshot({ path: file });
    console.log(file);
    await page.close();
  }
}

await browser.close();
