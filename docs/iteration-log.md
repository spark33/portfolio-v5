# Iteration log

Ten critique passes against [`docs/iteration-brief.md`](iteration-brief.md). Each
pass: build, screenshot every page at 1440 / 768 / 390 in both themes, look at
the screenshots, name the single largest gap, fix that one gap, run the whole
Playwright suite.

Baseline screenshots are in `shots-before/`, the current set in `shots/`. Both
are gitignored — they are 66 PNGs a pass, and the log is the record.

---

## Pass 1 — the work index headline broke one word per line

**Gap.** At 1440 the `/work/` headline — "Every project here is named by the
pressure that produced it." — set 124px display type inside a ~210px column and
broke into eleven single-word lines, spending the entire first viewport before
any work was visible.

**Cause.** `.work-head { max-width: 22ch }` sat on the wrapper, so `ch`
resolved against the inherited 18px body size rather than the display size of
the `h1` inside it. 22ch read as 22 characters and measured as 210px.

**Fix.** Moved the measure onto the element that carries the display size
(`.work-head > h1 { max-width: 17ch }`), where `ch` resolves at ~124px and the
headline sets in three lines across roughly 85% of the content width. No change
at 390 or 768, where the clamp already had the type small enough that the
wrapper's measure was never the binding constraint — which is exactly why this
survived: it was invisible at the two widths that get checked first.

Files: `src/home.css`. Tests: 50 passed.
