# Creativity pass B — three prototypes

Throwaways, kept because the reasoning is worth more than the code. None of
these is wired into the site; they are served from `dist/proto/` for
screenshotting:

```sh
npm run build && npx vite preview --port 4173 &
cp -r prototypes dist/proto
CHROME=/opt/pw-browsers/chromium \
  URLS=/proto/p1-position.html,/proto/p2-impression.html,/proto/p3-division.html \
  OUT=shots-proto node scripts/thumb.mjs
```

`scripts/thumb.mjs` renders each at 1440, 390 and — the one that decided this
— **300px wide**, which is the card a juror sees before they see anything
else. The 300px frame is the first viewport only, shrunk by
`deviceScaleFactor`, so it is the browser's own downscale rather than a
resample.

Each prototype carries the same page: masthead, greeting, record, claim, three
index rows, the ask. Copy is lifted verbatim from `content/site.ts` so the only
variable is the idea.

---

## P1 — 착점, "the played point"

**Thesis.** The page is not standing on a grid, it is standing on a board that
already has stones on it. You did not choose the opening.

**Argued from.** The 19-cell lattice and the nine 화점 in `src/board.css`, which
are drawn on every page and which nobody can see.

**Verdict: cut, but one part survives.** Two findings, and they point opposite
ways.

The lattice at 0.30 alpha is exactly what `src/board.css` warns about in
writing — "at 0.16 it starts reading as graph paper" — and it does. Graph
paper is not a board.

What actually made it read as a board was not the line weight, it was the
**edge**. Graph paper runs off the sheet; a board is bounded. That finding is
worth keeping and costs no contrast, so it went into the build.

The stones are the failure. They land on real intersections, so the geometry is
honest, but *which* intersections is arbitrary — and they collided with the
display type at 1440 (there is a slate stone sitting in the middle of "a
different skill"). Worse: to a reader who plays, the position is nonsense. The
audience most likely to recognise the reference is the audience most likely to
see that it is fabricated, which is the same defect as inventing a metric. Cut.

At 300px it is the baseline plus two grey dots.

## P2 — 인, "the impression"

**Thesis.** This site is a record, and a record is not finished until it is
stamped. The seal is the moment a person becomes official to a system that was
not built for them — which is the site's whole argument — so stop rendering it
as a 0.4em square and let it stamp.

**Argued from.** Two claims `src/tokens.css` already makes in writing and never
makes good on in pixels: that the accent is "인주, official seal cinnabar", and
that the ground is "archival board rather than the cream a display serif
usually sits on".

**Verdict: chosen.** See `docs/iteration-log.md`.

## P3 — 집, "territory"

**Thesis.** An index is not a list. Three constraints had already divided the
board before I arrived, so draw the division: each constraint is a field the
reader passes through, and the ground commits to a colour.

**Argued from.** The `Decision` type in `content/site.ts`, which cannot be
written without a cost.

**Verdict: cut.** It is the best thumbnail of the three by a wide margin — four
flat fields, unmissable at 300px — and it is also the only one that fails the
brief's own test outright. Stacked full-bleed colour bands would look identical
for a law firm, a record label or a bakery; the connection to 집 exists only in
the caption. Two smaller faults confirm it: the cinnabar band is the third
constraint for no reason anyone could state, which breaks the rule that the
accent is load-bearing rather than decorative; and committing the ground to
near-black makes the light theme the odd one out on a site whose two themes are
deliberately equal citizens.

Kept as the reason the chosen direction had to answer the thumbnail question
rather than duck it.
