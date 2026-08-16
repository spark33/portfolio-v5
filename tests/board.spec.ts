import { expect, test } from "@playwright/test";
import { COLS, clearance, solve, type Block } from "../lib/board.ts";
import { heroBlocks } from "../content/site.ts";

/**
 * The board, verified.
 *
 * The solver runs at build time and cannot measure text, so blocks declare
 * their height in cells. That is only safe if something checks the
 * declarations against reality — which is what the first test here does, and
 * it reports the number to use rather than just failing.
 */

const DESKTOP = { width: 1440, height: 1000 };

/**
 * The board applies from 80rem up, so a declaration is only honest if it holds
 * across that whole range. An earlier version of this file checked 1440 alone
 * and went green while the lede overflowed its cells at 1100 — the cell shrinks
 * with the viewport faster than text does, so the narrow end is the worst case.
 */
const BOARD_WIDTHS = [1280, 1360, 1440, 1600, 1920, 2560];

test.describe("declared heights match reality", () => {
  for (const width of BOARD_WIDTHS) {
  test(`no block overflows the cells it claimed — ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const measured = await page.evaluate(() => {
      // --u is authored as a calc(), and getComputedStyle hands back the
      // unresolved expression for a custom property. Derive the cell from the
      // lattice's real width instead, which is what the board is drawn on.
      const u = document.querySelector(".lattice")!.getBoundingClientRect().width / 19;
      return [...document.querySelectorAll<HTMLElement>(".board-field-block")].map((el) => ({
        id: el.dataset.block!,
        declared: parseFloat(el.style.getPropertyValue("--h")),
        // Round up to the quarter cell the solver works in.
        actual: Math.ceil(el.getBoundingClientRect().height / u / 0.25) * 0.25,
      }));
    });

    expect(measured.length).toBe(heroBlocks.length);

    for (const block of measured) {
      expect(
        block.actual,
        `board block "${block.id}" declares h:${block.declared} cells but renders ` +
          `${block.actual} at ${width}px. Set h to ${block.actual} in content/site.ts.`,
      ).toBeLessThanOrEqual(block.declared);

      // Over-declaring is not an overflow, but it opens dead space under the
      // block that nobody chose — which is exactly what the influence rule is
      // supposed to be deciding.
      expect(
        block.declared - block.actual,
        `board block "${block.id}" declares h:${block.declared} but only needs ` +
          `${block.actual} at ${width}px, leaving ${block.declared - block.actual} ` +
          `cells of dead air.`,
      ).toBeLessThanOrEqual(1);
    }
  });
  }

  test("blocks land exactly where the solver put them", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const solved = solve(heroBlocks);
    const dom = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>(".board-field-block")].map((el) => [
          el.dataset.block,
          {
            row: parseFloat(el.style.getPropertyValue("--row")),
            col: parseFloat(el.style.getPropertyValue("--col")),
          },
        ]),
      ),
    );

    for (const block of solved.placed) {
      expect(dom[block.id], `block ${block.id}`).toEqual({
        row: block.row,
        col: block.col,
      });
    }
  });

  test("nothing sits inside anything else's influence", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);

    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".board-field-block")].map((el) => ({
        id: el.dataset.block!,
        box: el.getBoundingClientRect(),
      })),
    );

    // The rendered boxes must not overlap at all — the claims that produced
    // them are larger still, so this is the weaker of the two guarantees and
    // the one a reader would actually notice being broken.
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].box;
        const b = boxes[j].box;
        const hit =
          a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(hit, `${boxes[i].id} overlaps ${boxes[j].id}`).toBe(false);
      }
    }
  });
});

test.describe("the solver itself", () => {
  const block = (over: Partial<Block>): Block => ({
    id: "x",
    col: 0,
    row: 0,
    w: 4,
    h: 1,
    weight: 1,
    ...over,
  });

  test("the strongest block keeps its intersection", () => {
    const { placed } = solve([
      block({ id: "weak", weight: 1, row: 0 }),
      block({ id: "strong", weight: 4, row: 0 }),
    ]);
    expect(placed.find((p) => p.id === "strong")!.yielded).toBe(0);
    expect(placed.find((p) => p.id === "weak")!.yielded).toBeGreaterThan(0);
  });

  test("blocks in disjoint columns do not push each other", () => {
    const { placed } = solve([
      block({ id: "left", col: 0, w: 5, weight: 3 }),
      block({ id: "right", col: 13, w: 5, weight: 1 }),
    ]);
    // Column 0-5 and column 13-18 cannot see each other even with clearance.
    expect(placed.every((p) => p.yielded === 0)).toBe(true);
  });

  test("clearance grows with weight, so rank buys air", () => {
    expect(clearance(4)).toBeGreaterThan(clearance(1));
  });

  test("a block that can never fit fails loudly", () => {
    // Full-width and heavier than the board is tall: it can never clear.
    const impossible = Array.from({ length: 30 }, (_, i) =>
      block({ id: `b${i}`, col: 0, w: COLS, h: 20, weight: 1 }),
    );
    expect(() => solve(impossible)).toThrow(/could not be placed/);
  });

  test("the solve is deterministic", () => {
    const a = solve(heroBlocks);
    const b = solve([...heroBlocks].reverse());
    expect(a.placed.map((p) => [p.id, p.row]).sort()).toEqual(
      b.placed.map((p) => [p.id, p.row]).sort(),
    );
  });
});

test.describe("the board is quiet by default", () => {
  test("the lattice is present but under the threshold of a drawn grid", async ({ page }) => {
    await page.goto("/");
    const opacity = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector(".lattice-base")!).opacity),
    );
    // Calibrated at 0.10 — contrast 1.087 on paper. Above ~0.16 it reads as
    // graph paper, which is a different design.
    expect(opacity).toBeGreaterThan(0.05);
    expect(opacity).toBeLessThanOrEqual(0.14);
  });

  test("the board is hidden from assistive technology", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".board")).toHaveAttribute("aria-hidden", "true");
  });

  test("?board reveals the lattice without JavaScript being required to read", async ({
    page,
  }) => {
    await page.goto("/?board");
    await expect(page.locator("body")).toHaveClass(/show-board/);
    const opacity = await page.evaluate(() =>
      parseFloat(getComputedStyle(document.querySelector(".lattice-base")!).opacity),
    );
    expect(opacity).toBeGreaterThan(0.3);
  });
});
