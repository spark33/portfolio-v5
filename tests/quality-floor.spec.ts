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

  test("the narrative and its links are complete with JS off", async ({ page }) => {
    await page.goto("/");

    // The page is somebody talking, and the links live inside the sentences.
    await expect(page.locator("h1")).toHaveText(/Hi, I'm Sean Park/);
    const chips = page.locator(".chip");
    expect(await chips.count()).toBeGreaterThanOrEqual(4);

    // Every chip names a thing and the fact that makes it mean something —
    // the nouns here are ones no reader recognises, so the fact is the payload.
    for (const chip of await chips.all()) {
      await expect(chip.locator(".chip-fact")).toHaveCount(1);
      expect((await chip.textContent())!.trim().length).toBeGreaterThan(4);
    }

    // The record in the margin is content, not an enhancement. Assert the
    // figures rather than the container's class name, so renaming the box
    // cannot break the test and an empty box cannot pass it.
    const margin = page.locator(".margin-note");
    await expect(margin).toBeVisible();
    for (const figure of ["400+", "100%", "180k+", "53k"]) {
      await expect(margin).toContainText(figure);
    }
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
    expect(headings.length).toBeGreaterThanOrEqual(3);
    // Each one is a pressure, not a project name.
    for (const heading of headings) expect(heading.trim().length).toBeGreaterThan(20);
  });
});

test.describe("motion is declinable", () => {
  test("the lattice lift is the only motion, and it is optional", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Under reduced motion the pointer lift is not rendered at all, and the
    // ambient lattice — which is the whole design — is untouched.
    await expect(page.locator(".lattice-lift")).toBeHidden();
    await expect(page.locator(".lattice-base")).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("the page is identical when the module never loads", async ({ page }) => {
    await page.route("**/main-*.js", (route) => route.abort());
    await page.goto("/");

    // Nothing about the composition depends on the script.
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator(".margin-note")).toContainText("400+");
    await expect(page.locator(".lattice-base")).toBeVisible();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });
});

test.describe("light and dark", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`text clears WCAG AA in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/work/inherited-mental-model/");

      const samples = await page.evaluate(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        const read = (selector: string) => {
          const el = document.querySelector(selector);
          return el ? { fg: getComputedStyle(el).color, bg } : null;
        };
        return {
          body: read(".field > dd"),
          label: read(".field > dt"),
          cost: read(".field-cost > dt"),
          heading: read("h1"),
        };
      });

      for (const [name, sample] of Object.entries(samples)) {
        expect(sample, name).not.toBeNull();
        expect(
          contrast(rgb(sample!.fg), rgb(sample!.bg)),
          `${name} in ${scheme}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  test("the ground actually changes with the scheme", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    expect(light).not.toBe(dark);
    expect(luminance(rgb(light))).toBeGreaterThan(luminance(rgb(dark)));
  });

  test("an explicit choice overrides the system and survives a reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");

    const toggle = page.locator("[data-theme-toggle]");
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");

    // The head script applies it before first paint, so it holds across a load.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("the lattice stays under the threshold in both themes", async ({ page }) => {
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/");
      const opacity = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.querySelector(".lattice-base")!).opacity),
      );
      // A light line gains on a dark ground far faster than a dark line gains
      // on paper, so the two themes carry different alphas for the same 1.09.
      expect(opacity, scheme).toBeGreaterThan(0.02);
      expect(opacity, scheme).toBeLessThanOrEqual(0.12);
    }
  });
});

test.describe("accessible", () => {
  test("the skip link is reachable and moves focus to the content", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const skip = page.locator("a.skip");
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    // Assert focus, not the URL. An earlier version of this test checked only
    // the hash — which passed while <main> had no tabindex and focus was
    // silently resetting to <body>, i.e. the skip link did nothing at all.
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("interactive targets meet the WCAG 2.2 minimum", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const undersized = await page.evaluate(() =>
      [...document.querySelectorAll("a, button")]
        .map((el) => ({ text: el.textContent!.trim().slice(0, 30), box: el.getBoundingClientRect() }))
        .filter((x) => x.box.width > 0 && x.box.height < 24)
        .map((x) => `${x.text} (${Math.round(x.box.width)}x${Math.round(x.box.height)})`),
    );

    expect(undersized).toEqual([]);
  });

  test("unknown metrics carry real text, not generated content", async ({ page }) => {
    await page.goto("/logician-ui/");

    // A CSS ::before is invisible to reader mode, text extraction and the
    // automated screening the site is partly written for. The chip has to be
    // in the DOM.
    const chips = page.locator(".pending");
    expect(await chips.count()).toBeGreaterThan(0);
    for (const text of await chips.allTextContents()) {
      expect(text.trim()).toBe("not yet measured");
    }
  });

  test("index links are named by their argument, not their metadata", async ({ page }) => {
    await page.goto("/");

    const names = await page.locator(".index-link").evaluateAll((els) =>
      els.map((el) => {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[aria-hidden="true"]').forEach((n) => n.remove());
        return clone.textContent!.replace(/\s+/g, " ").trim();
      }),
    );

    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      // The year and scope repeat on the destination page; in a link name they
      // are noise a screen-reader user has to sit through on every row.
      expect(name).not.toMatch(/\d{4} — \d{4}|INSTITUTIONS|TENANTS|→/i);
    }
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

/**
 * Two defect classes that shipped three times each before anyone noticed, now
 * caught as classes rather than as instances.
 */
test.describe("regressions that keep coming back", () => {
  const NARROW = [320, 360, 390, 414];

  for (const width of NARROW) {
    test(`nothing overflows the viewport at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });

      for (const path of ["/", "/work/", "/work/inherited-mental-model/", "/about/"]) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);

        const escaped = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>("body *")]
            .filter((el) => {
              const box = el.getBoundingClientRect();
              return box.width > 0 && box.right > innerWidth + 1;
            })
            .map((el) => `${el.tagName.toLowerCase()}.${el.className.toString().split(" ")[0]}`)
            .slice(0, 5),
        );

        // `overflow-x: clip` used to hide this, so a chip 28px wider than the
        // column simply lost its last words with no symptom at all.
        expect(escaped, `${path} at ${width}px`).toEqual([]);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${path} scrollWidth at ${width}px`,
        ).toBeLessThanOrEqual(width + 1);
      }
    });
  }

  test("visual separation exists as characters, not only as CSS", async ({ page }) => {
    // Three times now: a ::before placeholder with no text, a <br> hidden on
    // mobile that welded two words together, and a flex gap that rendered
    // "LogicianUIour design system". Gaps, pseudo-content and hidden breaks are
    // invisible to reader mode, text extraction and screen readers.
    for (const path of ["/", "/work/", "/logician-ui/"]) {
      await page.goto(path);

      const text = await page.locator("main").innerText();

      // Whole words, so the allowlist can be checked against the word rather
      // than against a three-character fragment of it — an earlier version
      // matched "tCh" inside "FactChat" and could never clear it.
      const CAMEL_OK = new Set([
        "FactChat",
        "LogicianUI",
        "ChatGPT",
        "JavaScript",
        "WebGL",
        "KWCAG",
        "WCAG",
      ]);

      const welded = (text.match(/[\p{L}\p{N}]+/gu) ?? []).filter(
        (word) => /[a-z0-9][A-Z]/.test(word) && !CAMEL_OK.has(word),
      );

      expect([...new Set(welded)], `${path}: words welded together`).toEqual([]);
    }
  });

  test("no Korean run is broken across lines", async ({ page }) => {
    // The browser's default treats every Hangul syllable as a break
    // opportunity, so 박상현 set as "박상 / 현" in the home page h1 at 1440 and
    // 768 and "박 / 상현" at 390. Korean breaks at word boundaries. A run with
    // no space in it therefore occupies exactly one line box, and the count of
    // client rects is how you find out.
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });

      for (const path of ["/", "/about/", "/work/no-reason-to-return/"]) {
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);

        const split = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('[lang="ko"]')]
            .filter((el) => !/\s/.test(el.textContent ?? ""))
            .filter((el) => el.getClientRects().length > 1)
            .map((el) => el.textContent ?? ""),
        );

        expect(split, `${path} at ${width}px`).toEqual([]);
      }
    }
  });

  test("the index argument is carried by real headings", async ({ page }) => {
    await page.goto("/work/");

    // The brief's test is "read only the eyebrows and headings" — so the
    // constraints have to be headings. They were spans, and the test that
    // claimed otherwise queried the spans and passed.
    const headings = await page.locator("h3").allTextContents();
    expect(headings.length).toBeGreaterThanOrEqual(5);
    for (const heading of headings) {
      expect(heading.trim().length).toBeGreaterThan(20);
    }
  });
});
