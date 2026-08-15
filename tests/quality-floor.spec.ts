import { expect, test, type Page } from "@playwright/test";

/**
 * The non-negotiables, as tests rather than intentions.
 *
 * A large share of first-pass hiring screening is automated and cannot see
 * anything a script drew. So the rule this file enforces is that the site is
 * complete before JavaScript runs, and that motion is an enhancement which
 * can be declined — by preference, or by having been here before.
 */

const ROUTES = [
  "/",
  "/work/inherited-mental-model/",
  "/work/two-concepts-one-product/",
  "/work/no-reason-to-return/",
  "/logician-ui/",
  "/harness/",
  "/about/",
  "/blog/",
];

/** Relative luminance, per WCAG. */
function luminance([r, g, b]: number[]) {
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number[], b: number[]) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function rgb(value: string) {
  return value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
}

test.describe("readable without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ROUTES) {
    test(`${path} renders its argument with JS off`, async ({ page }) => {
      await page.goto(path);

      // Exactly one h1, and it is not empty.
      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);
      expect((await h1.textContent())?.trim().length).toBeGreaterThan(10);

      // Structured data, which is what an automated screen actually reads.
      const ld = await page.locator('script[type="application/ld+json"]').textContent();
      expect(() => JSON.parse(ld!)).not.toThrow();
      expect(JSON.parse(ld!)["@context"]).toBe("https://schema.org");

      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator(".site-foot")).toBeVisible();
    });
  }

  test("the name sequence is complete with JS off", async ({ page }) => {
    await page.goto("/");

    const steps = page.locator(".name-step");
    await expect(steps).toHaveCount(4);

    // All four encodings present and visible — not waiting on a loader.
    for (const value of ["박상현", "ㅂㅏㄱ", "PARK SANGHYEON", "Sean Park"]) {
      await expect(page.locator(".name-value", { hasText: value }).first()).toBeVisible();
    }
    await expect(steps.first()).toHaveCSS("opacity", "1");
  });

  test("every case study states its constraint before its title", async ({ page }) => {
    await page.goto("/work/inherited-mental-model/");

    // The h1 is the constraint. The project name is subordinate to it.
    await expect(page.locator("h1")).toHaveText(/Users arrived already fluent/);
    await expect(page.locator(".case-title")).toHaveText(/An inherited mental model/);

    // Every decision carries what it cost. A decision with no cost is a preference.
    const decisions = page.locator(".decision");
    const count = await decisions.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      await expect(decisions.nth(i).locator(".field-cost")).toHaveCount(1);
    }
  });

  test("the work index reads as an argument from headings alone", async ({ page }) => {
    await page.goto("/");
    const headings = await page.locator(".index-constraint").allTextContents();
    expect(headings.length).toBeGreaterThanOrEqual(5);
    // Each one is a pressure, not a project name.
    for (const heading of headings) expect(heading.trim().length).toBeGreaterThan(20);
  });
});

test.describe("motion is declinable", () => {
  test("reduced motion leaves the sequence in its final state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // The gate never arms, so nothing was ever hidden.
    await expect(page.locator("html")).not.toHaveAttribute("data-seq", "pending");
    await expect(page.locator(".name-step").first()).toHaveCSS("opacity", "1");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("a repeat visit skips the sequence via the persisted flag", async ({ page }) => {
    await page.goto("/");
    // First visit plays, then records itself.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("sp:name-sequence-seen")))
      .toBe("1");

    await page.reload();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
    await expect(page.locator(".name-step").first()).toHaveCSS("opacity", "1");
  });

  test("the sequence always resolves, even if the module never loads", async ({ page }) => {
    await page.route("**/main-*.js", (route) => route.abort());
    await page.goto("/");

    // The failsafe in the head clears the gate on its own.
    await expect(page.locator("html")).not.toHaveAttribute("data-seq", "pending", {
      timeout: 4000,
    });
    await expect(page.locator(".name-step").first()).toBeVisible();
  });
});

test.describe("accessible", () => {
  test("the skip link is reachable and moves focus to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("focus is always visible", async ({ page }) => {
    await page.goto("/");

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const s = getComputedStyle(el);
        return { width: s.outlineWidth, style: s.outlineStyle };
      });
      if (!outline) continue;
      expect(outline.style).not.toBe("none");
      expect(parseFloat(outline.width)).toBeGreaterThanOrEqual(2);
    }
  });

  test("body and secondary text clear WCAG AA on paper", async ({ page }) => {
    await page.goto("/work/inherited-mental-model/");

    const samples = await page.evaluate(() => {
      const read = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const s = getComputedStyle(el);
        return { fg: s.color, bg: getComputedStyle(document.body).backgroundColor };
      };
      return {
        body: read(".field > dd"),
        label: read(".field > dt"),
        cost: read(".field-cost > dt"),
        title: read("h1"),
      };
    });

    for (const [name, sample] of Object.entries(samples)) {
      expect(sample, name).not.toBeNull();
      const ratio = contrast(rgb(sample!.fg), rgb(sample!.bg));
      expect(ratio, `${name} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test("the current page is marked in the navigation", async ({ page }) => {
    await page.goto("/about/");
    await expect(
      page.locator(".site-nav a[aria-current='page']"),
    ).toHaveText("About");
  });
});

test.describe("no layout shift", () => {
  async function cls(page: Page, path: string) {
    await page.goto(path, { waitUntil: "load" });
    await page.evaluate(() => {
      (window as never as { __cls: number }).__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          hadRecentInput: boolean;
          value: number;
        })[]) {
          if (!entry.hadRecentInput) (window as never as { __cls: number }).__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.waitForTimeout(2500);
    return page.evaluate(() => (window as never as { __cls: number }).__cls);
  }

  for (const path of ["/", "/work/inherited-mental-model/"]) {
    test(`${path} holds still while fonts load`, async ({ page }) => {
      expect(await cls(page, path)).toBeLessThan(0.05);
    });
  }
});

test.describe("crawlable", () => {
  test("robots.txt never advertises a placeholder origin", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain("User-agent: *");
    expect(body).not.toContain("example.com");

    // The sitemap is only written when SITE_ORIGIN (or Vercel's hostname) says
    // what the origin is, so robots may legitimately not reference one.
    const advertised = /Sitemap: (\S+)/.test(body);
    const xml = await (await request.get("/sitemap.xml")).text();

    if (!advertised) {
      // No origin was configured, so no sitemap should have been written.
      // `vite preview` answers unmatched paths with the HTML fallback rather
      // than a 404, so the invariant to check is that no urlset is served —
      // not the status code, which belongs to the dev server.
      expect(xml).not.toContain("<urlset");
      return;
    }

    // An unrecognised namespace makes the whole file unparseable to a crawler.
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).not.toContain("example.com");
  });
});

test.describe("every case study is its own URL", () => {
  for (const path of ROUTES) {
    test(`${path} is directly linkable and titled`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(await page.title()).toMatch(/Sean Park|Head of product/);
      const description = await page
        .locator('meta[name="description"]')
        .getAttribute("content");
      expect(description?.length ?? 0).toBeGreaterThan(40);
    });
  }
});
