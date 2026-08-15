# portfolio-v5

Three.js portfolio site. Vite + TypeScript, no framework.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # Playwright tests (starts its own preview server)
npm run shots      # regenerate page screenshots into shots/
npm run storybook  # component workbench on http://localhost:6006
```

## Layout

| Path                 | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `src/main.ts`        | Entry point; boots the scene, disposes it on HMR          |
| `src/scene.ts`       | WebGL scene, render loop, and teardown                    |
| `stories/`           | Storybook stories for the shared pieces                   |
| `.storybook/`        | Storybook config; `preview.ts` loads the real stylesheets |
| `tests/`             | Playwright specs for nav, the home page, and the blog     |
| `src/type.css`       | Type, colour, and nav — the shared system                 |
| `src/article.css`    | Case-study template: masthead, facts, figure, decisions    |
| `src/style.css`      | Home page chrome layered over the canvas                   |
| `content/posts/`     | Blog posts — markdown with frontmatter, the only place you write |
| `lib/blog.ts`        | Loads posts and renders the blog's HTML                   |
| `plugins/blog.ts`    | Generates `blog/` and reloads it in dev                   |
| `src/blog.css`       | Blog index and post styles                                |
| `src/loader/`        | The loading animation; see [Loader](#loader)             |
| `scripts/build-loader.mjs` | Bakes its glyph outlines to SVG path data          |
| `scripts/fetch-fonts.py` | Regenerates `public/fonts/` and `src/fonts.css`       |
| `.mcp.json`          | Design-reference MCP servers                              |

`createScene(canvas)` returns a handle with `dispose()`, which cancels the render
loop, removes listeners, and frees GPU resources. Keep that contract when adding
geometry — every `dispose()`-able you create should be released there.

The scene clamps device pixel ratio to 2 and honours
`prefers-reduced-motion: reduce` by holding both the mesh and the camera still. It
clears to the page's computed background colour and re-reads it when the colour
scheme changes, so the canvas never fights the type for contrast.

## Design

[`docs/concept.md`](docs/concept.md) is the design brief: site architecture, the
interactive-figure system, content model, and performance budget. Written before
implementation; the starter scene in `src/scene.ts` predates it.

## Type

Newsreader for text and headings, IBM Plex Mono for code, in `src/type.css`. It was
chosen by comparing three treatments side by side on real copy; the comparison page
has been removed now that the decision is made, and the rejected treatments (Inter
Tight + Inter, IBM Plex Sans + Mono) are in the git history if it needs revisiting.

Fonts are self-hosted latin-subset woff2 under `public/fonts/` (SIL Open Font
License). Re-run `python3 scripts/fetch-fonts.py` to change the set; it clears the
directory first, so dropping a family leaves nothing behind.

## Loader

`src/loader/` is the loading animation, and the mechanic is the point.

```
ㅂㅏㄱ  ㅅㅏㅇ  ㅎㅕㄴ    nine parts, arriving
박  상  현              three blocks, assembled
SEAN PARK              the name he goes by
```

Hangul is an assembly system: a syllable is not a busy-looking character, it
is a **square built from jamo placed in fixed regions of it**. 박 is ㅂ over ㄱ
with ㅏ down the right-hand side. Loading is assembly — so the loader builds
the name the way the writing system builds it, rather than sliding some
letters around. The parts fly in along the axis their role occupies, the
bottom tier of each block locking before the tier above it, and only once a
block is complete does it snap into the syllable itself.

That is also why it cannot be a stock preloader wearing someone's name: this
animation is specific to *this* name in *this* script, and would have to be
rebuilt from scratch for any other.

**Nothing in the sequence is a cut.** Nine jamo become three syllables become
SEAN PARK, as one continuous chain of the same twenty contours. Twenty become
twelve: the eight with no counterpart collapse to a point inside themselves and
stop having area, which is the lossy half of the transliteration said in
geometry rather than in a caption — 박상현 carries more than SEAN PARK keeps.
The middle of that last morph is the only place the piece is neither Korean nor
Latin, and it gets the longest beat, because that in-between is the most
interesting thing in it.

**The parts do not cut to the syllable — they become it.** Each jamo's outline
morphs into its share of the composed block, contour by contour. That is
possible because the counts line up exactly: 박 has five contours and ㅂㅏㄱ
have 2 + 2 + 1; 상 has six and 2 + 2 + 2; 현 has nine and 4 + 3 + 2. The font
redraws each jamo for its position but keeps its structure, so every contour of
a syllable has exactly one counterpart among its parts — no topology to absorb,
nothing appearing from nowhere or collapsing to a point, and no seam to hide
because there is no seam. Contours are matched by centroid proximity and only
where the winding agrees, then point order is rotation-aligned; without that
last step a morph unwinds and cartwheels.

**Construction is drawn; the result is set.** Each jamo is a baked outline that
draws itself on with `stroke-dashoffset`, the fill catching up behind the line
— the one thing here that could not be done any other way, and what makes the
parts read as drawn rather than as glyphs being faded up. The composed
syllables and SEAN PARK are real text.

Each jamo is fitted to its cell at a **uniform** scale. A real Korean typeface
redraws a jamo for its position; scaling one drawing to fill a cell instead
gives anisotropic strokes — ㄱ squashed into a wide flat cell comes out with
hairline horizontals and heavy verticals — and no amount of easing rescues
that. Uniform keeps every stroke the weight it was drawn at, at the cost of the
parts sitting a little smaller than the block they build. They read as parts,
which is what they are.

The composed syllables and SEAN PARK are real text in a 3.6 KB subset of
Pretendard Variable, animated along its `wght` axis: the parts arrive hairline and gain weight as they lock,
landing at 930 exactly as the counter reaches 100, so the letterforms and the
number are two readings of one signal. `src/loader/layout.ts` holds the cell
table — the regions of the square each role occupies — which is the part worth
reading if the block proportions ever look wrong.

The assembly is drawn in SVG rather than HTML because an SVG `<text>` at
font-size 1 with its origin at (0, 0) puts its ink exactly where the font says
it is, so a jamo can be fitted to a cell arithmetically. The same placement in
HTML would depend on line-height and half-leading.

```sh
npm run storybook
npm run film              # 12-frame filmstrip, dark
npm run film -- 20 light  # 20 frames, light ground
```

The animation is a pure function of normalised time — `apply(t)` derives every
visual property and nothing else touches them — so `npm run film` seeks frame
by frame through `window.__loader` rather than waiting on wall-clock time. The
strip is exact and reproducible, which is what makes the motion iterable rather
than guessable. It is what caught the counter stalling at 100 for the last
quarter of the run, a lone S sitting in an empty frame while the rest of the
word queued behind it, SEAN PARK losing its word space, and the composed
syllables ghosting over their own parts. Frames land in `shots/loader/`
(gitignored).

`npm run build:loader` re-subsets the font from Pretendard Variable (OFL),
pinned as a devDependency, and re-emits `metrics.ts` — the ink boxes the cell
fitting needs. Needs `python3 -m pip install fonttools brotli`. Output goes to
`public/loader/` and **not** `public/fonts/`: `fetch-fonts.py` rebuilds that
directory and unlinks every woff2 it finds, which would take this one with it.

Stories: `Frame` (seek one moment), `Playing`, `OnLight`, `Small`.
`prefers-reduced-motion: reduce` draws the resolved state once and never starts
a loop.

## Blog

Posts are markdown files in `content/posts/`. Nothing else needs touching — the
build discovers them, renders them, and adds them to the index.

```md
---
title: Cutting transcript latency from 4.2s to 380ms
date: 2026-03-14
summary: One sentence, shown on the index and used as the meta description.
tags: [realtime, latency]
draft: false
---

Body copy in markdown.
```

`title` and `date` are required; everything else is optional. The filename may carry
a date prefix for ordering on disk (`2026-03-14-cutting-transcript-latency.md`) — it
is stripped from the URL, giving `/blog/cutting-transcript-latency/`. Override it
with a `slug` in frontmatter.

`draft: true` renders in `npm run dev`, flagged in the index, and is left out of
`npm run build` entirely.

The `blog/` directory at the repository root is **generated and gitignored** — Vite
needs real HTML files on disk to treat pages as MPA entries and give them asset
hashing and CSS injection. `plugins/blog.ts` rewrites it from scratch on every
config load, so renaming or deleting a post cannot leave a stale page behind, and
watches `content/posts/` in dev. Change the route by editing `OUT_DIR` in
`lib/blog.ts`.

## Storybook

`npm run storybook` for the workbench, `npm run build-storybook` for a static build
into `storybook-static/` (gitignored).

`.storybook/preview.ts` imports the site's own stylesheets, so a story renders in the
real system rather than a Storybook-only copy of it — if a token changes, the stories
change with it. `staticDirs` serves `public/`, so the webfonts are the real ones. A
toolbar control sets `data-theme` on the document, driving the same selectors the
site uses.

Seeded with the pieces that already exist: the type scale, the full range of prose
markdown can emit, the article masthead and decision block, the figure frame, the
blog index row, and the nav. The figure story takes args for its caption, poster
text, controls, and bleed, which is the shape interactive figures will need when they
land — each one is a component with parameters and a mount/dispose lifecycle, and
this is where they get developed in isolation.

Nothing type-checks stories at build time beyond `npm run typecheck`, which does
cover `stories/` and `.storybook/`. There is no visual-regression job.

## Tests

`npm test` runs Playwright against a production preview it starts itself. The suite
guards the things a stylesheet or pipeline change can silently break: that the type
face resolves rather than falling back to a system stack, that the canvas tracks the
theme, that nav reaches every page, that posts render their frontmatter and markdown,
that drafts stay out of a production build, and that nothing scrolls horizontally on
a phone. `tests/blog-content.spec.ts` exercises the loader directly, without a
browser.

Chromium resolution is handled in `playwright.config.ts`: it prefers
`/opt/pw-browsers/chromium` when present — cloud sessions ship one and cannot run
`playwright install` — and otherwise falls back to Playwright's own download.
Override with `CHROMIUM_PATH`.

## Design references

Mobbin and a Dribbble/Behance/Awwwards search server are wired up as MCP servers for
pulling UI references while building. Where each is configured differs between local
Claude Code and Claude Code on the web — setup, API keys, and the SessionStart hook
are covered in [`docs/design-inspiration.md`](docs/design-inspiration.md).

For local use, Mobbin is user-scoped rather than committed:

```sh
claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp
```

## Web sessions

Two pieces, in the order they run:

1. `.claude/cloud-setup.sh` — a reference copy of the cloud environment's **Setup
   script**, which lives in the environment dialog at claude.ai/code. Provisions the
   VM before Claude Code launches; its filesystem is cached and reused.
2. `.claude/hooks/session-start.sh` — installs project dependencies on every session.
   Remote only; no-ops on local machines.
