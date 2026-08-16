# Iteration log

Ten critique passes against [`docs/iteration-brief.md`](iteration-brief.md), and
one exploration pass after them. Each critique pass: build, screenshot every
page at 1440 / 768 / 390 in both themes, look at the screenshots, name the
single largest gap, fix that one gap, run the whole Playwright suite. The
exploration pass ran a different method, described under "Creativity pass A".

Baseline screenshots are in `shots-before/`, the current set in `shots/`. Both
are gitignored — they are 66 PNGs a pass, and the log is the record. The
exception is `proto/screenshots/`, which is committed: it is twelve images that
are the evidence for one decision rather than a snapshot of a build.

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

## Pass 9 — the site's only ask was its quietest element

**Gap.** The home page ends with `sanghyun.park@mindlogic.ai` set at body size,
about 150px above the same address repeated at 18px in the footer. A site whose
entire job is to make an employer write to this person said so twice, at the
same weight, at the bottom, in the smallest voice on the page.

**Fix.** An `EMAIL` label and the address at `clamp(1.35rem, 4vw, 3rem)` —
after the claim, the largest thing on the page, and the last thing before the
footer. The footer's copy now reads as the chrome it is rather than as a second
attempt at the same sentence.

The 1.35rem floor is not a round number for a reason: 26 characters of address
at 1.75rem measures 364px inside a 350px column at 390 wide, and this codebase
has form on silently losing the end of a string exactly that way.

**A defect found while doing it, and it is the third of its kind.** The first
version of the rule set the address at 48px in the stylesheet and 19.5px on the
page, because `.story > p` is a class plus an element and outweighs a bare
`.contact`. Pass 1 was a measure on a container beating the element; pass 5 was
the same in `.prose`; this is the same shape again. Noted in the CSS at the
site of each.

**Also checked this pass, since motion is scored and none of it has been
touched:** every `transition` on the site uses `--ease-resolve` or
`--ease-exit`, both authored cubic-béziers. There is no `ease`, `ease-in-out`
or `linear` anywhere in `src/`. With motion off the site is unchanged apart
from the pointer lift, which is `display: none` under reduced motion.

**Lighthouse** (due this pass). All seven routes, mobile profile: 100 / 100 /
100 / 100. LCP 1.5s, TBT 0ms, CLS 0.002.

Files: `lib/pages.ts`, `src/home.css`. Tests: 54 passed.

## Pass 10 — the two edges the site never designed

**Gap.** The brief's last two open items, and they are the same gap: the places
a visitor arrives that were never drawn. A mistyped URL got whatever the host
decided to serve, and a link pasted into Slack or a hiring thread unfurled as a
title and nothing else.

**The 404.** A real page, in the site's own grammar — the condition is the `h1`
("Nothing is published at this address."), the name of it is subordinate — and
it carries the whole work index rather than an apology, because the reader is
here by accident and the site is small enough to show all of itself. It is
`noindex`, and it is deliberately absent from `routes` so it can never reach
the sitemap. Vercel serves `dist/404.html` for unmatched paths with no
configuration.

**The share card.** `public/og.png`, 1200×630, generated by `scripts/og.mjs`
and committed — the same arrangement as the fonts, so a production build still
needs neither a browser nor the network. It draws the lattice and the star
points at the card's scale, sets the claim at 74px, and carries the four record
figures and the seal. It reads the palette out of `src/tokens.css` and the copy
out of `content/site.ts` rather than restating either, so the card cannot
quietly disagree with the page it advertises.

It is only advertised when the origin is known — `SITE_ORIGIN`, or Vercel's
production hostname. A scraper fetches `og:image` with no page to resolve a
relative path against, so a relative URL there is worse than none, which is
exactly the rule the sitemap already follows. The two now share one
`siteOrigin()` rather than two copies of the same environment lookup.

**Tests.** `the 404 is a real page, is not indexable, and offers the work` and
`the share card is advertised only when the origin is known` — the second also
fetches `/og.png` and checks it is actually served, since a correct meta tag
pointing at a missing file is the failure that matters.

**Also done this pass.** `docs/concept.md` and `docs/references.md` are
deleted. They described an editorial-with-interactive-figures direction with a
WebGL hero that this site abandoned, and their reasoning is in the README and
in git history. Two documents describing a different site is worse than none.

Files: `content/site.ts`, `lib/pages.ts`, `lib/shell.ts`, `plugins/site.ts`,
`scripts/og.mjs`, `scripts/screenshots.mjs`, `src/home.css`,
`tests/quality-floor.spec.ts`, `public/og.png`. Tests: 56 passed.

---

# Creativity pass A — make the typography the idea

A different brief and a different method from the ten passes above. Those were
critique-and-fix: find the largest defect, fix that one thing. This one had no
defect to fix. The site was competent, internally consistent, and scored well on
everything except the thing that decides whether anyone remembers it — there was
no moment a juror would stop on, and typography was doing all the visual work
while doing nothing interesting with it.

Method: build three genuinely different directions as throwaway prototypes,
screenshot each at 1440, 390 and 300px, look at them, pick one in writing, then
build the winner properly. The prototypes are committed in
[`proto/`](../proto/) with their screenshots, so the choice is reviewable rather
than asserted.

## The three directions

**1 — The resolution.** *The site's claim is a name being made legible without
being flattened, so set that transformation — composed, decomposed,
transliterated, resolved — at display scale, as the first thing on the page.*
Four steps of 박상현, each labelled with the operation that produced it, the last
carrying what it cost.

**2 — Weight is who decided.** *Schibsted Grotesk carries a continuous 400–900
axis and the site asks it for three values; put the axis to work as meaning —
what was imposed on the work set light, what was chosen set heavy — so the
colour of a page maps the argument before a word of it is read.* Applied to the
claim, the index rows and the three fields of a decision.

**3 — The record at display scale.** *Numerals are the only part of this record
a stranger can read without knowing one of its nouns, so set the four figures at
the size of the claim and let the sentences caption them.* 400+, 100%, 180k+,
53k as the page's display type.

## The choice, and what the other two did better

**Direction 1, built.** At 300px — the width that decides whether a text-only
site gets opened at all — it is the only one of the three showing something a
juror could not get from a font choice: a stack of four specimens, one Korean,
one a row of jamo that reads as pure structure, two Latin, with a red rule under
the last. Baseline, 2 and 3 all read at that size as things already seen: a grey
paragraph, a big headline with bold words, a row of big numbers.

It is also the only one of the three that is the site's own argument rather than
a treatment applied to it. Every project here is introduced by the constraint
that produced it and states what the decision cost; the name now gets identical
treatment, which is what `lib/pages.ts` has claimed in its file header since the
first commit and has not been true since the motif was deleted. `person.nameJamo`
had been sitting in `content/site.ts` rendered nowhere, with a comment
explaining that the three groups were kept so the syllable structure would
survive decomposition. The material had been prepared and abandoned.

**What 2 did better.** It is a *system* and direction 1 is a *place*. Weight as
authorship applies to every page — the index rows, the decision fields, the
lede — and would have made the argument visible in body copy, where a reader
spends most of their three minutes. Direction 1 spends its idea in the first
screen of one page and the rest of the site is unchanged. That is a real loss
and I took it deliberately: a system that has to be explained by a legend (my
prototype needed one: `WEIGHT 400 — GIVEN TO ME · WEIGHT 880 — DECIDED BY ME`)
is a system nobody decodes, and at 300px the weight contrast reads as ordinary
bold-for-emphasis. The half of it that survives is in the winner: the axis is
now a named, documented scale, and its direction carries the meaning.

**What 3 did better.** It is by far the loudest at thumbnail size, and it is
right that the numbers are the part of this record that needs no translation.
Two things killed it. It makes the person a dashboard — pass 4 spent a whole
pass dissolving those same four figures out of a card because a card argues the
record is a widget, and this direction argues it harder. And it says nothing
about judgement: the site's claim is that the decisions and their costs are the
evidence, and a wall of metrics is the version of this record that a recruiter
screen already produces.

## What was built

**The strip.** `nameResolution` in `content/site.ts`, derived from `person` so
the four forms cannot drift from the wordmark, the footer or the structured
data. Rendered by `resolution()` in `lib/pages.ts` as an ordered list — the
steps are an order, each produced from the one above it — with the mono step
name, the specimen, and a note. Step 04 carries a `COST` field in the site's
accent, which is the first of the three places `src/tokens.css` has always said
the accent belongs: *the lossy step of the name*. The token comment predicted
this element.

**A size that is derived rather than chosen.** The specimens have no font-size
in the type scale. They are set at `100cqw / --fit` — the strip's own measure
divided by a constant — so the type is a function of the page width, and no step
can wrap or overflow at any viewport because the longest of the four runs 8.9 em
against a divisor of 10. Below 48rem the divisor tightens to 9.1: a wide screen
can afford 10% slack and a phone cannot. `proto/measure.mjs` is where the 8.9
comes from; it is measured at the weight and tracking the type is actually set
in, because a heavier weight is a wider string and CSS has no unit for "the
width of this string".

This is the opposite failure mode to the one this codebase keeps producing. Four
times now a measure written for one font size has been inherited by another; here
the size is derived from the measure instead, so the two cannot disagree.

**The weight axis, as a scale.** `--weight-source: 400`, `--weight-carried: 700`,
`--weight-imposed: 860` in `src/tokens.css`. Weight rises as fidelity falls:
박상현 at the axis floor, "Sean Park" at 860, because the least true form is the
one the world uses. Both Korean steps are Pretendard, which ships here as two
static weights, so they take 400 — which is also the weight the shell preloads,
so neither large Korean row waits on an unpreloaded file.

**The greeting.** It was "Hi, I'm Sean Park — 박상현 — and I run product and
delivery at Mindlogic in Seoul." Directly under a strip that has just spent a
screen on both halves of the name, that repeats both of them in one breath. The
h1 is now the sentence the greeting was burying — "I run product and delivery at
Mindlogic in Seoul." — which is also the one an employer is reading for. The
cost is the site's three friendliest words; the first-person voice survives in
the narrative under it.

**A defect found while doing it, and it is the fourth of its kind.** The `COST`
field rendered in secondary grey rather than in the accent, because it is a `p`
inside `.resolve-note` and the rule written for the container
(`.resolve-note p`, one class and one element) outweighs the rule written for
the element (`.resolve-cost`, one class). Pass 1 was a measure on a container
beating the element, pass 5 the same in `.prose`, pass 9 `.story > p` beating
`.contact`. Fixed by giving the note text its own class; noted at the site of it.

**Two tests, both verified failing first.** `the name fills its measure and never
wraps` — at 320/390/768/1024/1440, every step occupies one line box and fits the
measure, and the longest still uses more than 80% of it, which is what catches
container units silently failing to the fallback clamp. Verified against
`--fit: 8.0`, where it fails on overflow. And `the name resolves in four steps,
and every step is real text` — the four values read out of the rendered text,
including the spaces between the jamo groups, because three positioned spans
would look identical and be invisible to a screen reader.

The specimens deliberately carry no `display-*` class. Those exist to keep a
body-copy measure off display type and their test counts characters per line;
a three-character name would read as broken under it. The invariant that
matters here is a different one and is tested directly.

## Where it ended up

**Lighthouse**, mobile profile, after the pass:

| Route | Perf | A11y | Best practices | SEO | CLS |
| ----- | ---- | ---- | -------------- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0 |
| `/work/` | 100 | 100 | 100 | 100 | 0 |
| `/work/inherited-mental-model/` | 100 | 100 | 100 | 100 | 0 |
| `/logician-ui/` | 100 | 100 | 100 | 100 | 0 |
| `/about/` | 100 | 100 | 100 | 100 | 0 |
| `/blog/` | 100 | 100 | 100 | 100 | 0 |
| `/blog/cutting-transcript-latency/` | 100 | 100 | 100 | 100 | 0 |
| `/404.html` | 100 | 100 | 100 | **63** | 0 |

LCP 1.5 s and TBT 0 ms throughout. CLS went from 0.002 to 0 on every route,
which is not a coincidence: the strip's height is `line-height × font-size` and
its font-size comes from the container's width, so nothing about it moves when
the web font swaps in. The one element that used to shift was the first line of
the home page.

This Lighthouse build also reports an `agentic-browsing` category, scoring 67 on
every route including the ones untouched by this pass. It is not one of the four
the brief names and nothing here moved it; recording it so the next pass knows
it was already there.

**Tests:** 58 passing, from 56. Two added, none weakened. One existing assertion
was updated rather than removed — the h1 regex, because the h1's copy changed —
and it is no weaker than it was.

**Total JavaScript:** still 1.5 KB. Nothing in this pass runs at runtime.

## What I did not do, and why

- **Direction 2 as a site-wide system.** The strongest thing about it —
  weight carrying meaning rather than emphasis — is in the winner. The rest of
  it, light-for-imposed and heavy-for-chosen across index rows and decision
  fields, is a coherent second pass and I did not start it, because half a
  system applied to two page types would read as inconsistency rather than as
  rigour.
- **The share card.** `public/og.png` still carries the claim and the record,
  not the resolution. Its own rule is to be regenerated when the claim, the
  record or the palette changes, and none of the three did. Redrawing it around
  the strip is a new design decision about a different surface, and a card whose
  job when unfurled is to state the argument in one line is not obviously
  improved by spending that line on a name.
- **Changing the display face.** Lead 4 in the brief was that Schibsted Grotesk
  may be the ceiling — a completely neutral grotesque in the same register as
  every Neue Montreal site. It is neutral, and it stayed, for a reason the pass
  made stronger rather than weaker: the whole strip is Korean and Latin set at
  the same size on adjacent lines, and it only holds because the two faces are
  metric twins. Replacing the Latin face for the display setting would have put
  the mismatch in the one place on the site where the two scripts are most
  directly compared. The interest had to come from what the type is doing, not
  from what it is.
- **The strip on any page but the home page.** It is the site's one moment and
  repeating it on `/about/` would spend it. The about page still opens on a
  plain "Sean Park — 박상현" h1, which now looks thin by comparison. That is the
  most obvious candidate for the next pass.
- **The home h1 is still smaller than the h3s below it**, and now smaller than
  the strip above it too. Pass 10 left this open and this pass did not close it;
  the greeting is deliberately conversational and I still did not want to shout
  it. It is more visible now than it was.
- **No testing on a real mid-range Android.** Still Chromium at a throttled
  profile. The strip is the heaviest text block the site has ever rendered and
  it is the thing I would most want to see on real hardware.

---

## Reference check

`www.awwwards.com` was reachable, so this is against real submission
screenshots pulled from the `og:image` of `/sites/<slug>`, not against a trend
article. Three current Sites of the Day were looked at: **2xa-studio**,
**alethia**, **glitch-grit**.

**2xa-studio** is the reference class for this site — monochrome, grid-driven,
text-first, no imagery at all. Two things it does that are worth stating:

- Display type is set at roughly 12–15% of viewport height. The thesis on this
  site is 124px against a 900px viewport, about 13.8%, so the scale is in the
  right zone. That is the check that mattered, and it passes.
- It lets display type overlap a dense body-text field and crop at the page
  edge. This site never crops. That is a deliberate difference rather than an
  oversight: the argument here is that an illegible record can be made
  legible, and cropping the sentence that says so would argue the opposite.

**alethia** is a 3D hero on a colour ground and **glitch-grit** is an effects
piece; neither is a useful comparison for a text-only site, and neither
suggested a change here. Recording them because looking and finding nothing is
a result.

**Creativity pass A re-checked this**, against the current Sites of the Day
list: **2xa-studio** again, plus **no-art**, **studio-k95**, **haoqi-design**,
**produx-design**, **mosbys-files**, **revelatio-studio** and **nothin** —
submission screenshots pulled from each `/sites/<slug>` `og:image`, not
described from a trend article.

2xa-studio is still the bar and still the closest comparison: one commitment,
visible in a thumbnail, giant display type colliding with a dense body-text
field. Two things from the wider set were worth writing down. Every one of them
survives being shrunk to a thumbnail, which is a harder test than looking good
at 1440 and is the one this site was failing. And **haoqi-design** sets Hangul
as a display element beside Latin — as stickers rather than as typography, but
it is the only site in the set doing anything at all with a second script,
which is evidence for how empty that territory is rather than against it.

---

## Where it ended up

**Lighthouse**, mobile profile, after the tenth pass:

| Route | Perf | A11y | Best practices | SEO | CLS |
| ----- | ---- | ---- | -------------- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0.002 |
| `/work/` | 100 | 100 | 100 | 100 | 0.002 |
| `/work/inherited-mental-model/` | 100 | 100 | 100 | 100 | 0.002 |
| `/logician-ui/` | 100 | 100 | 100 | 100 | 0.002 |
| `/about/` | 100 | 100 | 100 | 100 | 0.002 |
| `/blog/` | 100 | 100 | 100 | 100 | 0.002 |
| `/blog/cutting-transcript-latency/` | 100 | 100 | 100 | 100 | 0.002 |
| `/404.html` | 100 | 100 | 100 | **63** | 0 |

LCP 1.5s and TBT 0ms throughout. The 404's SEO score is 63 for one reason:
Lighthouse marks down any page that is blocked from indexing, and a 404 that
appeared in search results would be a defect. It is the correct number.

CLS moved from 0 to 0.002 on most routes during these passes. It is two
thousandths, an order of magnitude inside the 0.01 the brief asks for, and it
comes from the web-font swap on a page whose first line is now longer.

**Tests:** 56 passing, from 50. Six added, none weakened. Four of the six were
verified failing against the build before their fix.

## What I did not fix, and why

- **The five `{{?}}` placeholders.** Left, as instructed. Nobody gave me the
  numbers and inventing them is the one thing the site is built not to do.
- **The board.** The brief asked whether the 19-cell lattice still earns its
  place or has become texture. Verdict: it earns it structurally and barely
  registers visually. Every composition decision in these passes came off it —
  13 / 1 / 5 on case pages, 10.5 / 1.5 / 7 on the home spread, the six-cell
  hoshi pitch on the share card — so it is load-bearing in a way it was not
  before. As a *surface* it is close to invisible at 1440 and at 390 it is a
  50px mesh that reads as faint noise rather than as a board. I did not touch
  the alpha, because the README documents it as measured to a 1.09 contrast
  ratio in both themes and I have no measurement to replace that with. It is
  the strongest candidate for pass eleven.
- **The home page `h1` is still smaller than the `h3`s below it** — 57.6px
  against 64px. Pass 7 put a `display-l` `h2` above them so the page has a
  peak, but the greeting itself is deliberately conversational and I did not
  want to shout a greeting. It is a defensible inversion rather than a resolved
  one, and I am not certain it is right.
- **Artifact pages are dead ends.** A case study carries a "next" link;
  `/logician-ui/` and `/harness/` carry nothing, so a reader who arrives from
  the closing paragraph has only the nav. Real, small, and out of budget.
- **No testing on a real mid-range Android.** The jury does this. Everything
  here is Chromium at a throttled profile, which is not the same thing.
- **`docs/design-inspiration.md` was left alone.** It documents MCP server
  setup, not a design direction, so it is not stale in the way the two deleted
  files were.
