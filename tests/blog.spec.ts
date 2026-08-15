import { expect, test } from "@playwright/test";

const POST = "/blog/cutting-transcript-latency/";

test.describe("blog", () => {
  test("the index lists published posts and links to them", async ({ page }) => {
    await page.goto("/blog/");

    const link = page.getByRole("link", {
      name: "Cutting transcript latency from 4.2s to 380ms",
    });
    await expect(link).toBeVisible();

    await link.click();
    await expect(page).toHaveURL(new RegExp(`${POST}$`));
  });

  test("the production index omits drafts", async ({ page }) => {
    await page.goto("/blog/");

    // The draft is present in content/posts but must not ship.
    await expect(page.getByText("Notes on building this site")).toHaveCount(0);
  });

  test("a post renders its frontmatter and markdown", async ({ page }) => {
    await page.goto(POST);

    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Cutting transcript latency",
    );
    await expect(page.locator("time")).toHaveAttribute("datetime", "2026-03-14");
    await expect(page.locator(".tags li").first()).toBeVisible();

    // Markdown constructs the stylesheet has to cover.
    await expect(page.locator(".prose blockquote")).toBeVisible();
    await expect(page.locator("pre code")).toContainText("stream.on");
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  });

  test("a post uses the site type face and links back to the index", async ({ page }) => {
    await page.goto(POST);
    await page.evaluate(() => document.fonts.ready);

    const family = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain("Newsreader");

    await page.getByRole("link", { name: "All notes" }).click();
    await expect(page).toHaveURL(/\/blog\/$/);
  });

  test("does not scroll horizontally on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(POST);
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
