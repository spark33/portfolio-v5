import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Cloud sessions ship a Chromium at a fixed path that will not match the build
 * this Playwright version expects, and `playwright install` is unavailable there.
 * Prefer that binary when it exists; fall back to Playwright's own locally.
 */
const bundled =
  process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = existsSync(bundled) ? bundled : undefined;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: "http://localhost:4173",
    launchOptions: { executablePath },
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run preview -- --port 4173",
    url: "http://localhost:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
