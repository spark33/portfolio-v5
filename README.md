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

**The name motif is the signature.** Four encodings of one name:

```
박상현  →  ㅂㅏㄱ ㅅㅏㅇ ㅎㅕㄴ  →  PARK SANGHYEON  →  Sean Park
composed    decomposed            transliterated      resolved
```

Each row is set at the size that makes it occupy the same width as the others,
so what visibly changes down the column is the encoding and not the person.
The last step is deliberately lossy — nothing derived "Sean", it was chosen —
and it carries the only accent in the hero. The two human states (composed,
resolved) are large; the two mechanical ones are small.

Sizes are derived from measured set widths, not a modular scale, and are
expressed in container units so the fill is exact at every viewport. If a
string changes, re-measure — the numbers are in
[`src/home.css`](src/home.css).

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
| `src/home.css`          | The name sequence, thesis, position strip                    |
| `src/case.css`          | Case studies and artifact pages — the decision spine         |
| `src/index-rows.css`    | Constraint-first index rows                                  |
| `src/name-sequence.ts`  | The loader, behind one interface                             |
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

There is one animation: the name sequence staggers in on a first visit. That
is all.

It is gated by an inline script in the head, so the first frame is already
correct and nothing flashes. It never runs under `prefers-reduced-motion:
reduce`, never runs on a repeat visit (`localStorage`), and a 2 s failsafe in
that same script reveals the sequence if the module never loads. With JS off
the script never runs and the page is simply already finished.

The placeholder uses the Web Animations API and reads its curve from the
`--ease-resolve` custom property, so a tween and a CSS transition cannot drift.
Two things were removed during the build and should stay removed unless
something changes:

- **GSAP** cost 70 KB to stagger four rows. The replacement is isolated behind
  `mountNameSequence`, so the WebGL version is free to pull in whatever it
  genuinely needs.
- **ScrollTrigger** faded in the position strip, which left the site's
  credentials at `opacity: 0` until the reader happened to scroll past. On a
  site with a three-minute budget, scroll now only scrolls.

**Lenis was never added.** There are no scroll-linked scenes to smooth and it
degrades keyboard and screen-reader scrolling.

### The loader interface

A WebGL implementation of the name sequence is being built separately. It drops
in behind one function:

```ts
mountNameSequence(root: HTMLElement): { destroy(): void }
```

The contract, enforced by `tests/quality-floor.spec.ts`:

- The server already rendered the finished sequence into `root`. Mounting
  enhances something complete; it is never what makes the name appear.
- `destroy()` releases everything and leaves the DOM in its finished state.
- Nothing runs under reduced motion or on a repeat visit. Both are decided
  before mount.

## Quality floor

`npm test` enforces the non-negotiables rather than leaving them as intentions:
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
