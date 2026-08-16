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

## Pass 5 — Writing was set to a body measure at every type size

**Gap.** `.prose > * { max-width: 34rem }` applied a reading measure written
for 18px body copy to everything inside it, including a 124px `h1`. At 1440 the
`/blog/` headline broke into six one-and-two-word lines and spent two viewports
before the only post appeared. The post page then used 38% of the width and
left the rest empty. It is the same mistake as pass 1, in a second place, which
means it is a defect class rather than an instance.

**Fix, in three parts.**

1. A `.display-measure` primitive in `base.css`, to be set on the element that
   carries the display class — never on its container, where `ch` and `rem`
   resolve against the wrong font size. Applied to the work-index and blog
   headlines. Body copy in `.prose` now takes 38rem, matching the home
   narrative, and the masthead is exempt.

2. The margin note moved out of `case.css` into `base.css` as
   `.margin-layout` / `.margin-note`, because three page types now use it and
   it is the site's grammar rather than a case-study detail. Blog posts adopted
   it: the date, reading time and tags are a post's fields, so they sit where
   every other page puts its fields.

3. The blog index reuses the work index's row — the whole row is the link, the
   title is a heading, the machine voice is on the right — instead of a
   bespoke list that existed only here.

**Two defects found while doing it, both from the brief's own list.**

- The tag list was a flex row with a gap, so "placeholder" and "realtime
  latency" rendered as one run with the separation living only in CSS. Stacked
  one per line, where a newline carries it.
- `.margin-layout` with no explicit template got an implicit `auto` track,
  which sized to the widest child's min-content — a code block — and made the
  post 469px wide inside a 350px phone. `minmax(0, 1fr)` instead. This one was
  caught by the existing horizontal-scroll test, which is the whole point of it.

**Test.** `display headings are not broken into one-word lines` — characters
per line across every `display-*` element at 1440. The two broken states
measured 5 and 10 characters per line; the threshold is 12 and a healthy
heading measures 18 or more.

Files: `lib/blog.ts`, `src/base.css`, `src/blog.css`, `src/case.css`,
`src/home.css`, `src/prose.css`, `lib/pages.ts`, `tests/quality-floor.spec.ts`.
Tests: 52 passed.

## Pass 6 — the theme toggle was a 162px capsule on a phone

**Lighthouse first** (due this pass). Mobile profile, all six routes checked:
100 / 100 / 100 / 100 on every one. LCP 1.5s, TBT 0ms, CLS 0.002 on the home
page and 0 everywhere else. The margin-column work in passes 2 and 5 cost
nothing.

**Gap.** Below 34rem the masthead became a single-column grid, which left the
theme toggle as a grid item with nothing to size it. It stretched to 162px — a
rounded capsule six times wider than tall with a 14px stone at one end — on
every page at phone width. The three stacked rows also took the masthead to
134px, a sixth of a 390×844 screen, before any content.

**Fix.** Two rows rather than three: wordmark and toggle share row one, the nav
spans row two. All three children are placed explicitly, so nothing is left to
auto-placement and the toggle sizes to itself.

**Test.** `the theme toggle keeps a control's proportions at every width` — at
320/390/768/1440 it is at least 24×24 (WCAG 2.2 SC 2.5.8) and its aspect ratio
is under 1.6. The broken state measured 6.0.

Files: `src/base.css`, `tests/quality-floor.spec.ts`. Tests: 53 passed.

## Pass 7 — read only the headings and the argument was not there

**Gap.** The brief's own test. Headings on the home page, in order:

> Hi, I'm Sean Park — 박상현 — and I run product and delivery at Mindlogic in
> Seoul. / Three constraints / Users arrived already fluent… / Two features
> had become… / No grade, no credit…

A greeting, the words "Three constraints" set at 11px in mono, and three
constraints. Nothing at any size says why a constraint is the thing being
shown. The claim was there — it was the fourth narrative paragraph, "That is
the part I actually want to talk about…" — which is precisely the failure this
site is arranged against: the argument in the copy rather than in the
structure. The old ledger made it structural; the narrative rewrite lost it.
This was on the brief's known-problems list and it checks out.

There was a second, related problem underneath it: the largest type on the home
page was an `h3`. The section heading was 11px, the greeting `h1` 57.6px, and
each index constraint 64px. The hierarchy ran backwards.

**Fix.** The claim is now an `h2` — "Designing inside constraints you did not
choose is a different skill." — at `display-l`, the largest thing on the page,
with "Three constraints" demoted to the eyebrow above it and a supporting line
under it carrying what the deleted paragraph said. Copy lives in
`content/site.ts` as `thesis`, like everything else.

Headings now read: who I am → the claim → the three constraints that support
it. That is the argument, from headings alone.

**Test.** `the home page states its claim in a heading, above the constraints`
— the first `main h2` contains the claim, and the largest `h2` is larger than
the largest `h3`, which catches both the missing claim and the inverted
hierarchy.

Files: `content/site.ts`, `lib/pages.ts`, `src/home.css`,
`tests/quality-floor.spec.ts`. Tests: 54 passed.

## Pass 8 — a 160px indent past a column that never held anything

**Gap.** The case-study rail earns its 10rem: it carries `DECISION 01`,
`CONTEXT`, `REJECTED`, `COST`. On artifact and about pages it was empty for the
whole page, and the body copy was indented past it anyway. Worse on artifacts:
the `h2` spanned `rail / tail` while its own paragraphs started 160px to the
right, so every section heading hung off the left of the text it was heading.
The about page had nothing in the rail and no headings at all — one `h1`, the
name, and then three unlabelled paragraphs indented into the middle of the
page.

**Fix.** A section number in the rail, and the heading moved into the body
column with the paragraphs it introduces — the same shape as `Decision 01`
above a decision title. The rail now carries something on every page that
indents past it.

The about page was restructured to the same `sections` shape as an artifact and
now renders through the same function, so it gets the same rail. Its three
paragraphs became three sections: "One product, three years", "None of it was
greenfield", "What I am looking for". Reading only the headings on `/about/`
used to give the name and nothing else.

**A defect found while doing it.** The rail marker is a `<p class="label
doc-n">`, and `.doc-section > p { grid-column: body }` sits later in the file
and is more specific, so the number rendered in the body column stacked above
its own heading rather than in the rail. Caught by measuring the rendered grid,
not by reading the CSS — the rule looked correct in isolation.

Files: `content/site.ts`, `lib/pages.ts`, `src/case.css`. Tests: 54 passed.
