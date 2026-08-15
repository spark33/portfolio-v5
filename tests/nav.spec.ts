import { expect, test } from "@playwright/test";

const PAGES = ["/", "/blog/", "/blog/cutting-transcript-latency/"];

test.describe("navigation", () => {
  for (const path of PAGES) {
    test(`${path} carries the site nav and links home`, async ({ page }) => {
      await page.goto(path);

      const header = page.locator("header.site-nav");
      await expect(header).toBeVisible();
      await expect(header.getByRole("link", { name: "Notes" })).toBeVisible();

      // The wordmark must be clickable on the home page too, where it sits
      // over the full-viewport canvas.
      await header.getByRole("link", { name: "Portfolio" }).click();
      await expect(page).toHaveURL(/\/$/);
    });
  }

  test("marks the current section", async ({ page }) => {
    await page.goto("/blog/");

    await expect(page.locator("header.site-nav").getByRole("link", { name: "Notes" }))
      .toHaveAttribute("aria-current", "page");
  });

  test("reaches the blog from the home page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Notes" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Notes" })).toBeVisible();
  });
});
