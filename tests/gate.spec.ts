import { expect, test } from "@playwright/test";

/**
 * The curtain the loading animation plays on.
 *
 * Everything here is a way the curtain could fail to lift, which is the only
 * failure mode that matters: a decorative panel that gets stuck is a site that
 * cannot be read. It is in the markup and removed by script, so the cases where
 * the script decides *not* to play are exactly the cases that could strand it.
 */
test.describe("loading gate", () => {
  test("covers the page on the first visit and lifts on its own", async ({ page }) => {
    await page.goto("/");

    const gate = page.locator("#gate");
    await expect(gate).toBeVisible();
    // Painted opaque in the page's own background, so lifting it reveals the
    // site rather than crossfading two different grounds.
    await expect(gate).toHaveCSS("opacity", "1");

    await expect(gate).toHaveCount(0, { timeout: 10_000 });
  });

  test("lifts early when asked, and stays gone", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#gate")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.locator("#gate")).toHaveCount(0, { timeout: 3000 });

    // Once per session: a curtain you cannot get past is a toll booth.
    await page.reload();
    await expect(page.locator("#gate")).toHaveCount(0);
  });

  test("is never shown to reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Removed outright rather than held as a still frame. A full-screen panel
    // over the page for four seconds is worse than no animation.
    await expect(page.locator("#gate")).toHaveCount(0);
  });

  test("never blocks the page it is covering", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#gate")).toBeVisible();

    // The content underneath is complete and in the accessibility tree the
    // whole time — the curtain is `aria-hidden` decoration over a finished
    // page, not a stand-in for one.
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    await expect(page.locator("#gate")).toHaveAttribute("aria-hidden", "true");
  });
});
