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

## Pass 2 — the right five cells of every case page were empty for the whole scroll

**Gap.** At 1440 a case study used about 65% of the content width. The header
went full bleed, then the rail plus the 42rem measure left roughly 420px of
nothing down the right-hand side for six thousand pixels of scroll. That is
dead space, not negative space — negative space has an edge doing work on
something.

**Fix.** The meta fields — role, team, period, surface — moved out of the
horizontal band under the title and into that column, stacked and sticky, so
they stay beside the argument they qualify instead of reading once and
vanishing. It is the move the home page already makes with the record, so the
site gains a repeated grammar rather than a local patch.

The split is taken off the board rather than guessed: thirteen cells of spine,
one of gutter, five of margin. Thirteen cells at 1440 is 897px, which is
exactly the 10rem rail plus the 2rem gap plus the 42rem measure — the spine now
fills its cells rather than floating inside them.

Applies to case studies, artifact pages and about, which share the renderer.
Below 80rem — the same breakpoint the board and the home spread already use —
it collapses back to a band above the lede, and the DOM order (fields, then
lede) is unchanged in both, so reading order never depended on the grid.

Files: `lib/pages.ts`, `src/case.css`. Tests: 50 passed.

## Pass 3 — the name was torn in half in the largest type on the site

**Gap.** The home page `h1` set "Hi, I'm Sean Park — 박상 / 현 — and I run
product…" at 1440 and 768, and "박 / 상현" at 390. Every breakpoint, both
themes.

**Cause.** The browser's default treats every Hangul syllable block as a break
opportunity. Korean breaks at word boundaries (어절), so the default is simply
wrong for the language — it had just never been overridden.

**Fix.** `word-break: keep-all` on `:lang(ko)`, which is where the shell
already wraps every Korean run. It is a property of the language rather than a
patch on the heading, so it also holds the wordmark, the footer signature,
한국장학재단 in the case-study fields, and any Korean added later.

Worth naming why it matters beyond typography: the site's argument is that a
record illegible to a foreign reader can be made undeniable without being
flattened. Breaking the name in half in the biggest type on the site argues the
other way.

**Test.** `no Korean run is broken across lines` — a space-free `[lang="ko"]`
run occupies exactly one line box, so more than one client rect means it broke.
Checked at 320/390/768/1440 on home, about and the case study that carries a
Korean client name. Verified failing against the previous build before the fix
landed.

Files: `src/base.css`, `tests/quality-floor.spec.ts`. Tests: 51 passed.

## Pass 4 — the record was the only box on the site

**Gap.** The four numbers that carry the site's evidence sat in a rounded,
tinted, 1px-bordered card. Everything else on the site is hairlines and type.
Ask the brief's question — would this look the same for a different client? —
and the card is the one element on the page that answers yes. It also argues
the wrong thing: a card reads as a widget, and those numbers are the record.

**Fix.** Dissolved it into the same margin note the case pages now carry: a top
hairline, mono label left, figure right, a rule under each row. The figures
went from 1.8rem to clamp(1.75rem, 2.4vw, 2.4rem) and are set tabular, so the
column reads as a ledger rather than a widget. No border, no radius, no fill.

The bespoke `evidence-figures` markup is gone with it — the record now renders
through `strip()`, the site's one repeating layout primitive, which is what the
README already claims it does everywhere. That is nine lines less renderer and
one fewer thing to keep in sync.

**Tests.** Two tests located this block by the class name `.evidence` and broke
on the rename. They now assert the four figures are present in the margin,
which is the thing that actually matters without JS — a class name can be
renamed and an empty box would have passed the old assertion.

Files: `lib/pages.ts`, `src/home.css`, `tests/quality-floor.spec.ts`. Tests: 51 passed.
