/**
 * The board.
 *
 * 바둑 as the site's substrate rather than its picture. Three rules survive
 * from it, and none of them draw a board:
 *
 *   LATTICE      Nineteen square cells across the measure. Everything places
 *                on an intersection; nothing is nudged or centred by eye.
 *   INFLUENCE    A stone radiates over the space around it, and a stronger
 *                position reaches further. Every block declares a weight, its
 *                clearance follows from that weight, and blocks resolve in
 *                order of initiative — the strongest holds its intersection
 *                and weaker ones yield. Negative space is therefore allocated
 *                by rank rather than left over.
 *   STAR POINTS  A real board's only marks are nine reference dots. They are
 *                the sole thing that surfaces.
 *
 * This module is pure arithmetic and runs at build time. Nothing here measures
 * text, because measuring needs a browser and the site must render complete
 * before any JavaScript. Blocks declare their height in cells instead, and
 * `tests/board.spec.ts` fails the build if a declaration is wrong — reporting
 * the value it should be.
 */

/** Cells across the measure. A 19×19 board. */
export const COLS = 19;

/** Blocks yield a quarter cell at a time. */
export const STEP = 0.25;

/** The nine hoshi of a real board sit at lines 4, 10 and 16. */
export const HOSHI = [4, 10, 16];

/**
 * The solved layout only applies above this width. Below it the blocks flow in
 * document order and keep the lattice, which is the part that works at any size.
 *
 * 80rem rather than 64rem, and the reason is measured. Declared heights are in
 * cells, and the cell shrinks with the viewport faster than text does — so the
 * same paragraph occupies 2.25 cells at 1280px and 4 cells at 1024px. Holding
 * the board open down to 1024 would force every declaration to the 1024 worst
 * case and leave a cell of dead air at every larger size. From 1280 up the
 * measurements are flat, which is what makes a build-time solve honest.
 */
export const BOARD_MIN = "80rem";

export interface Block {
  id: string;
  /** Column of the block's left edge, in cells. */
  col: number;
  /** Preferred row. The solver may move it down, never up. */
  row: number;
  /** Width in cells. */
  w: number;
  /** Height in cells, declared. Verified by tests/board.spec.ts. */
  h: number;
  /** Initiative. Higher holds its ground and claims more air. */
  weight: number;
}

/** The input block, plus how far the solver had to move it. Generic so a
 *  caller's own fields — copy, ids, anything — survive the solve. */
export type Placed<T extends Block = Block> = T & { yielded: number };

export interface Solution<T extends Block = Block> {
  placed: Placed<T>[];
  /** Total field height in cells, including the deepest claim. */
  height: number;
}

interface Claim {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Clearance in cells. The constant is small so a caption still breathes; the
 * coefficient is what makes a headline hold roughly twice the territory of a
 * label, which is the whole reason the page breathes unevenly.
 */
export function clearance(weight: number) {
  return 0.3 + weight * 0.28;
}

function claimOf(block: Block, row = block.row): Claim {
  const c = clearance(block.weight);
  return {
    x0: block.col - c,
    y0: row - c,
    x1: block.col + block.w + c,
    y1: row + block.h + c,
  };
}

function overlaps(a: Claim, b: Claim) {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

/** Guard against a block that can never fit. Loud beats silently sliding away. */
const MAX_STEPS = 400;

/**
 * Resolves a field by initiative.
 *
 * Blocks are placed strongest first. Each one slides down the lattice until it
 * sits outside every claim already on the board. Motion is only ever downward,
 * so the process terminates and the result does not depend on input order
 * beyond the weight ranking.
 */
export function solve<T extends Block>(blocks: T[]): Solution<T> {
  const order = [...blocks].sort((a, b) => b.weight - a.weight || a.col - b.col);
  const claims: Claim[] = [];
  const placed: Placed<T>[] = [];

  for (const block of order) {
    let row = block.row;
    let steps = 0;

    while (claims.some((c) => overlaps(claimOf(block, row), c))) {
      if (steps++ >= MAX_STEPS) {
        throw new Error(
          `board: "${block.id}" could not be placed — it is ${block.w}×${block.h} cells ` +
            `at column ${block.col} and never clears the blocks above it. ` +
            `Narrow it, lighten its weight, or move it to a free column.`,
        );
      }
      row += STEP;
    }

    claims.push(claimOf(block, row));
    placed.push({ ...block, row, yielded: row - block.row });
  }

  return {
    // Back into declaration order so the DOM reads the way it was written.
    placed: blocks.map((b) => placed.find((p) => p.id === b.id)!),
    height: Math.max(...claims.map((c) => c.y1)),
  };
}
