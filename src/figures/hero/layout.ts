import { MESHES } from "./hero-geometry.ts";
import type { MeshEntry } from "./hero-geometry.ts";

/**
 * Where every mesh sits in each of the four states.
 *
 *   박상현            composed, three syllable blocks
 *   ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ   the parts, in a line
 *   PARK SANGHYEON   true romanisation, one Latin glyph per phoneme
 *   SEAN PARK        the name he goes by
 *
 * The last step is deliberately lossy. Nothing morphs into "Sean" because
 * nothing produced it — that name was chosen, not derived. So SEAN's four
 * glyphs arrive as new objects while SANGHYEON's nine recede, and only PARK
 * carries through. Transliteration is mechanical; the English name is a
 * decision, and the asymmetry is the point.
 *
 * Everything is in cap heights.
 */

export interface Pose {
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  /** 0 = the jamo outline, 1 = the Latin one. */
  morph: number;
  opacity: number;
}

export interface Placed {
  entry: MeshEntry;
  composed: Pose;
  line: Pose;
  roman: Pose;
  final: Pose;
  /** True for the nine glyphs of SANGHYEON, which recede in the last stage. */
  recedes: boolean;
}

export interface HeroLayout {
  placed: Placed[];
  /** Width of each state, for framing. */
  widths: { composed: number; line: number; roman: number; final: number };
}

// ---------------------------------------------------------------------------
// Hangul blocks
// ---------------------------------------------------------------------------

const BLOCK = { size: 1.16, gap: 0.1 };

/**
 * Cells for an initial + vertical-vowel + final block, in block-local units.
 *
 * Hangul block layout is positional, not metric — it comes from each jamo's
 * role and the vowel's orientation, and none of it is in the font. All three
 * syllables of 박상현 share one structure, so one set of cells covers the
 * name; a horizontal-vowel syllable would need a second, and there is none
 * here.
 *
 * The vowel stops short of the bottom because the final sits under the whole
 * block rather than under the initial alone — letting it run to y = 0 is the
 * most common way a synthesised block looks wrong.
 */
const CELLS: Record<string, { x: number; y: number; width: number; height: number }> = {
  initial: { x: 0.05, y: 0.42, width: 0.47, height: 0.53 },
  vowel: { x: 0.58, y: 0.36, width: 0.37, height: 0.62 },
  final: { x: 0.09, y: 0.03, width: 0.78, height: 0.31 },
};

/** Scale of the jamo when they stand alone in a line. */
const JAMO_SCALE = 0.78;
/** Gap between jamo inks in the line, and the wider gap between syllables. */
const JAMO_GAP = 0.18;
const SYLLABLE_GAP = 0.46;

/** Letterspacing added to every advance in the two Latin lines. */
const TRACKING = 0.035;
/** Word space between PARK and SANGHYEON, and between SEAN and PARK. */
const WORD_SPACE = 0.42;

/**
 * Depth offset between the copies of a jamo that will split.
 *
 * ㄱ becomes both R and K, so two meshes share one jamo's place until the
 * morph pulls them apart. Exactly coincident they would z-fight; a hair of
 * separation is invisible and stable.
 */
const SPLIT_EPSILON = 0.0015;

/** How far the receding romanisation travels back, and how small it gets. */
const RECEDE = { z: -2.6, scale: 0.72 };

/** Where SEAN arrives from — above and in front, fading up as it settles. */
const ARRIVE = { y: 0.5, z: 1.4 };

function pose(partial: Partial<Pose>): Pose {
  return { x: 0, y: 0, z: 0, scaleX: 1, scaleY: 1, morph: 0, opacity: 1, ...partial };
}

/** Fits a glyph's source ink into a block cell, stretching each axis. */
function fitToCell(
  entry: MeshEntry,
  cell: { x: number; y: number; width: number; height: number },
  originX: number,
  originY: number,
): Pose {
  const [x1, y1, x2, y2] = entry.sourceBounds;
  const scaleX = (cell.width * BLOCK.size) / (x2 - x1);
  const scaleY = (cell.height * BLOCK.size) / (y2 - y1);

  // The geometry is centred on its own ink, so the ink centre sits at the
  // bounds' midpoint in local space; scale that and put it at the cell centre.
  const inkX = (x1 + x2) / 2;
  const inkY = (y1 + y2) / 2;

  return pose({
    x: originX + (cell.x + cell.width / 2) * BLOCK.size - inkX * scaleX,
    y: originY + (cell.y + cell.height / 2) * BLOCK.size - inkY * scaleY,
    scaleX,
    scaleY,
  });
}

export function buildLayout(): HeroLayout {
  const morphs = MESHES.filter((entry) => entry.kind === "morph");
  const arrivals = MESHES.filter((entry) => entry.kind === "arrive");

  // --- Composed 박상현 -----------------------------------------------------
  const composedWidth = 3 * BLOCK.size + 2 * BLOCK.gap;
  const blockX = (syllable: number) =>
    -composedWidth / 2 + syllable * (BLOCK.size + BLOCK.gap);

  const composed = new Map<string, Pose>();
  for (const entry of morphs) {
    composed.set(
      entry.name,
      fitToCell(entry, CELLS[entry.role!], blockX(entry.syllable!), -BLOCK.size / 2),
    );
  }

  // --- The jamo, in a line -------------------------------------------------
  // Laid out by ink rather than by advance: these are standalone jamo, not a
  // set line of text, and their advances are all identical full widths that
  // would leave them floating in wide, uneven gaps.
  const jamoOrder = [...new Set(morphs.map((entry) => entry.jamoIndex!))].sort((a, b) => a - b);

  let pen = 0;
  const jamoX = new Map<number, { x: number; width: number }>();
  for (const jamoIndex of jamoOrder) {
    const entry = morphs.find((m) => m.jamoIndex === jamoIndex)!;
    const [x1, , x2] = entry.sourceBounds;
    const width = (x2 - x1) * JAMO_SCALE;

    // A wider gap between syllables keeps 박 / 상 / 현 legible as three groups
    // even after the blocks have opened.
    if (jamoIndex > 0) {
      const previous = morphs.find((m) => m.jamoIndex === jamoIndex - 1)!;
      pen += previous.syllable === entry.syllable ? JAMO_GAP : SYLLABLE_GAP;
    }

    jamoX.set(jamoIndex, { x: pen + width / 2, width });
    pen += width;
  }

  const lineWidth = pen;
  for (const [, slot] of jamoX) slot.x -= lineWidth / 2;

  // --- PARK SANGHYEON ------------------------------------------------------
  // Real typesetting: advance widths, tracking, baseline on zero.
  let romanPen = 0;
  const roman = new Map<string, Pose>();
  morphs.forEach((entry, index) => {
    if (index === 4) romanPen += WORD_SPACE; // after PARK
    roman.set(
      entry.name,
      pose({
        x: entry.targetOrigin[0] + romanPen,
        y: entry.targetOrigin[1],
        morph: 1,
      }),
    );
    romanPen += entry.targetAdvance + TRACKING;
  });

  const romanWidth = romanPen - TRACKING;
  for (const [, p] of roman) p.x -= romanWidth / 2;

  // --- SEAN PARK -----------------------------------------------------------
  // SEAN's four arrive; PARK's four are the same meshes that came from 박, and
  // they translate across. SANGHYEON's nine are not here at all.
  const parkNames = morphs.slice(0, 4).map((entry) => entry.name);

  let finalPen = 0;
  const final = new Map<string, Pose>();

  for (const entry of arrivals) {
    final.set(
      entry.name,
      pose({ x: entry.targetOrigin[0] + finalPen, y: entry.targetOrigin[1] }),
    );
    finalPen += entry.targetAdvance + TRACKING;
  }

  finalPen += WORD_SPACE;

  for (const name of parkNames) {
    const entry = morphs.find((m) => m.name === name)!;
    final.set(
      name,
      pose({ x: entry.targetOrigin[0] + finalPen, y: entry.targetOrigin[1], morph: 1 }),
    );
    finalPen += entry.targetAdvance + TRACKING;
  }

  const finalWidth = finalPen - TRACKING;
  for (const [, p] of final) p.x -= finalWidth / 2;

  // --- Assemble ------------------------------------------------------------
  const placed: Placed[] = [];

  for (const entry of morphs) {
    const slot = jamoX.get(entry.jamoIndex!)!;
    const [x1, y1, x2, y2] = entry.sourceBounds;

    // Every copy of a splitting jamo shares one place until the morph divides
    // them, so 박상현 and the jamo line both show nine parts, not thirteen.
    const depth = entry.splitIndex! * SPLIT_EPSILON;

    const composedPose = composed.get(entry.name)!;
    composedPose.z = depth;

    const linePose = pose({
      x: slot.x - ((x1 + x2) / 2) * JAMO_SCALE,
      y: -((y1 + y2) / 2) * JAMO_SCALE,
      z: depth,
      scaleX: JAMO_SCALE,
      scaleY: JAMO_SCALE,
    });

    const romanPose = roman.get(entry.name)!;
    const recedes = !parkNames.includes(entry.name);

    placed.push({
      entry,
      composed: composedPose,
      line: linePose,
      roman: romanPose,
      recedes,
      final: recedes
        ? pose({
            // Straight back, not sideways: the excess is dropping out of the
            // name, and moving it aside would read as it going somewhere.
            x: romanPose.x,
            y: romanPose.y,
            z: RECEDE.z,
            scaleX: RECEDE.scale,
            scaleY: RECEDE.scale,
            morph: 1,
            opacity: 0,
          })
        : final.get(entry.name)!,
    });
  }

  for (const entry of arrivals) {
    const target = final.get(entry.name)!;
    // The three earlier states are the same pose the glyph will settle into,
    // lifted and pushed forward with no opacity — so it has somewhere to
    // arrive from, and is absent until it does.
    const waiting = pose({
      x: target.x,
      y: target.y + ARRIVE.y,
      z: ARRIVE.z,
      opacity: 0,
    });

    placed.push({
      entry,
      composed: waiting,
      line: waiting,
      roman: waiting,
      final: target,
      recedes: false,
    });
  }

  return {
    placed,
    widths: {
      composed: composedWidth,
      line: lineWidth,
      roman: romanWidth,
      final: finalWidth,
    },
  };
}
