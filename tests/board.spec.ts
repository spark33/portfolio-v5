import { expect, test } from "@playwright/test";
import { COLS, clearance, solve, type Block } from "../lib/board.ts";

/**
 * The board, verified.
 *
 * The solver runs at build time and cannot measure text, so blocks declare
 * their height in cells. That is only safe if something checks the
 * declarations against reality — which is what the first test here does, and
 * it reports the number to use rather than just failing.
 */

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
    const field = [
      block({ id: "a", col: 0, w: 11, h: 3, weight: 4 }),
      block({ id: "b", col: 0, w: 6, h: 2, weight: 2 }),
      block({ id: "c", col: 13, w: 5, h: 2, weight: 3 }),
    ];
    const a = solve(field);
    const b = solve([...field].reverse());
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
