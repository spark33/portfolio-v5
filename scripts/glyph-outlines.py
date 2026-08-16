#!/usr/bin/env python3
"""Reads glyph outlines out of a variable font, at one instance of its axes.

    python3 scripts/glyph-outlines.py <font.ttf> <wght> <chars…>

Emits JSON on stdout: unitsPerEm, and per character its advance width and its
outline as a list of contours, in font units, y up. A contour is a list of
segments — `["L", x, y]`, `["Q", cx, cy, x, y]`, `["C", …]` — starting from the
contour's first point. Structured rather than path data so nothing downstream
has to parse SVG path strings, with their shorthands and implicit line-tos.

Font units, deliberately — integers, exactly as the font is drawn. Pretendard
builds a counter as a hairline *slit* in a single contour rather than as a
second contour wound the other way, and a slit is a few font units wide. Handing
downstream code pre-scaled floats is how that detail gets rounded away and a
letter comes out with its counter filled solid; keeping the font's own units
means every tolerance downstream is expressed in the units the font was drawn
in, which is the whole class of bug that made this file necessary.

fontTools rather than opentype.js because `instantiateVariableFont` pins the
weight axis to a real static instance, and because it takes two npm packages
out. opentype.js reads this font correctly too.

The split is deliberate: Python owns reading the font, and
scripts/build-loader.mjs owns matching the contours and emitting the module.

Needs fonttools:  python3 -m pip install fonttools
"""

import json
import sys

from fontTools.pens.recordingPen import RecordingPen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer


def contours(pen: RecordingPen) -> list:
    """Recorded pen operations, regrouped as one list of segments per contour.

    TrueType quadratics arrive as a single `qCurveTo` carrying a run of
    off-curve points with the on-curve points between them left implied, at each
    consecutive pair's midpoint. Those are put back here, so a segment is always
    one curve with one endpoint.
    """
    out: list = []
    current: list | None = None
    cursor = None

    for op, args in pen.value:
        if op == "moveTo":
            current = []
            cursor = args[0]
            out.append({"start": list(cursor), "segments": current})
        elif op == "lineTo":
            cursor = args[0]
            current.append(["L", *cursor])
        elif op == "curveTo":
            c1, c2, end = args
            current.append(["C", *c1, *c2, *end])
            cursor = end
        elif op == "qCurveTo":
            points = list(args)
            if points[-1] is None:
                # A contour with no on-curve points at all: close the ring of
                # off-curve points by starting from the midpoint of the last
                # pair, which is where the implied on-curve point sits.
                points = points[:-1]
                first = points[0]
                last = points[-1]
                cursor = ((first[0] + last[0]) / 2, (first[1] + last[1]) / 2)
                out[-1]["start"] = list(cursor)
                points = points + [cursor]
            for i, control in enumerate(points[:-1]):
                following = points[i + 1]
                end = (
                    following
                    if i + 1 == len(points) - 1
                    else ((control[0] + following[0]) / 2, (control[1] + following[1]) / 2)
                )
                current.append(["Q", *control, *end])
                cursor = end
        elif op in ("closePath", "endPath"):
            current = None

    return [c for c in out if c["segments"]]


def main() -> None:
    if len(sys.argv) < 4:
        raise SystemExit(__doc__)

    path, weight, chars = sys.argv[1], float(sys.argv[2]), sys.argv[3]

    font = TTFont(path)
    # Pinned rather than set as a default: the outlines wanted are this weight's
    # outlines, and every consumer downstream reads plain glyf data.
    font = instancer.instantiateVariableFont(font, {"wght": weight}, inplace=False)

    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    em = font["head"].unitsPerEm

    out = {}
    for char in dict.fromkeys(chars):  # de-duplicated, order preserved
        name = cmap.get(ord(char))
        if name is None:
            raise SystemExit(f"{path} has no glyph for {char!r} (U+{ord(char):04X})")
        pen = RecordingPen()
        glyphs[name].draw(pen)
        out[char] = {"contours": contours(pen), "advance": glyphs[name].width}

    json.dump({"unitsPerEm": em, "glyphs": out}, sys.stdout)


if __name__ == "__main__":
    main()
