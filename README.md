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
| `src/loader/gate.ts` | Mounts it as the home page's curtain and lifts it again   |
| `scripts/build-loader.mjs` | Bakes and contour-matches its letterforms         |
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

**The type is a window, not a mark.** Nothing is painted directly. Every form
— the parts, the construction squares, the name — is a white shape inside one
`<mask>`, and the only thing on screen with colour is a single plane behind it.
That costs nothing at rest and buys the interior: a *black* shape added to the
mask takes ink away, so a letterform can be cut into as well as drawn.

What shows through is the piece itself, enlarged and running ahead of where it
currently is — the visible form is always filled with the form it is about to
become. That is what pays for the still moments. 박상현 holds legible for a
beat in the middle and SEAN PARK holds at the end, and on flat ink both read as
the animation having stopped; filled with their own future they are the most
interesting frames in the run. A sheen crosses the plane once over the run for
the same reason. Every gradient stop is `currentColor` and only the opacity
varies, so the piece still takes its colour entirely from the page.

**The camera moves.** A viewBox that opens hard inside a single stroke — so
the first thing on screen is an abstract mass, not a name — pulls back as the
parts arrive, then pushes in through the morph. That push is doing real work:
twenty contours becoming twelve means eight shrink to nothing, and on a fixed
camera the field visibly collapsed and came back, which read as a fault. Moving
in as it contracts keeps it filling the frame and the same moment reads as a
dive into the transformation. The aspect ratio is fixed — animating it would
change the element's own height and shift the page every frame.

The run ends where it began: the camera dives back into the stroke it opened
on while the frame blinks out, so a loop dissolves into the next pass instead
of cutting from a resolved name to an empty one, and a single run hands off to
the page rather than switching off. `REST` — not 1 — marks where the sequence
actually lands, which is the frame reduced motion draws and the one to
screenshot.

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
nothing appearing from nowhere, and no seam to hide because there is no seam.
Contours are matched by centroid proximity and only where the winding agrees,
then point order is rotation-aligned; without that last step a morph unwinds
and cartwheels.

**Construction is drawn.** Each jamo draws itself on with `stroke-dashoffset`,
the fill catching up behind the line — what makes the parts read as drawn
rather than as glyphs being faded up.

**No webfont ships.** Every letterform is baked outline data. Live text cannot
do any of the above: the morph needs each contour of one form paired with a
contour of the next, resampled to a shared point count and rotation-aligned so
a straight lerp between them is a valid outline at every step. `npm run
build:loader` does that matching once against Pretendard Variable (OFL, pinned
as a devDependency) and writes `src/loader/morphs.ts`. The whole chain is 53 KB
of source and needs nothing at runtime but arithmetic.

Every stage is baked in **frame** coordinates, not block-local ones. The final
morph has to be a single path — a letter's counter only punches a hole when it
shares a path with its outline — and a single path can carry no per-block
transform, so block-local geometry put all three syllables on top of one
another the instant that path took over. `tests/loader.spec.ts` guards it.

Each jamo is fitted to its cell at a **uniform** scale. A real Korean typeface
redraws a jamo for its position; scaling one drawing to fill a cell instead
gives anisotropic strokes — ㄱ squashed into a wide flat cell comes out with
hairline horizontals and heavy verticals — and no amount of easing rescues
that. Uniform keeps every stroke the weight it was drawn at, at the cost of the
parts sitting a little smaller than the block they build. They read as parts,
which is what they are. The cell table lives in `scripts/build-loader.mjs`,
which is what consumes it, and is the part worth reading if the block
proportions ever look wrong.

The assembly is drawn in SVG rather than HTML because an SVG glyph outline at
font-size 1 with its origin at (0, 0) puts its ink exactly where the font says
it is, so a jamo can be fitted to a cell arithmetically. The same placement in
HTML would depend on line-height and half-leading.

**It gates a real load.** `src/loader/gate.ts` mounts the sequence as a
curtain over the home page and takes it away again. The curtain is in
`index.html` rather than created by script, so it covers the page from first
paint instead of flashing the content it introduces, and `src/main.ts` splits
three.js into its own chunk — bundled together, the loading animation could not
start until the thing it is covering for had finished downloading.

Everything about the gate is the difference between an intro and an obstacle.
It plays **once per session**, so a second visit or a back button lands on the
page itself. Any click, key, scroll or touch **lifts it early**. Reduced motion
**never sees it at all** — not a static frame; a full-screen panel held over
the page for four seconds is worse than no animation. And it cannot get stuck:
the element carries a CSS failsafe that removes it on a timer whatever happens,
so a script error takes the animation down rather than the site. The whole
curtain is `aria-hidden` and the counter is not exposed as progress, because it
counts out an animation and not a download — dressing it up as the latter would
be a lie told to exactly the people least able to check it.

```sh
npm run storybook
npm run film              # 12 seeked frames, dark
npm run film -- 20 light  # 20 frames, light ground
npm run play              # 16 frames of real playback
```

The animation is a pure function of normalised time — `apply(t)` derives every
visual property and nothing else touches them — so `npm run film` seeks frame
by frame through `window.__loader` rather than waiting on wall-clock time. The
strip is exact and reproducible, which is what makes the motion iterable rather
than guessable. It caught the counter stalling at 100 for the last quarter of
the run, a lone S sitting in an empty frame, and SEAN PARK losing its word
space.

`npm run play` is its counterpart and not a duplicate: it shoots real rAF
playback on a wall clock, so it sees what seeking cannot. Every fault that
survived into the finished piece was found this way — the field collapsing to a
cluster halfway through, the three syllables landing on top of one another at
the flow handover, three hundred milliseconds of one hairline in an empty frame
at the start, and the SVG spilling across the page whenever the camera pushed
in. None of them appear in a single seeked still. Frames land in `shots/loader/`
(gitignored).

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
a phone. `tests/blog-content.spec.ts` exercises the post loader directly, without a
browser, and `tests/loader.spec.ts` asserts on the baked morph geometry — `npm run
build:loader` is a manual step whose output is committed, so nothing in the build
fails if it drifts.

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
