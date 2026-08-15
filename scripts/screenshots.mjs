/**
 * Regenerates specimen screenshots into shots/ (gitignored).
 *
 * Uses the same Chromium resolution as playwright.config.ts, and expects a
 * preview server on :4173 — start one with `npm run preview -- --port 4173`.
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:4173";
const OUT = "shots";
const TREATMENTS = ["editorial", "swiss", "technical"];
const THEMES = ["light", "dark"];

const bundled = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";
const executablePath = existsSync(bundled) ? bundled : undefined;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath });

for (const theme of THEMES) {
  for (const treatment of TREATMENTS) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 1100 },
      deviceScaleFactor: 2,
      colorScheme: theme,
    });

    await page.addInitScript(
      ([t, th]) =>
        localStorage.setItem("specimen", JSON.stringify({ treatment: t, theme: th })),
      [treatment, theme],
    );
    await page.goto(`${BASE}/specimen/`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);

    const file = `${OUT}/${theme}-${treatment}.png`;
    await page.screenshot({ path: file });
    console.log(file);
    await page.close();
  }
}

await browser.close();
