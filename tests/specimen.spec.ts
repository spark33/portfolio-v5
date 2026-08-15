import { expect, test } from "@playwright/test";

const TREATMENTS = [
  { name: "editorial", family: "Newsreader" },
  { name: "swiss", family: "Inter Tight" },
  { name: "technical", family: "IBM Plex Sans" },
] as const;

/** Seeds the stored settings the page reads before first paint. */
async function open(page: import("@playwright/test").Page, treatment: string) {
  await page.addInitScript(
    (value) => localStorage.setItem("specimen", JSON.stringify({ treatment: value })),
    treatment,
  );
  await page.goto("/specimen/");
  await page.evaluate(() => document.fonts.ready);
}

test.describe("type specimen", () => {
  test("defaults to the chosen Editorial system", async ({ page }) => {
    await page.goto("/specimen/");
    await page.evaluate(() => document.fonts.ready);

    await expect(page.locator("html")).toHaveAttribute("data-treatment", "editorial");
    await expect(page.getByRole("radio", { name: "Editorial" })).toBeChecked();
  });

  for (const { name, family } of TREATMENTS) {
    test(`${name} resolves to a real webfont, not a fallback`, async ({ page }) => {
      await open(page, name);

      // A missing @font-face would silently fall through to the system stack.
      const loaded = await page.evaluate(
        (want) =>
          [...document.fonts].some((f) => f.family === want && f.status === "loaded"),
        family,
      );
      expect(loaded, `${family} should be loaded`).toBe(true);

      const applied = await page
        .locator("h1")
        .evaluate((el) => getComputedStyle(el).fontFamily);
      expect(applied).toContain(family);
    });
  }

  test("controls persist across a reload", async ({ page }) => {
    await page.goto("/specimen/");
    // The radio itself is pointer-events:none; the label is the real target.
    await page.locator('label:has(input[value="technical"])').click();
    await expect(page.getByRole("radio", { name: "Technical" })).toBeChecked();
    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-treatment", "technical");
  });

  test("the dark accent meets AA against the dark background", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/specimen/");

    // Read resolved colours off real elements: custom properties are authored as
    // hex, but getComputedStyle on a paint property always yields rgb().
    const ratio = await page.evaluate(() => {
      const channels = (value: string) =>
        value.match(/[\d.]+/g)!.slice(0, 3).map(Number);
      const luminance = (rgb: number[]) => {
        const [r, g, b] = rgb.map((c) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      const link = document.querySelector(".prose a")!;
      const a = luminance(channels(getComputedStyle(link).color));
      const b = luminance(channels(getComputedStyle(document.body).backgroundColor));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });

    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test("does not scroll horizontally on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/specimen/");
    await page.evaluate(() => document.fonts.ready);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
