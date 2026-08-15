#!/usr/bin/env node
/**
 * Builds the hero's morph geometry. Runs once, at build time — nothing here
 * happens in a browser, and no font is ever parsed at runtime.
 *
 *   npm run build:hero
 *
 * The problem this solves: morphing between glyph outlines that have different
 * vertex counts, different contour counts, and different topology (ㅇ has a
 * hole, N does not). The approach is contour matching — every outline is
 * resampled to a fixed vertex count, contours are paired between source and
 * target, and the pair shares one index buffer so a vertex shader can `mix()`
 * between two position sets. Topology changes are absorbed by degenerate
 * contours: where one side lacks a hole, its counterpart collapses to a point
 * and the hole closes smoothly instead of popping.
 *
 * Staying in a vertex `mix()` is what keeps the whole thing inside
 * MeshPhysicalMaterial, so image-based lighting, shadows and tone mapping all
 * work normally.
 *
 * Output: hero-geometry.bin (typed arrays) and hero-geometry.ts (the manifest
 * describing them). Both are committed.
 */
import fs from "node:fs";
import path from "node:path";

import earcut from "earcut";
import opentype from "opentype.js";

// Pretendard covers Hangul and Latin in one family, drawn together. §5.5 of
// the spec asks for a Latin companion matched on cap height, stroke weight and
// counter size — taking both scripts from one family makes that structural
// rather than a judgement call. Pinned as a devDependency, so the lockfile
// fixes the version and the bake is reproducible.
const FONT = "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf";

const DIR = path.join("src", "figures", "hero");
const BIN = path.join(DIR, "hero-geometry.bin");
const MANIFEST = path.join(DIR, "hero-geometry.ts");

/**
 * Points per contour after arc-length resampling.
 *
 * Every contour in the file has exactly this many points, which is what makes
 * a shared index buffer possible at all.
 */
const N = Number(process.env.HERO_N ?? 256);

/**
 * Chordal tolerance for flattening Béziers, in font units.
 *
 * The spec calls for 0.15 at a 1000-unit em; Pretendard's em is 2048, so this
 * is that figure scaled. Flattening is adaptive rather than a fixed
 * subdivision count — a fixed count facets tight curves visibly while spending
 * the same vertices on straight runs that need none.
 */
const TOLERANCE = 0.15 * (2048 / 1000);

/** Extrusion, in cap heights. */
const DEPTH = 0.17;
const BEVEL_SIZE = 0.018;
const BEVEL_THICKNESS = 0.018;

/** Miter clamp for the bevel offset, so sharp corners do not shoot to infinity. */
const MITER_LIMIT = 2.4;

/**
 * How the intra-glyph stagger is divided between a smooth sweep across the
 * glyph and a per-contour offset. They must sum to 1.
 *
 * Both terms are spatially coherent, and that is the whole requirement. The
 * seed cannot be per-vertex random: neighbouring points on an outline are a
 * continuous curve, and giving them independent start times tears the
 * silhouette into a saw — the morph passes through a shredded mess between two
 * clean endpoints. A smooth gradient makes the glyph deform like a sheet being
 * drawn through, and the per-contour term keeps separate strokes from moving
 * in lockstep, which is what the stagger was actually for.
 */
const STAGGER_MIX = { sweep: 0.68, contour: 0.32 };

/**
 * Deterministic PRNG (mulberry32). The output of this script is committed, so
 * Math.random would make every re-run a diff.
 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. Outline extraction
// ---------------------------------------------------------------------------

/** Perpendicular distance from a point to the line through a and b. */
function deviation(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq;
  const cx = a[0] + t * dx;
  const cy = a[1] + t * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}

/** Adaptive subdivision of a quadratic Bézier, appending to `out`. */
function flattenQuadratic(p0, c, p1, out, depth = 0) {
  if (depth > 16 || deviation(c, p0, p1) <= TOLERANCE) {
    out.push(p1);
    return;
  }
  const m0 = [(p0[0] + c[0]) / 2, (p0[1] + c[1]) / 2];
  const m1 = [(c[0] + p1[0]) / 2, (c[1] + p1[1]) / 2];
  const mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2];
  flattenQuadratic(p0, m0, mid, out, depth + 1);
  flattenQuadratic(mid, m1, p1, out, depth + 1);
}

/** Adaptive subdivision of a cubic Bézier — Pretendard is CFF, so this is the
 *  one that does the work. */
function flattenCubic(p0, c0, c1, p1, out, depth = 0) {
  const flat = Math.max(deviation(c0, p0, p1), deviation(c1, p0, p1));
  if (depth > 16 || flat <= TOLERANCE) {
    out.push(p1);
    return;
  }
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const a = mid(p0, c0);
  const b = mid(c0, c1);
  const c = mid(c1, p1);
  const d = mid(a, b);
  const e = mid(b, c);
  const f = mid(d, e);
  flattenCubic(p0, a, d, f, out, depth + 1);
  flattenCubic(f, e, c, p1, out, depth + 1);
}

/** Extracts a glyph's outline as closed polylines, in font units, y-up. */
function outline(font, char) {
  const glyph = font.charToGlyph(char);
  if (!glyph || glyph.index === 0) {
    throw new Error(`${char} (U+${char.codePointAt(0).toString(16)}) is not in the font`);
  }

  const contours = [];
  let current = null;
  let cursor = null;

  for (const cmd of glyph.path.commands) {
    switch (cmd.type) {
      case "M":
        if (current && current.length > 2) contours.push(current);
        cursor = [cmd.x, cmd.y];
        current = [cursor];
        break;
      case "L":
        cursor = [cmd.x, cmd.y];
        current.push(cursor);
        break;
      case "Q":
        flattenQuadratic(cursor, [cmd.x1, cmd.y1], [cmd.x, cmd.y], current);
        cursor = [cmd.x, cmd.y];
        break;
      case "C":
        flattenCubic(cursor, [cmd.x1, cmd.y1], [cmd.x2, cmd.y2], [cmd.x, cmd.y], current);
        cursor = [cmd.x, cmd.y];
        break;
      case "Z":
        if (current && current.length > 2) contours.push(current);
        current = null;
        break;
      default:
        throw new Error(`unhandled path command ${cmd.type}`);
    }
  }
  if (current && current.length > 2) contours.push(current);

  // A closing point duplicated on the start would give the resampler a
  // zero-length segment to trip over.
  return contours.map((points) => {
    const last = points[points.length - 1];
    const first = points[0];
    if (Math.hypot(last[0] - first[0], last[1] - first[1]) < 1e-6) points.pop();
    return points;
  });
}

// ---------------------------------------------------------------------------
// 2. Contour normalisation
// ---------------------------------------------------------------------------

/** Shoelace. Positive is counter-clockwise in a y-up space. */
function signedArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

function centroid(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > point[1] !== yj > point[1]) {
      const x = ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
      if (point[0] < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Classifies contours into shells and holes by containment depth, and fixes
 * their winding: solid always on the left, so outer contours run
 * counter-clockwise and holes clockwise.
 *
 * Depth rather than index order, because a glyph can have several disjoint
 * shells — ㅕ is three separate strokes — and "the first contour is the outer
 * one" is wrong the moment that happens. Consistent winding is also what lets
 * the bevel offset use a single inward direction everywhere.
 */
function classify(contours) {
  const classified = contours.map((points) => {
    // A point *on* the contour, not its centroid.
    //
    // A centroid is not necessarily inside its own contour, and for the one
    // shape that matters most here it definitively is not: the outer ring of
    // ㅇ has its centroid in the middle of the counter, so testing that point
    // reports the outer contour as being contained by its own hole. Every
    // contour then classifies as a hole, the glyph has no shell left to
    // triangulate, and the caps come out empty — which renders as a hollow
    // outline. A vertex is always on the boundary of its own contour and
    // strictly inside or outside every other one.
    const probe = points[0];
    const depth = contours.filter(
      (other) => other !== points && pointInPolygon(probe, other),
    ).length;
    return { points, isHole: depth % 2 === 1, depth };
  });

  for (const contour of classified) {
    const ccw = signedArea(contour.points) > 0;
    // Outer contours counter-clockwise, holes clockwise.
    if (ccw === contour.isHole) contour.points.reverse();
  }

  // Ordered by absolute area, descending: the pairing step matches by rank,
  // and rank by area is the most stable correspondence available without
  // solving shape matching properly.
  return classified.sort(
    (a, b) => Math.abs(signedArea(b.points)) - Math.abs(signedArea(a.points)),
  );
}

// ---------------------------------------------------------------------------
// 3. Arc-length resampling
// ---------------------------------------------------------------------------

/**
 * Resamples a closed contour to exactly N points, spaced by arc length,
 * starting from a canonical seed.
 *
 * Arc length rather than parameter value: parameter-spaced points bunch at
 * corners and starve long straight runs, and during a morph that bunching
 * shows up as a rubber-band artefact where one region of the outline drags
 * while the rest moves cleanly.
 *
 * The seed is the topmost point, leftmost on a tie. Both sides of a pair pick
 * theirs the same way, which gets the correspondence close before the rotation
 * search refines it.
 */
function resample(points, count) {
  let seed = 0;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i];
    const [sx, sy] = points[seed];
    if (y > sy || (y === sy && x < sx)) seed = i;
  }

  const ordered = [...points.slice(seed), ...points.slice(0, seed)];

  const lengths = [];
  let perimeter = 0;
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i];
    const b = ordered[(i + 1) % ordered.length];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(length);
    perimeter += length;
  }

  const out = [];
  const step = perimeter / count;
  let edge = 0;
  let consumed = 0;

  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (edge < lengths.length - 1 && consumed + lengths[edge] < target) {
      consumed += lengths[edge];
      edge++;
    }
    const t = lengths[edge] === 0 ? 0 : (target - consumed) / lengths[edge];
    const a = ordered[edge];
    const b = ordered[(edge + 1) % ordered.length];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }

  return out;
}

// ---------------------------------------------------------------------------
// 4. Matching
// ---------------------------------------------------------------------------

/**
 * Rotates `target`'s point order to line up with `source`.
 *
 * This is the step that matters most. Two contours resampled independently
 * start at whatever their own seed happened to be, and interpolating between
 * mismatched orders makes the glyph unwind and cartwheel — the single most
 * recognisable way a contour morph looks wrong. Brute-forcing all N offsets is
 * O(N²) per contour, which is nothing at build time.
 *
 * Rotation only — never reversal. Reversal looks like a cheap way to handle a
 * pairing whose two contours run opposite ways, and it is a trap: winding here
 * is not decoration, it carries the solid side. Classification has already set
 * every outer contour counter-clockwise and every hole clockwise, and
 * reversing one to win a few units of matching cost silently inverts the bevel
 * offset, the wall normals and the cap winding for that contour. With winding
 * normalised beforehand, paired contours already agree, and there is nothing
 * for a reversal to fix.
 */
function alignRotation(source, target) {
  let best = target;
  let bestCost = Infinity;

  for (let offset = 0; offset < target.length; offset++) {
    let cost = 0;
    for (let i = 0; i < source.length; i++) {
      const s = source[i];
      const t = target[(i + offset) % target.length];
      const dx = s[0] - t[0];
      const dy = s[1] - t[1];
      cost += dx * dx + dy * dy;
      // Nothing below can bring the running total back down.
      if (cost >= bestCost) break;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = target.slice(offset).concat(target.slice(0, offset));
    }
  }

  return best;
}

/** A contour of N points collapsed to a single location. */
function degenerate(at) {
  return Array.from({ length: N }, () => [at[0], at[1]]);
}

/**
 * Pairs two glyphs' contours, padding whichever has fewer with degenerate
 * contours so both end up the same length.
 */
function matchContours(source, target) {
  const count = Math.max(source.length, target.length);
  const pairs = [];

  for (let i = 0; i < count; i++) {
    const from = source[i];
    const to = target[i];

    if (from && to) {
      pairs.push({ from: from.points, to: alignRotation(from.points, to.points) });
    } else if (from) {
      // The target has no counterpart, so it collapses to the middle of the
      // contour it is replacing: the hole shuts rather than blinking out.
      pairs.push({ from: from.points, to: degenerate(centroid(from.points)) });
    } else {
      pairs.push({ from: degenerate(centroid(to.points)), to: to.points });
    }
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// 5. Extrusion
// ---------------------------------------------------------------------------

/**
 * Inward offset of a closed contour, for the bevel ring.
 *
 * Built from the same matched points as everything else, so the bevel morphs
 * with the rest of the glyph. ExtrudeGeometry's own bevel cannot be used here
 * at all — it generates its own vertices, in counts that differ per glyph,
 * which breaks the shared index buffer the whole approach rests on.
 */
function insetContour(points, distance) {
  const out = [];
  const count = points.length;

  for (let i = 0; i < count; i++) {
    const previous = points[(i - 1 + count) % count];
    const current = points[i];
    const next = points[(i + 1) % count];

    // Left normal of each adjacent edge. With winding normalised, left is
    // always the solid side.
    const leftNormal = (a, b) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy) || 1;
      return [-dy / length, dx / length];
    };

    const n0 = leftNormal(previous, current);
    const n1 = leftNormal(current, next);

    let bx = n0[0] + n1[0];
    let by = n0[1] + n1[1];
    const length = Math.hypot(bx, by);

    if (length < 1e-9) {
      // A perfect reversal; fall back to one edge's normal.
      bx = n1[0];
      by = n1[1];
    } else {
      bx /= length;
      by /= length;
    }

    // Miter: the bisector has to be lengthened at a corner to keep the offset
    // face parallel, and clamped so a spike does not shoot off to infinity.
    const cosHalf = Math.max(bx * n1[0] + by * n1[1], 1e-3);
    const miter = Math.min(1 / cosHalf, MITER_LIMIT);

    out.push([current[0] + bx * distance * miter, current[1] + by * distance * miter]);
  }

  return out;
}

/** Outward 2D normal per point, for the side wall. */
function wallNormals(points) {
  const count = points.length;
  return points.map((current, i) => {
    const previous = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy) || 1;
    // Right normal — the outward side, given solid-on-the-left winding.
    return [dy / length, -dx / length];
  });
}

/**
 * Builds one state's vertex rings.
 *
 * Six rings, duplicated where a hard crease is wanted. The front cap, the
 * bevel and the wall each get their own copy of the points they share, because
 * a shared vertex averages its normals across the join and rounds off exactly
 * the crisp edge that makes the type read as machined rather than inflated.
 * The back gets no bevel — it is never seen at these camera angles, and it
 * would cost a third of the file for nothing.
 */
function buildRings(contours) {
  const half = DEPTH / 2;
  const rings = [[], [], [], [], [], []];
  const normals = [[], [], [], [], [], []];

  for (const points of contours) {
    const inset = insetContour(points, BEVEL_SIZE);
    const outward = wallNormals(points);

    for (let i = 0; i < points.length; i++) {
      const [ox, oy] = points[i];
      const [ix, iy] = inset[i];
      const [nx, ny] = outward[i];

      // Bevel normal: outward by the bevel's thickness, forward by its size.
      const bevelLength = Math.hypot(nx * BEVEL_THICKNESS, ny * BEVEL_THICKNESS, BEVEL_SIZE) || 1;
      const bevel = [
        (nx * BEVEL_THICKNESS) / bevelLength,
        (ny * BEVEL_THICKNESS) / bevelLength,
        BEVEL_SIZE / bevelLength,
      ];

      rings[0].push([ix, iy, half]);
      normals[0].push([0, 0, 1]);

      rings[1].push([ix, iy, half]);
      normals[1].push(bevel);

      rings[2].push([ox, oy, half - BEVEL_THICKNESS]);
      normals[2].push(bevel);

      rings[3].push([ox, oy, half - BEVEL_THICKNESS]);
      normals[3].push([nx, ny, 0]);

      rings[4].push([ox, oy, -half]);
      normals[4].push([nx, ny, 0]);

      rings[5].push([ox, oy, -half]);
      normals[5].push([0, 0, -1]);
    }
  }

  return { rings, normals };
}

// ---------------------------------------------------------------------------
// 6. Triangulation
// ---------------------------------------------------------------------------

/**
 * Triangulates the caps, returning indices into a ring of `contours.length * N`
 * points.
 *
 * earcut handles one shell plus its holes per call, so disjoint shells are
 * triangulated separately and their indices offset. Holes are assigned to the
 * smallest shell that contains them, which is the right parent when shells
 * nest.
 */
function triangulateCaps(classified, capPoints) {
  const triangles = [];

  const shells = classified.filter((contour) => !contour.isHole);
  const holes = classified.filter((contour) => contour.isHole);

  for (const shell of shells) {
    const shellIndex = classified.indexOf(shell);

    const owned = holes.filter((hole) => {
      // Same reasoning as in `classify`: probe with a vertex, never a centroid.
      const inside = classified
        .filter((c) => !c.isHole && pointInPolygon(hole.points[0], c.points))
        .sort((a, b) => Math.abs(signedArea(a.points)) - Math.abs(signedArea(b.points)));
      // The smallest containing shell is the parent, which is the right answer
      // when shells nest inside one another's counters.
      return inside[0] === shell;
    });

    const coords = [];
    const holeStarts = [];
    // Maps a position in this earcut call back to its index in the full ring.
    const lookup = [];

    for (const point of shell.points) coords.push(point[0], point[1]);
    for (let i = 0; i < N; i++) lookup.push(shellIndex * N + i);

    for (const hole of owned) {
      holeStarts.push(coords.length / 2);
      const holeIndex = classified.indexOf(hole);
      for (const point of hole.points) coords.push(point[0], point[1]);
      for (let i = 0; i < N; i++) lookup.push(holeIndex * N + i);
    }

    const emitted = earcut(coords, holeStarts);

    for (let i = 0; i < emitted.length; i += 3) {
      const a = lookup[emitted[i]];
      const b = lookup[emitted[i + 1]];
      const c = lookup[emitted[i + 2]];

      // Force every cap triangle counter-clockwise.
      //
      // earcut emits a handful of reversed slivers wherever three resampled
      // points are near-collinear — arc-length resampling produces plenty of
      // those along a straight stem. Reversed triangles are backface culled,
      // so each one leaves a hairline gap that shows the dark interior of the
      // extrusion: a faint scratch running across an otherwise flat cap.
      // Oriented against the inset ring, because that — not the outline
      // earcut was given — is the contour the front cap is actually built
      // from. Insetting a thin stem can flip a sliver's orientation, so
      // testing the outline leaves exactly the triangles this is meant to
      // catch.
      const pa = pointAt(capPoints, a);
      const pb = pointAt(capPoints, b);
      const pc = pointAt(capPoints, c);
      const area =
        (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pc[0] - pa[0]) * (pb[1] - pa[1]);

      if (area < 0) triangles.push(a, c, b);
      else triangles.push(a, b, c);
    }
  }

  return triangles;
}

/** Resolves a ring index back to its 2D point in a contour array. */
function pointAt(contours, index) {
  return contours[Math.floor(index / N)][index % N];
}

// ---------------------------------------------------------------------------
// 7. Assembly
// ---------------------------------------------------------------------------

/**
 * Builds one morph pair's geometry.
 *
 * `sourceContours` and `targetContours` are already matched: same count, same
 * point count, same correspondence. Everything below is symmetric between
 * them, and the index buffer is built once and used by both — which is the
 * whole reason the matching had to happen first.
 */
/**
 * Per-point stagger seeds: a smooth sweep across the glyph plus a per-contour
 * offset. See STAGGER_MIX for why neither term may be per-vertex noise.
 *
 * Computed from the source positions, so the sweep describes which part of the
 * jamo sets off first.
 */
function staggerSeeds(contours, random) {
  const angle = random() * Math.PI * 2;
  const direction = [Math.cos(angle), Math.sin(angle)];
  const contourOffsets = contours.map(() => random());

  const projections = contours.map((points) =>
    points.map((p) => p[0] * direction[0] + p[1] * direction[1]),
  );
  const flat = projections.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const span = max - min || 1;

  const seeds = [];
  for (let c = 0; c < contours.length; c++) {
    for (let i = 0; i < contours[c].length; i++) {
      const sweep = (projections[c][i] - min) / span;
      seeds.push(
        Math.min(
          1,
          Math.max(0, sweep * STAGGER_MIX.sweep + contourOffsets[c] * STAGGER_MIX.contour),
        ),
      );
    }
  }

  return seeds;
}

function buildPair(pairs, classification, random) {
  const sourceContours = pairs.map((pair) => pair.from);
  const targetContours = pairs.map((pair) => pair.to);

  const source = buildRings(sourceContours);
  const target = buildRings(targetContours);

  const ringLength = pairs.length * N;
  const vertexCount = ringLength * 6;

  const position = new Float32Array(vertexCount * 3);
  const aTarget = new Float32Array(vertexCount * 3);
  const normal = new Float32Array(vertexCount * 3);
  const aTargetNormal = new Float32Array(vertexCount * 3);
  const aSeed = new Float32Array(vertexCount);

  // One seed per *point index around the contour*, not per vertex: the six
  // ring copies of a point must share a seed or the rings tear apart from each
  // other during the stagger.
  const seeds = staggerSeeds(sourceContours, random);

  for (let ring = 0; ring < 6; ring++) {
    for (let i = 0; i < ringLength; i++) {
      const v = ring * ringLength + i;

      position.set(source.rings[ring][i], v * 3);
      aTarget.set(target.rings[ring][i], v * 3);
      normal.set(source.normals[ring][i], v * 3);
      aTargetNormal.set(target.normals[ring][i], v * 3);
      aSeed[v] = seeds[i];
    }
  }

  // Caps are triangulated from whichever state has more real contours. The
  // spec says to use the source, which breaks the moment the source is the
  // simpler of the two: its padded degenerate contour is a zero-area hole, and
  // earcut cannot make sense of it. Triangulating the richer topology is
  // always safe — the shared indices stay valid, and in the simpler state the
  // triangles over the closed hole collapse to zero area, which is exactly the
  // behaviour wanted.
  const caps = triangulateCaps(
    classification,
    classification.map((contour) => insetContour(contour.points, BEVEL_SIZE)),
  );

  const indices = [];

  // Front cap, ring 0.
  for (const index of caps) indices.push(index);

  // Back cap, ring 5, reversed.
  const backOffset = 5 * ringLength;
  for (let i = 0; i < caps.length; i += 3) {
    indices.push(backOffset + caps[i + 2], backOffset + caps[i + 1], backOffset + caps[i]);
  }

  // Quad strips: bevel (1 → 2) and wall (3 → 4). Strips wrap within each
  // contour, never across one into the next.
  for (const [a, b] of [
    [1, 2],
    [3, 4],
  ]) {
    const from = a * ringLength;
    const to = b * ringLength;
    for (let c = 0; c < pairs.length; c++) {
      const base = c * N;
      for (let i = 0; i < N; i++) {
        const i0 = base + i;
        const i1 = base + ((i + 1) % N);
        indices.push(from + i0, to + i0, to + i1);
        indices.push(from + i0, to + i1, from + i1);
      }
    }
  }

  return {
    position,
    aTarget,
    normal,
    aTargetNormal,
    aSeed,
    index: new Uint32Array(indices),
    contours: pairs.length,
  };
}

// ---------------------------------------------------------------------------
// 8. The name
// ---------------------------------------------------------------------------

/**
 * 박상현 → PARK SANGHYEON, by Revised Romanization.
 *
 * Nine jamo produce thirteen Latin glyphs, so several jamo split. Splitting is
 * the easy direction to make beautiful: a contour dividing reads as growth,
 * where a contour being absorbed reads as loss.
 *
 * 박 is *Bak* under strict RR and *Park* by convention; convention wins for a
 * name, and ㄱ → RK is a legitimate one-to-many morph.
 */
const TRANSLITERATION = [
  { jamo: "ㅂ", syllable: 0, role: "initial", latin: ["P"] },
  { jamo: "ㅏ", syllable: 0, role: "vowel", latin: ["A"] },
  { jamo: "ㄱ", syllable: 0, role: "final", latin: ["R", "K"] },
  { jamo: "ㅅ", syllable: 1, role: "initial", latin: ["S"] },
  { jamo: "ㅏ", syllable: 1, role: "vowel", latin: ["A"] },
  { jamo: "ㅇ", syllable: 1, role: "final", latin: ["N", "G"] },
  { jamo: "ㅎ", syllable: 2, role: "initial", latin: ["H"] },
  { jamo: "ㅕ", syllable: 2, role: "vowel", latin: ["Y", "E", "O"] },
  { jamo: "ㄴ", syllable: 2, role: "final", latin: ["N"] },
];

/** The four glyphs of SEAN, which arrive rather than being morphed into. */
const ARRIVING = [..."SEAN"];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const font = opentype.parse(fs.readFileSync(FONT).buffer);
  // Fixed seed: this script's output is committed, so it has to be stable.
  const random = rng(0x5ea17a1b);

  // Cap height, from a flat-topped capital. Normalising by this rather than by
  // the em is what stops the Hangul reading visually larger than the Latin at
  // the same nominal size — the two scripts fill the em differently.
  const capHeight = font.charToGlyph("H").getBoundingBox().y2;
  const scale = 1 / capHeight;

  /** Extracts, classifies, resamples and normalises one glyph. */
  const prepare = (char) => {
    const classified = classify(outline(font, char));

    // Centred on the visual centroid of the ink, not the bounding box: a
    // bounding box centre is pulled around by a single overshooting terminal,
    // and glyphs that disagree about their centre wobble against each other in
    // a line.
    const all = classified.flatMap((contour) => contour.points);
    const [cx, cy] = centroid(all);

    for (const contour of classified) {
      contour.points = resample(contour.points, N).map(([x, y]) => [
        (x - cx) * scale,
        (y - cy) * scale,
      ]);
    }

    return classified;
  };

  const cache = new Map();
  const glyph = (char) => {
    if (!cache.has(char)) cache.set(char, prepare(char));
    return cache.get(char);
  };

  const meshes = [];

  // 1. The thirteen morphing glyphs.
  TRANSLITERATION.forEach((entry, jamoIndex) => {
    entry.latin.forEach((letter, splitIndex) => {
      const source = glyph(entry.jamo);
      const target = glyph(letter);
      const pairs = matchContours(source, target);

      // Whichever side has more real contours defines the triangulation.
      //
      // The points handed to earcut must be the *aligned* ones — the same
      // arrays the rings were built from. Triangulating a contour's canonical
      // order and then indexing into its rotated copy makes every index point
      // at a different vertex than the one earcut measured, which produces a
      // cap of tangled, half-inverted triangles that reads as a hollow glyph.
      const richerIsTarget = target.length >= source.length;
      const richer = richerIsTarget ? target : source;
      const classification = pairs.map((pair, i) => ({
        points: richerIsTarget ? pair.to : pair.from,
        isHole: richer[i] ? richer[i].isHole : false,
      }));

      meshes.push({
        name: `${entry.jamo}-${letter}-${jamoIndex}-${splitIndex}`,
        kind: "morph",
        jamo: entry.jamo,
        latin: letter,
        jamoIndex,
        splitIndex,
        splitCount: entry.latin.length,
        syllable: entry.syllable,
        role: entry.role,
        geometry: buildPair(pairs, classification, random),
      });
    });
  });

  // 2. The four arriving glyphs. They still carry an aTarget so one material
  // and one shader path covers every mesh in the scene; theirs simply does not
  // move.
  ARRIVING.forEach((letter, index) => {
    const source = glyph(letter);
    const pairs = source.map((contour) => ({ from: contour.points, to: contour.points }));

    meshes.push({
      name: `arrive-${letter}-${index}`,
      kind: "arrive",
      latin: letter,
      arriveIndex: index,
      geometry: buildPair(pairs, source, random),
    });
  });

  // --- Emit --------------------------------------------------------------
  const chunks = [];
  let offset = 0;
  const entries = [];

  const push = (array) => {
    const buffer = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    chunks.push(buffer);
    const at = offset;
    offset += buffer.byteLength;
    // Keep every array 4-byte aligned so it can be viewed in place.
    const padding = (4 - (offset % 4)) % 4;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
      offset += padding;
    }
    return at;
  };

  for (const mesh of meshes) {
    const g = mesh.geometry;
    entries.push({
      name: mesh.name,
      kind: mesh.kind,
      jamo: mesh.jamo ?? null,
      latin: mesh.latin,
      jamoIndex: mesh.jamoIndex ?? null,
      splitIndex: mesh.splitIndex ?? null,
      splitCount: mesh.splitCount ?? null,
      syllable: mesh.syllable ?? null,
      role: mesh.role ?? null,
      arriveIndex: mesh.arriveIndex ?? null,
      contours: g.contours,
      vertexCount: g.position.length / 3,
      position: push(g.position),
      aTarget: push(g.aTarget),
      normal: push(g.normal),
      aTargetNormal: push(g.aTargetNormal),
      aSeed: push(g.aSeed),
      index: push(g.index),
      indexCount: g.index.length,
    });
  }

  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(BIN, Buffer.concat(chunks));

  const manifest = `/**
 * Manifest for the hero's morph geometry. Generated by
 * scripts/build-hero-geometry.mjs — do not edit by hand; re-run the script.
 *
 * Source: Pretendard Bold (SIL Open Font License 1.1), pinned as a
 * devDependency. Outlines are flattened, contour-matched between each jamo and
 * its Latin target, and extruded; the arrays live in ${path.basename(BIN)} and
 * every offset below is a byte offset into it.
 *
 * All coordinates are in cap heights, centred on each glyph's visual centroid.
 */

export interface MeshEntry {
  name: string;
  /** "morph" glyphs interpolate to a Latin letter; "arrive" ones do not. */
  kind: "morph" | "arrive";
  /** Source jamo, for morph meshes. */
  jamo: string | null;
  /** The Latin letter this mesh is, or becomes. */
  latin: string;
  /** Index into the nine jamo of 박상현. */
  jamoIndex: number | null;
  /** Which piece of a one-to-many split this is, and how many there are. */
  splitIndex: number | null;
  splitCount: number | null;
  /** 박 = 0, 상 = 1, 현 = 2. */
  syllable: number | null;
  role: "initial" | "vowel" | "final" | null;
  /** Position in "SEAN", for arriving meshes. */
  arriveIndex: number | null;
  contours: number;
  vertexCount: number;
  indexCount: number;
  /** Byte offsets into the blob. */
  position: number;
  aTarget: number;
  normal: number;
  aTargetNormal: number;
  aSeed: number;
  index: number;
}

/** Points per contour. Every contour in the file has exactly this many. */
export const POINTS_PER_CONTOUR = ${N};

/** Extrusion depth, in cap heights. */
export const DEPTH = ${DEPTH};

export const BLOB = ${JSON.stringify(path.basename(BIN))};

export const MESHES: MeshEntry[] = ${JSON.stringify(entries, null, 2)};
`;

  fs.writeFileSync(MANIFEST, manifest);

  const kb = (file) => (fs.statSync(file).size / 1024).toFixed(1);
  const vertices = entries.reduce((sum, entry) => sum + entry.vertexCount, 0);
  process.stderr.write(
    `wrote ${BIN} (${kb(BIN)} KB) and ${MANIFEST} (${kb(MANIFEST)} KB)\n` +
      `${entries.length} meshes, ${vertices.toLocaleString()} vertices, N=${N}\n`,
  );
}

main();
