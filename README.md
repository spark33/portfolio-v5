# portfolio-v5

Portfolio site for Sean Park — 박상현. Vite MPA + TypeScript, no framework.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # Playwright (starts its own preview server)
npm run shots      # screenshots at 1440 / 768 / 390 into shots/
npm run thumb      # one page at 1440 / 390 / 300 — the card a juror sees
npm run storybook  # component workbench on http://localhost:6006
```

## The argument

The site makes one claim: designing well inside constraints you did not choose
is a different skill from designing in the open, and it is the one most
companies hiring actually need. Everything structural serves that claim.

**Every project is introduced by its constraint, before its title.** On the
index the constraint is an `<h3>` and the project name is subordinate to it,
so you cannot read the name before the pressure that produced it. On a case
study the constraint is the `<h1>`. This is enforced by the content types in
[`content/site.ts`](content/site.ts): a `CaseStudy` cannot be written without a
`constraint`, and a `Decision` cannot be written without a `cost`. A decision
with no cost is a preference.

**The page is a person talking.** The home page is first-person prose, and the
links live inside the sentences rather than in an index. Each chip names an
entity and the fact that makes it mean something — `FactChat · 400+
INSTITUTIONS`. The reference this borrows from uses favicons, which work
because its nouns are Microsoft and Behance; every noun here is one no reader
recognises, so the fact carries what a mark otherwise would.

**바둑 is the substrate, not the picture.** The board is never drawn. Two rules
survive from it, in [`lib/board.ts`](lib/board.ts) and
[`src/board.css`](src/board.css):

- **Lattice.** Nineteen square cells across the measure, stepping to 12 and 7
  as the viewport narrows. Both columns of the home page are cut from it: the
  narrative runs in the first 10.5 cells, the margin note starts at cell 12.
- **Star points (화점).** A real board's only marks are nine reference dots, at
  lines 4, 10 and 16. They are the sole thing that surfaces — a baduk player
  reads them immediately, everyone else reads registration marks.
- **The edge.** Nineteen lines and then a boundary. This is what separates a
  board from graph paper, and it is the one thing the lattice was missing:
  raising the *field* to board strength produces graph paper, which is what
  `src/board.css` predicted in writing and a prototype confirmed. The edge is
  its own token at three times the field's contrast, and only the two vertical
  sides — the board continues down the page for as long as the page is long,
  so a bottom line would be claiming an end that is not there.

The lattice, the edge and the hoshi are CSS backgrounds and borders, so they
need no SVG, no script and no knowledge of page height. `?board` on any URL
draws them, as a URL rather than a hover so it works for a keyboard, a
screenshot and a phone.

## Two marks that were tried and cut

The site has no logo, no monogram and no emblem, and that is now a decision
rather than an omission. Two passes tried to give it one and both were removed.

**A 인장 impression** — a cinnabar block with a broken edge, skipped paste and
박상현 carved out of it. Two faults. The object was inherited rather than
argued: `src/tokens.css` had mentioned seal paste in a comment and the brief
listed it as a lead, so it arrived pre-approved and was never tested against the
person it represents. And the register was wrong — worn stone says *this is old
and authentic*, and the subject ships a multi-LLM product in Seoul in 2026.

**A 모아쓰기 syllable block** — 박상현 as three abutting frames with the accent
filling below a measured 62% division, the boundary a Hangul final consonant
sits under. Better argued: Hangul gathers its letters into a fixed square, which
is this site's thesis in the writing system the name is written in, and the
geometry came from a pixel scan of Pretendard rather than from taste.

It was cut anyway, and the reason is the one that matters: **on a site about a
person, an emblem of that person's name is the one thing on the page doing no
work.** Everything else here is evidence — a constraint, a decision, a cost, a
number. A mark is an assertion of identity, and identity was never the thing in
doubt. It also took the largest position in the evidence column, so the loudest
element on the first screen was the element carrying the least.

What is left is what was always enough: the accent in three places, the board,
and the type. The reasoning survives in `docs/iteration-log.md` and the
prototypes in `prototypes/`, because a direction that was built, looked at and
rejected is worth more written down than deleted.

## Material

The ground is board, and until the creativity pass that was also only a
sentence. `.tooth` in `src/board.css` is one 140px tile of fractal noise inlined
as a data URI — no raster asset, no request, no blend mode.

**It only ever lightens.** The colour matrix discards the noise's colour, paints
flat white and derives alpha from luminance; dark inverts the same tile to
black. So on paper the ground moves up and away from the ink, and on the
near-black it moves down — contrast can only rise. That is not a preference. An
earlier version was mid-grey speckle in both directions, and cinnabar text on
paper is 4.89, which is 0.39 of headroom: a dark speck under the COST label took
the worst-case pixel to 4.29. No test on this site would have caught it, because
every contrast test reads computed colours and a texture is not a computed
colour. `the board is bounded, and the ground's tooth can only raise contrast`
asserts the `invert()` instead, because the direction is the property.

The influence solver that placed the old hero's blocks has been **deleted**
along with the CSS that styled them — eight classes appearing in zero rendered
pages. It is in git history if a narrative page ever grows something for it to
resolve.

## Layout

| Path                    | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `content/site.ts`       | Every word the site sets, as typed data. The only place to write copy |
| `scripts/og.mjs`        | Regenerates the committed share card at `public/og.png`       |
| `content/posts/`        | Blog posts — markdown with frontmatter                       |
| `lib/shell.ts`          | The one HTML shell: head, nav, footer, structured data       |
| `lib/pages.ts`          | Page renderers — home, case study, artifact, about           |
| `lib/blog.ts`           | Markdown pipeline, rendered into the same shell              |
| `plugins/site.ts`       | Writes every page to its URL path and registers MPA inputs   |
| `src/tokens.css`        | Palette, type scale, tracking, spacing, easing               |
| `src/base.css`          | Reset, type primitives, strips, focus, page frame            |
| `src/board.css`         | The board's visible surface — lattice, edge, hoshi and tooth   |
| `src/board.ts`          | The only client script: two pointer coordinates               |
| `src/home.css`          | Thesis and position strip                                     |
| `src/case.css`          | Case studies and artifact pages — the decision spine         |
| `src/index-rows.css`    | Constraint-first index rows                                  |
| `scripts/fetch-fonts.py`| Regenerates `public/fonts/` and `src/fonts.css`              |
| `scripts/screenshots.mjs`| Every page at three widths in both themes, into `shots/`     |
| `scripts/thumb.mjs`     | One page at 1440, 390 and 300px — the card a juror sees first  |

Pages are generated to their URL path at the repo root (`work/…/index.html`)
so Vite emits them at that path in `dist/`. Those directories are gitignored;
`content/` is the source of truth. `404.html` is generated alongside them and
is deliberately absent from `routes`, so it never reaches the sitemap.

**The margin note** is the site's one composition primitive above 80rem: a
column of labelled fields beside the argument they qualify, on a board split of
thirteen cells of spine, one of gutter, five of margin. The home page's record,
a case study's role and period, an artifact's status and a post's date all use
it. Thirteen cells at 1440 is 897px, which is exactly the 10rem rail plus the
2rem gap plus the 42rem measure a case study sets. Below 80rem it collapses to
a band above the argument; the note is first in the DOM either way, so reading
order never depended on the grid.

**A measure belongs on the element that carries the type size.** `ch` and
`rem` resolve against whatever font-size is in scope, so a measure written for
18px body copy and inherited by a 124px headline is seven times too narrow.
That shipped three times — `22ch` on the work-index wrapper, `34rem` on every
`.prose` child, and `.story > p` outweighing `.contact` — and each time the
result was display type broken into one-word lines. `.display-measure` in
`src/base.css` exists to be put on the heading itself.

## Type

Three faces, three jobs.

| Face                  | Cap | x-height | x/cap | Role                    |
| --------------------- | --- | -------- | ----- | ----------------------- |
| **Pretendard**        | 707 | 530      | 0.750 | Korean                  |
| **Schibsted Grotesk** | 703 | 527      | 0.750 | Display and text        |
| **IBM Plex Mono**     | 698 | 516      | 0.739 | Labels, fields, metrics |

Per 1000 em, measured with fontTools. Schibsted Grotesk is a metric twin of
Pretendard — cap within 0.6%, x-height within 0.6%, an identical x/cap ratio,
stroke within 7% — so Korean and Latin share a baseline with no optical
fudging. Nothing else tested matched on all four axes. Its provenance suits
the register too: it was commissioned for Scandinavia's largest news
publisher, which is institutional rather than startup.

Korean breaks at word boundaries (어절), not between syllable blocks, so
`:lang(ko)` carries `word-break: keep-all`. The browser default is the
opposite and set the home page's `h1` as "박상 / 현".

Pretendard is subset to the Korean the site actually sets, which takes it from
1.5 MB to 2.1 KB. Adding Korean copy without adding it to `KOREAN` in
`scripts/fetch-fonts.py` will silently fall back to a system face and break the
baseline match.

Fonts total 69.7 KB, self-hosted, OFL 1.1.

## Colour

Archival-board grey, not the cream a display serif usually sits on, and
deliberately not a cool blue-grey: FactChat's own palette is blue-grey and the
site must not wear its employer's colours.

| Token              | Hex       | Use                                        |
| ------------------ | --------- | ------------------------------------------ |
| `--paper`          | `#e9e9e3` | Ground                                     |
| `--paper-recessed` | `#deded7` | Table zebra, code wells                    |
| `--rule`           | `#c4c4ba` | The one rule colour, one weight            |
| `--ink`            | `#1a1a16` | Text                                       |
| `--ink-secondary`  | `#5c5c55` | Labels, meta                               |
| `--seal`           | `#b4372b` | The accent — 인주, official seal cinnabar   |

The accent appears in exactly three places: the `COST` field of every decision,
the current-page marker, and the share card. A cost is what a decision took from
you, which is the thesis, so the accent is load-bearing rather than decorative —
and it is a 7px square, because two attempts at growing it into a mark both
ended up saying less than the field it already marks.

Dark is not an inversion. The ground keeps the same warm-neutral hue, dropped
to a near-black, and the ink and accent are chosen to hit the same contrast
relationships light already passes:

| | light | dark |
| --- | --- | --- |
| ink / paper | 14.32 | 14.75 |
| ink-secondary | 5.53 | 6.42 |
| seal | 4.89 | 5.78 |

The accent has to lift: `#b4372b` on a near-black is 2.4, which fails
everything, so dark uses `#e2705a` — the same cinnabar at a luminance the
ground can carry. The lattice needs roughly **half** the alpha in dark
(0.045 vs 0.095) for the same 1.09 contrast, because a light line gains on a
dark ground far faster than a dark line gains on paper.

That halving is not a law, it is a local approximation, and the board's edge is
where it breaks: both lattice values sit on the flat part of the curve, but at
edge strength 0.20 in dark measures 1.567 against light's 1.352. The edge
carries 0.34 / 0.14. Both numbers are in `src/tokens.css` with their working.

The system preference decides by default; an explicit choice overrides it in
both directions and persists. It is applied by an inline script in the head
before the first paint, so there is no flash. The toggle holds its space from
the first paint too — using the `hidden` attribute instead cost 0.047 CLS when
revealing it reflowed the masthead.

## Motion

`docs/iteration-brief.md` originally allowed JavaScript exactly two jobs. The
creativity pass lifted that clause and offered a real script budget for a second
visual system; **the budget was not spent**, and total JavaScript is still
1.5 KB. The second system turned out to be a material and a mark, and both are
paint, and a texture belongs in a stylesheet.
Spending the allowance would have meant inventing a behaviour to justify it.

What did change is what the tests assert. Two of them encoded the old rule as
`document.getAnimations().length === 0` unconditionally, which was both too
strong — it banned any future motion, including motion that declines itself
correctly — and too weak, since a page with no animation returns zero whether or
not the preference is honoured. They now assert the properties that actually
matter, and are named after them:

- `nothing on the page moves when the reader has declined motion` walks every
  element under `prefers-reduced-motion: reduce` and fails on any running
  animation or any transition longer than 20ms, which is what a duration
  written as a literal instead of through a `--dur` token looks like.
- `every route is complete and navigable with the module blocked` visits all
  eight routes with the module aborted, checks the argument and the board are
  in the HTML the server sent, fails on any element parked at `opacity: 0` with
  text in it, and then follows a link to prove the site is still a site.

There is one piece of motion on the site: a brighter copy of the lattice,
masked to a disc that follows the pointer. It does not conjure a grid out of
nothing — it raises the contrast of structure already on the page, which is the
difference between this and a flashlight effect. Under
`prefers-reduced-motion: reduce`, or on any device without a pointer, it is not
rendered and the ambient lattice is the whole design.

Three things were removed during the build and should stay removed unless
something changes:

- **GSAP** cost 70 KB to stagger four rows.
- **ScrollTrigger** faded in the position strip, which left the site's
  credentials at `opacity: 0` until the reader happened to scroll past. On a
  site with a three-minute budget, scroll only scrolls.
- **The name sequence.** 박상현 → ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ → PARK SANGHYEON → Sean
  Park was the previous motif and is gone, along with `src/name-sequence.ts`
  and the `mountNameSequence` interface a WebGL implementation was to drop
  into. Nothing hosts that work now; re-adding a mount point is small if it is
  wanted somewhere.

**Lenis was never added.** There are no scroll-linked scenes to smooth and it
degrades keyboard and screen-reader scrolling.

## Quality floor

`npm test` enforces the non-negotiables rather than leaving them as intentions.

[`tests/board.spec.ts`](tests/board.spec.ts) is what makes a build-time solver
safe. Blocks declare their height in cells because the solver cannot measure
text, so the tests measure it instead — **across 1280…2560px**, reporting the
value to use when a declaration drifts. Checking a single width is not enough:
the cell shrinks with the viewport faster than text does, and an earlier version
of that file went green at 1440 while the lede overflowed its cells at 1100.
That is also why the board only applies from 80rem up.

Two defect classes shipped three times each before anything caught them, and
both are now tested as classes rather than patched as instances:

- **Silent overflow.** A chip measured 398px inside a 358px column at 390px
  wide and lost its last words — with no symptom, because `overflow-x: clip`
  was hiding it. That rule existed for a cropped hero that no longer exists; it
  is gone, and a test now fails on any element crossing the viewport edge at
  320, 360, 390 and 414.
- **Separation that is not in the text.** A `::before` placeholder with no
  text content, a `<br>` hidden on mobile that welded "not empty" to "when",
  and a flex gap that rendered `LogicianUIour design system`. Gaps,
  pseudo-content and hidden breaks are invisible to reader mode, text
  extraction and screen readers. A test now walks the rendered text of every
  page and fails on welded words.

A third class was added during the critique passes, and it is the same shape
as the first two — a rule written for a container silently deciding something
about its contents:

- **Display type in a body-copy measure.** `display headings are not broken
  into one-word lines` counts characters per line across every `display-*`
  element at 1440. The two states it was written against measured 5 and 10; a
  healthy heading measures 18 or more.
- **Korean broken mid-name.** `no Korean run is broken across lines` asserts
  that a space-free `[lang="ko"]` run occupies exactly one line box, at four
  widths across three pages.

A fourth was added by the creativity pass, and it is the first two arriving
from a new direction — something positioned to break the layout breaking the
copy instead:

- **A mark over a word.** A seal, placed the way a stamp lands on a real
  document — pulled up over the record's caption, where it covered "renewed".
  The test written for it outlived the seal and was then removed with the second
  mark, because nothing on the site is positioned to overlap anything any more
  and the assertion would run against an empty set. Recorded here so the next
  absolutely-positioned thing gets the test back before it ships.

The rest:
every route readable and parseable with JS disabled, one non-empty `<h1>` and
valid schema.org on every page, the constraint preceding the title, a `COST`
field on every decision, the home page's claim carried by a heading that
outranks the constraints beneath it, reduced-motion and repeat-visit skips, the
module-fails failsafe, a visible focus ring on every tabbable element, a theme
toggle that keeps a control's proportions, a 404 that is `noindex` and offers
every route, a share card that is served and only advertised with an absolute
URL, WCAG AA contrast, CLS under 0.05, the board's edge stronger than its field
and weaker than a rule, and the tooth one-directional in both themes.

Lighthouse, mobile profile (Moto G-class, 4× CPU throttle, slow 4G):

| Page          | Perf | A11y | Best practices | SEO | LCP   | TBT  | CLS |
| ------------- | ---- | ---- | -------------- | --- | ----- | ---- | --- |
| `/`           | 100  | 100  | 100            | 100 | 1.5 s | 0 ms | 0   |
| `/work/…/`    | 100  | 100  | 100            | 100 | 1.5 s | 0 ms | 0   |
| `/logician-ui/` | 100 | 100 | 100            | 100 | 1.5 s | 0 ms | 0   |

Total JavaScript is 1.5 KB.

## Deployment

Vercel builds this with no configuration; the generated pages are written at
build time, and the committed fonts mean the build needs neither Python nor
network.

Set **`SITE_ORIGIN`** (e.g. `https://seanpark.dev`) to emit `sitemap.xml`, have
`robots.txt` reference it, and advertise the share card. Without it — and
without Vercel's `VERCEL_PROJECT_PRODUCTION_URL` — no sitemap is written and no
`og:image` is declared. A sitemap full of placeholder URLs is worse than none,
and a scraper fetching `og:image` has no page to resolve a relative path
against, so the same rule covers both.

`404.html` is served for unmatched paths with no configuration. `public/og.png`
is committed and regenerated by `node scripts/og.mjs`, which reads the palette
from `src/tokens.css` and the copy from `content/site.ts` — the same
arrangement as the fonts, so the build needs neither a browser nor the
network. Run it again when the claim, the record or the palette changes.

## Unknown metrics

`{{?}}` in `content/site.ts` renders as a visible "not yet measured" chip.
Numbers that are not known are shown as unknown; they are never invented.
Current gaps: LogicianUI coverage and component count, harness time recovered,
support volume on the agents/add-ons distinction, and two retention figures on
the 한국장학재단 project.

## Iterating on this

[`docs/iteration-brief.md`](docs/iteration-brief.md) is a self-contained brief
for a critique-and-refine session: what the target actually rewards, the method,
the hard rules, and the two defect classes this codebase keeps producing. Paste
it as the opening instruction of a fresh session.

[`docs/iteration-log.md`](docs/iteration-log.md) is the record of the ten
critique passes that produced the composition, and of the creativity pass that
gave it a second visual system: the gap each one named, what changed, and what
was left undone.

[`prototypes/`](prototypes/) holds the three throwaway directions that pass
weighed against each other, with the verdict on each. They are not wired into
the site and are kept because the reasoning is worth more than the code.

`docs/concept.md` and `docs/references.md` described an
editorial-with-interactive-figures direction with a WebGL hero, which this site
abandoned. They are deleted rather than kept — two documents describing a
different site mislead a reader, and their reasoning is in git history.
