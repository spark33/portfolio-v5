# Iteration log

Ten critique passes against [`docs/iteration-brief.md`](iteration-brief.md),
then one creativity pass with a different brief and a different method. Each
critique
pass: build, screenshot every page at 1440 / 768 / 390 in both themes, look at
the screenshots, name the single largest gap, fix that one gap, run the whole
Playwright suite. The creativity pass is written up at the end and worked the
other way round — three prototypes first, then a choice, then a build.

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

---

# Creativity pass B

A different brief: the site scored well on Usability and Content, defensibly on
Design, and badly on Creativity. Ten passes of restraint had produced something
with no moment anyone would remember, and typography was carrying the entire
visual load. The instruction was to give the type *less* to carry and find the
idea somewhere else — in the site's own material, not in a trend — and the JS
budget was lifted to pay for it.

Method: three throwaway prototypes, screenshots of each at 1440, 390 and 300px
in both themes, a written choice, then a proper build. The prototypes and the
verdict on each are in [`prototypes/`](../prototypes/).

## What the 300px frame decided

`scripts/thumb.mjs` was written first, because the argument that the site is
"defensible on Design" collapses the moment you look at what a juror actually
sees first: a card about 300px wide, before they open anything. At 300px the
site was a grey rectangle with grey type in it. Every direction was judged
there as well as at 1440.

## Reference check

`www.awwwards.com` was reachable. Six current Sites of the Day were pulled as
full submission screenshots from the `og:image` of `/sites/<slug>` —
**mosbys-files**, **no-art**, **izanami**, **hearst-exhibit-2026**,
**hiroto-sato**, **revelatio-studio** — chosen because none of them is
type-led, which was the question.

**Mosby's Files** was the useful one, and it is the closest thing to this site
in the set: an archive, text-first, no photography. Its second system is a
stack of coloured folder tabs that also does the navigation. Two things it
settles. A second system is usually **an object metaphor rendered as flat
structural shapes**, and it usually **carries navigation as well as identity**,
which is what stops it being wallpaper. And its tabs pass the "would this look
the same for another client" test only because a filing tab is what an archive
*is* — the same shapes on a bakery would be decoration.

**No Art** was the second useful one: monochrome, restrained, and it gets an
enormous amount of identity out of visible grain, a page-as-a-card on a darker
field, and corner registration marks. Almost none of it costs anything. That
is the register this site can actually reach.

The other four are photographic or 3D and suggested nothing here. Recording
them because looking and finding nothing is a result.

## The three prototypes

**P1 — 착점, "the played point".** The page is standing on a board that already
has stones on it. Argued from the lattice and the nine 화점 nobody can see.

**P2 — 인, "the impression".** A record is not finished until it is stamped, and
the seal is the moment a person becomes official to a system that was not built
for them. Argued from two claims `src/tokens.css` already makes in writing and
had never made good on in pixels: that the accent is 인주, and that the ground
is archival board.

**P3 — 집, "territory".** The index is not a list; three constraints had already
divided the board, so draw the division and let the ground commit to a colour.
Argued from the `Decision` type, which cannot be written without a cost.

## The choice, and what the other two did better

**P2, and it was not close on the test that matters.**

The brief's own question is whether a thing would look the same for a different
client. P3 is the strongest thumbnail of the three by a wide margin — four flat
fields, unmissable at 300px — and it is the only one that fails that question
outright. Stacked full-bleed colour bands would look identical for a law firm or
a record label; the connection to 집 lives in the caption and nowhere in the
pixels. Two smaller faults confirm it. The cinnabar band is the third constraint
for no reason anyone could state, which breaks the rule that the accent is
load-bearing. And committing the ground to near-black makes the light theme the
odd one out on a site whose two themes are deliberately equal citizens.

P1 did one thing better than either of the others, and it is in the build: it
found that **what makes a lattice read as a board is the edge, not the line
weight.** Raising the field alpha to 0.30 produced graph paper — exactly what
the note in `src/board.css` predicts in writing, so the note was right and
running the experiment was how to find that out. A board ends; graph paper runs
off the sheet. P1 also lost on its own central idea: its stones sit on real
intersections, but *which* intersections is arbitrary, and to anyone who plays
the position is nonsense. The audience most likely to recognise the reference is
the audience most likely to see that it is fabricated, which is the same defect
as inventing a metric. They also landed on top of the display type at 1440.

P2 wins because the impression is the only object in the three that could not be
lifted onto somebody else's portfolio, and because it is the only one whose
central claim the codebase had already written down and never delivered.

## What was built

**The impression.** [`lib/seal.ts`](../lib/seal.ts) draws a 백문방인 — an
authored irregular edge, a displacement filter so the block bites unevenly, a
second noise field thresholded into the patches where the paste ran thin, and
박상현 carved out of the ink. Not seal script: his own name, set in the
Pretendard the site already carries, so nothing here is a fabricated artefact.

The rule is one sentence: **the seal stamps the page's record.** Home and about
stamp the four figures, a case study stamps its outcome, the share card stamps
the claim. Artifact pages and the blog have none, because documentation is not a
claim about the world, and a mark on every page would be a logo. It is the one
element allowed to ignore the board — rotated 2.4°, hanging 3.5rem into the
column gap the board puts between the argument and the evidence.

At type size it is the same object with the name gone: the current-page marker
in the navigation is that broken edge as a clip path, shared through one custom
property. Largest and smallest use, one object.

The share card was regenerated to carry it, from the same module rather than a
second drawing of the same idea — the card is the image most readers meet first
and a copy would have been free to drift.

**The edge.** P1's finding, at a measured value rather than P1's. `--board-frame`
is 0.34 light and 0.14 dark, both measuring 1.35 against the ground, a shade
over three times the field's 1.09. Only the two vertical sides: the board runs
down the page for as long as the page is long, so a bottom line would be
claiming an end that is not there.

**The tooth.** One 140px tile of fractal noise, inlined, no request and no blend
mode — deliberately, since `mix-blend-mode` on a viewport-sized layer pulls
everything under it into a compositing group and this site is judged on a
mid-range Android. It only ever lightens: the colour matrix discards the noise's
colour, paints white, and derives alpha from luminance, and dark inverts the
same tile.

That direction is the whole reason it is safe, and it came out of arithmetic
rather than taste. The first version was mid-grey speckle in both directions.
Cinnabar text on paper is 4.89, which is 0.39 of headroom, and a dark speck
under the `COST` label took the worst-case pixel to **4.29** — a WCAG failure
that nothing in this suite would have caught, because every contrast test reads
computed colours and a texture is not a computed colour. A one-directional tooth
removes the question instead of answering it.

## The JS budget was not spent

The brief lifted the clause restricting JavaScript to two jobs and offered a
real budget for the second system. Total JavaScript is still 1.5 KB.

The second system turned out to be a material and a mark. Both are paint: a
texture belongs in a stylesheet and an impression belongs in an SVG. Every
scripted idea considered — stamping the seal on arrival, filling the board as
the reader scrolls, revealing the lattice on interaction — was a behaviour
invented to justify an allowance rather than something the argument needed, and
two of them were within one step of the entrance animation the same brief bans.
Not spending it is the answer, stated rather than left as an omission.

## The two tests, rewritten

Both encoded the old rule as `document.getAnimations().length === 0`
unconditionally. That was simultaneously too strong and too weak: it banned any
future motion outright, including motion that declines itself correctly, and it
passes for a page with no animation whether or not the preference is honoured —
so on the exact case it was written for, it passed for the wrong reason.
"Identical", likewise, is not a property anyone needs; "complete and usable" is,
and it is testable.

- `the lattice lift is the only motion, and it is optional` →
  **`nothing on the page moves when the reader has declined motion`**. Walks
  every element on three routes under `prefers-reduced-motion: reduce` and fails
  on any running animation, or any transition longer than 20ms — which is what a
  duration written as a literal instead of through a `--dur` token looks like
  once the reduced-motion block has collapsed the tokens to 1ms. Verified
  failing by adding `transition: opacity 400ms linear` to `.seal`.

- `the page is identical when the module never loads` →
  **`every route is complete and navigable with the module blocked`**. Aborts
  the module on all eight routes, checks the argument, the board's layers and
  the ground are in the HTML the server sent, fails on any element parked at
  `opacity: 0` with text in it, and then clicks an index link and asserts it
  arrives — because a page that renders and cannot be navigated is not complete.

Two were added:

- **`the impression is decoration to the layout and a name to a reader`** — the
  seal is `role="img"` with a name, not focusable, and `pointer-events: none`;
  and its box does not intersect any text rect on three pages at five widths.
  Verified failing against the first placement, which covered "renewed".
- **`the board is bounded, and the ground's tooth can only raise contrast`** —
  the edge is more than twice the field and at most 0.5, and the tooth's
  `invert()` is present in dark and absent in light. The direction is the
  property, so the filter is the thing asserted.

## Numbers

Lighthouse, mobile profile, after the build:

| Route | Perf | A11y | Best practices | SEO | CLS | LCP |
| ----- | ---- | ---- | -------------- | --- | --- | --- |
| `/` | 100 | 100 | 100 | 100 | 0.002 | 1.5 s |
| `/work/` | 100 | 100 | 100 | 100 | 0 | 1.5 s |
| `/work/inherited-mental-model/` | 100 | 100 | 100 | 100 | 0 | 1.5 s |
| `/about/` | 100 | 100 | 100 | 100 | 0 | 1.5 s |
| `/logician-ui/` | 100 | 100 | 100 | 100 | 0 | 1.5 s |
| `/blog/` | 100 | 100 | 100 | 100 | 0 | 1.5 s |
| `/404.html` | 100 | 100 | 100 | **63** | 0 | 1.5 s |

TBT 0ms throughout. Identical to the baseline: an SVG filter that paints once
and a tiled data URI cost nothing measurable. The 404's SEO score is 63 because
Lighthouse marks down any page blocked from indexing, which is the correct
number for a 404.

**Tests:** 58 passing, from 56. Two rewritten in place, two added, none
weakened. All four verified failing against the state they were written for.

## What I did not do, and why

- **The thumbnail is better, not solved.** At 300px the site is now a grey
  rectangle with a red stamp on it rather than a grey rectangle. That is a real
  gain in recognisability and a specific one — nobody else's card has a 인장 on
  it — but P3's four flat fields were unambiguously louder, and I traded loudness
  for a mark that means something. If the verdict comes back that the card is
  still too quiet, the honest next move is the ground, not more marks.
- **The work index has no seal.** It is a list, not a record, so the rule
  excludes it — and it is the second page a juror opens. I think the rule is
  worth more than the coverage, but I am not certain.
- **The `COST` field was left as cinnabar text.** The obvious third scale of the
  impression is a bitten mark on the field the site cares most about, and the
  cost is already the most emphasised thing in the rail. Two red things saying
  the same thing is louder than this site's register. Deliberate, and reversible.
- **The board's `--board-base` is untouched.** The brief asked whether it earns
  its space. The answer this pass gives is that the *field* was never the
  problem — the missing edge was — so the calibrated 1.087 stands. The stronger
  claim, that the board earns its place because the seal has something to ignore,
  is now true in a way it was not before.
- **Type was not touched at all.** The brief asked for the type to be given less
  to carry, and it now carries less because there is something else on the page,
  not because anything about it changed. Reducing the display scale on top of
  that would have been two experiments at once.
- **Still no testing on a real mid-range Android.** Everything here is Chromium
  at a throttled profile. The tooth is the first thing on this site whose cost is
  a paint rather than a byte, and a throttled desktop is not the same evidence.
- **The five `{{?}}` placeholders and the placeholder blog post** are untouched,
  as instructed.

---

# Creativity pass B, second look — the seal was the wrong object

The pass above shipped a 인장 impression as the site's second visual system.
The review of it was one sentence: *that feels very traditional.* It was right,
and the seal is gone.

## Why it was wrong, stated properly

Two faults, and the first is the one worth remembering.

**The object was inherited, not argued.** `src/tokens.css` had mentioned seal
paste in a comment since the first commit, and the brief for the pass listed the
seal as a lead by name. So it arrived pre-approved from two directions at once
and was never put through the test every other decision on this site has to
pass. The pass's own write-up says it plainly without noticing: "the only one
whose central claim the codebase had already written down and never delivered."
That is a reason to *notice* something. It is not a reason to build it. A
comment written by the same author two months earlier is not evidence.

**The register was wrong for the subject.** A broken edge, skipped paste, worn
stone — those are the marks of an artefact that has survived, and they say *this
is old and authentic*. The person is running product and delivery on a multi-LLM
assistant in Seoul in 2026. The execution was arguing for heritage on behalf of
someone whose whole case is systems work.

Everything else from the pass stands: the board's edge, the ground's tooth, the
unspent JavaScript budget, and both rewritten tests.

## What replaced it — 모아쓰기

Hangul does not run its letters in a line. It gathers them into a square. 가
holds two jamo and 뷁 holds four, and both occupy exactly the same frame — fixed
in 1443, not negotiable, and the entire design problem is how the parts are
arranged to fit inside it.

That is not a metaphor for this site's argument. It is the argument, in the
writing system the author's own name is written in, and it is the site's own
grid at a different scale: `--u` never changes either, and every layout decision
here is a composition inside a cell count somebody else set.

A seal says *this is old and authentic*. 모아쓰기 says *this is a system, and I
work inside it*.

## The measurement that made it

The geometry was going to be guessed. A pixel scan of Pretendard 600 — render a
glyph to a canvas, count ink per row and per column — was meant to settle where
the 종성 boundary sits, and it returned something better on the way:

```
바  rows 210–487     (초성 + 중성)
박  rows 201–465     (초성 + 중성 + 종성)
```

**Adding a letter makes the block shorter.** The 초성 and 중성 compress upward
to make room for the 종성; the frame does not grow to accommodate what you put
in it. That is the whole thesis in two rows of a scan, and it is why the mark
had to be measured rather than styled.

The boundary itself is a real gap in the ink at **60.2–64.8%** of the glyph's
height in both 박 and 상 — 현 has no gap, because ㅕ's lower arm reaches into the
same band, but the structure is identical. The division is drawn at 62%.

## The four treatments, and the two rounds

`prototypes/p4-composition.html` guessed the geometry and tried four
treatments; `p4b-composition.html` rebuilt them on the measurement.

- **R1 — frame in ink, division in the accent.** A type specimen. Elegant, and
  far too quiet for the problem this pass exists to solve.
- **R2 — the composition alone, no glyph.** 초성 filled, 중성 open, 종성 in the
  accent. The strongest *small* mark of the four by a distance, and pure
  proportion taken from a real name. It lost because its meaning is invisible
  without the name in it: at 34px it is three black-white-red blocks, and there
  is nothing to tell a reader they are a name rather than a Bauhaus exercise.
- **R3 — the 종성 as a field per syllable, glyph reversed out.** Chosen. One
  letterform cut by the boundary its own final consonant sits under. It carries
  R2's geometry *and* reads as a name at 34px.
- **R4 — R3 on the board's own cell grid.** The extra subdivision fought the
  letterforms and added nothing the frame was not already saying.

## What was built

`lib/block.ts` replaces `lib/seal.ts`; `src/block.css` replaces `src/seal.css`.

The rule is unchanged and the verb is better: **the mark signs the page's
record.** Home and about sign the four figures, a case study signs its outcome,
the share card signs the claim; artifact pages and the blog have none.

Two placement decisions differ from the seal's, both because the object is
different rather than because the old ones were wrong:

- **It is not rotated.** The seal sat 2.4° off axis because a stamp is pressed
  by a hand. A syllable block is drawn to a frame, and tilting it would argue
  against the only thing it says.
- **It does not hang.** At full width in the margin, its two ends land on the
  same verticals as the record's rules, so it reads as the last row of the
  ledger — the name signing the figures — rather than as a logo parked beside
  them.

At type size the current-page marker is no longer a bitten square but a bar at
the 종성 band's own aspect, 41.8%, shared with the SVG through one custom
property. Largest and smallest use, one measurement.

## Tests

`the impression is decoration to the layout and a name to a reader` became
**`the mark is a name to a reader and never lands on a word`** — same guard,
new object. It was written for a defect the seal caused (pulled up over the
caption, covering "renewed") and the seal is now gone; the test outlived it,
which is the argument for writing tests against properties rather than objects.

One added: **`the mark's smallest use is the same measurement as its largest`**
— the navigation marker's height-to-width ratio equals `--jongseong-ratio`, so
the two scales cannot drift into being two unrelated uses of a colour.

59 passing, from 58.

## Numbers

Unchanged. Mobile Lighthouse 100 / 100 / 100 / 100 on `/`, `/work/`,
`/work/inherited-mental-model/`, `/about/`, `/logician-ui/` and `/blog/`; CLS
0.002 on the home page and 0 elsewhere; LCP 1.5 s. The mark is a smaller SVG
than the seal was — no filters, no turbulence, no displacement.

## What I did not do

- **R2 is not used anywhere.** As a glyphless proportion it is the better mark
  at very small sizes, and the site has one very small size — the navigation
  marker, which now uses only the band. Giving the marker R2's full three-zone
  geometry at 7px was tried in my head and not on screen; it belongs in a later
  pass with a screenshot attached.
- **The board and the tooth were not revisited.** The critique was about the
  symbolism, and both of those are structure and material rather than symbol.
- **`docs/iteration-brief.md` still lists the seal as lead #3.** It is a record
  of what was asked, not of what was decided, so it stays as written.
