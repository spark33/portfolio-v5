# portfolio-v5

Portfolio site for Sean Park — 박상현. Vite MPA + TypeScript, no framework.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # Playwright (starts its own preview server)
npm run shots      # screenshots at 1440 / 768 / 390 into shots/
npm run storybook  # component workbench on http://localhost:6006
```

## The argument

The site makes one claim: designing well inside constraints you did not choose
is a different skill from designing in the open, and it is the one most
companies hiring actually need. Everything structural serves that claim.

**Every project is introduced by its constraint, before its title.** On the
index the constraint is the heading and the project name is subordinate to it,
so you cannot read the name before the pressure that produced it. On a case
study the constraint is the `<h1>`. This is enforced by the content types in
[`content/site.ts`](content/site.ts): a `CaseStudy` cannot be written without a
`constraint`, and a `Decision` cannot be written without a `cost`. A decision
with no cost is a preference.

**바둑 is the substrate, not the picture.** The board is never drawn. Three
rules survive from it, in [`lib/board.ts`](lib/board.ts):

- **Lattice.** Nineteen square cells across the measure. Everything places on
  an intersection; nothing is nudged or centred by eye.
- **Influence (세력).** A stone radiates over the space around it and a stronger
  position reaches further. Every block declares a weight; clearance is
  `0.3 + weight × 0.28` cells; blocks resolve in order of initiative, the
  strongest holding its intersection while weaker ones yield down the board.
  Negative space is *allocated by rank* rather than left over.
- **Star points (화점).** A real board's only marks are nine reference dots, at
  lines 4, 10 and 16. They are the sole thing that surfaces — a baduk player
  reads them immediately, everyone else reads registration marks.

The solve runs at **build time** and emits cell coordinates into the HTML, so
the composition is correct in the first paint and identical with JavaScript
off. The whole client-side board is two pointer coordinates.

`?board` on any URL draws the lattice and every block's claimed influence. It
is a URL rather than a hover so it works for a keyboard, a screenshot and a
phone.

## Layout

| Path                    | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `content/site.ts`       | Every word the site sets, as typed data. The only place to write copy |
| `content/posts/`        | Blog posts — markdown with frontmatter                       |
| `lib/shell.ts`          | The one HTML shell: head, nav, footer, structured data       |
| `lib/pages.ts`          | Page renderers — home, case study, artifact, about           |
| `lib/blog.ts`           | Markdown pipeline, rendered into the same shell              |
| `plugins/site.ts`       | Writes every page to its URL path and registers MPA inputs   |
| `src/tokens.css`        | Palette, type scale, tracking, spacing, easing               |
| `src/base.css`          | Reset, type primitives, strips, focus, page frame            |
| `lib/board.ts`          | The lattice, influence and the build-time solver              |
| `src/board.css`         | The board's visible surface — lattice, hoshi, solved field    |
| `src/board.ts`          | The only client script: two pointer coordinates               |
| `src/home.css`          | Thesis and position strip                                     |
| `src/case.css`          | Case studies and artifact pages — the decision spine         |
| `src/index-rows.css`    | Constraint-first index rows                                  |
| `scripts/fetch-fonts.py`| Regenerates `public/fonts/` and `src/fonts.css`              |

Pages are generated to their URL path at the repo root (`work/…/index.html`)
so Vite emits them at that path in `dist/`. Those directories are gitignored;
`content/` is the source of truth.

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

The accent appears in exactly three places: the lossy step of the name, the
`COST` field of every decision, and the current-page marker. A seal is a person
made official to a system that was not built for them, which is the thesis, so
it is load-bearing rather than decorative.

Light only, committed via `color-scheme: light`.

## Motion

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

The rest:
every route readable and parseable with JS disabled, one non-empty `<h1>` and
valid schema.org on every page, the constraint preceding the title, a `COST`
field on every decision, reduced-motion and repeat-visit skips, the module-fails
failsafe, a visible focus ring on every tabbable element, WCAG AA contrast, and
CLS under 0.05.

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

Set **`SITE_ORIGIN`** (e.g. `https://seanpark.dev`) to emit `sitemap.xml` and
have `robots.txt` reference it. Without it — and without Vercel's
`VERCEL_PROJECT_PRODUCTION_URL` — no sitemap is written at all, because a
sitemap full of placeholder URLs is worse than none.

## Unknown metrics

`{{?}}` in `content/site.ts` renders as a visible "not yet measured" chip.
Numbers that are not known are shown as unknown; they are never invented.
Current gaps: LogicianUI coverage and component count, harness time recovered,
support volume on the agents/add-ons distinction, and two retention figures on
the 한국장학재단 project.

## Research

[`docs/references.md`](docs/references.md) and
[`docs/concept.md`](docs/concept.md) predate this direction and describe an
earlier editorial/interactive-figure concept. They are kept for the reasoning,
not as a spec.
