import { expect, test } from "@playwright/test";

/**
 * The hero canvas covers the viewport, so whatever it clears to is effectively
 * the page background. If it stops tracking the theme, body text loses its
 * contrast in one scheme — invisibly to any CSS-only check.
 */
test.describe("home", () => {
  for (const { scheme, min, max } of [
    { scheme: "light" as const, min: 0.5, max: 1 },
    { scheme: "dark" as const, min: 0, max: 0.1 },
  ]) {
    test(`the scene clears to the ${scheme} page background`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      await page.waitForFunction(() => document.querySelector("canvas") !== null);

      const brightness = await page.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
        const gl = canvas.getContext("webgl2")!;
        const [r, g, b] = gl.getParameter(gl.COLOR_CLEAR_VALUE) as Float32Array;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      });

      expect(brightness).toBeGreaterThanOrEqual(min);
      expect(brightness).toBeLessThanOrEqual(max);
    });
  }

  test("renders the heading in the site type face without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const family = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontFamily);

    expect(family).toContain("Newsreader");
    expect(errors).toEqual([]);
  });
});
