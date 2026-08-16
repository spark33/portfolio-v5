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
| `scripts/build-loader.mjs` | Sets both stages and contour-matches them         |
| `scripts/glyph-outlines.py` | Reads glyph outlines out of the variable font    |
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
●                      one circle
ㅂㅏㄱ  ㅅㅏㅇ  ㅎㅕㄴ    the name, taken apart
SEAN PARK              the name he goes by
```

Three states and one continuous morph through all of them, drawn by a single
path. There is no arrival, no assembly and no handover: every frame in the run
is the same twenty contours interpolated somewhere along the chain.

**The circle is ㅇ.** 상 has one, so the name already contains a perfect circle
— it does not have to be invented and it does not have to come from anywhere.
Every contour starts as a copy of ㅇ's own ring, at ㅇ's own place and size, so
the first frame is one small disc and ㅇ is the piece that never moves. It reads
as a disc rather than a ring by arithmetic rather than by choice: seventeen
copies wound one way and three the other leave a nonzero winding everywhere
inside, so the coincident stack fills. The ring appears only once ㅇ's counter
separates from its outline.

박상현 is three syllables, and Hangul is an assembly system: a syllable is not
a busy-looking character, it is a **square built from jamo placed in fixed
regions of it**. 박 is ㅂ over ㄱ with ㅏ down the right-hand side. Taken apart
it is the nine pieces the disc opens into. The composed syllables are not drawn
— showing them and immediately pulling them apart again showed the same name
twice, and the pieces are the more interesting half. That is also why this
cannot be a stock preloader wearing someone's name: it is specific to *this*
name in *this* script.

**The opening is unstaggered, and it travels before it changes shape.** Both
took a couple of goes. Every contour starts as the same circle in the same
place, so one that leaves before its neighbours is briefly an identical circle
sitting next to the one it left — it reads as the disc budding a duplicate, not
as the disc opening. And a circle that changes shape while it is still
travelling spends the first third of the run halfway between a circle and a
letter *and* halfway to where it is going, which reads as a smear. Splitting
translation from shape gives the beat two readable halves: a mark, then a row of
marks, then type.

**One typeface, one weight, one scale, one baseline.** The jamo used to be
fitted individually into cells of an invented grid, which gave each of them its
own scale and therefore its own stroke weight — ㄱ squashed into a wide flat
cell came out with hairline horizontals — and nine glyphs of visibly different
colour read as shapes arranged to resemble Hangul rather than as type. They are
now *set*: one scale for every glyph, a shared baseline, and the only decision
left is the spacing.

That spacing is optical, not metric. Compatibility jamo are full-width — every
one advances 0.864 em, because they are meant to be composed into a square and
not set in a row — and their ink sits in wildly different places inside that
square, so metric spacing gives gaps swinging between a third and two thirds of
an em.

Nor are bounding boxes enough. ㅏ is a stem hard against the right of its square
with a short branch off the left; box it and the branch sets the left edge, so
the eye sees the stem sitting far from the glyph before it and the branch almost
touching the one after. Each pair is set by **closest approach** instead — the
real gap, measured in ninety-six horizontal bands — which is what a designer is
doing by eye. Syllable groups get a wider gap, so the name's structure is
visible without composing it.

The curves were also being destroyed. The flattening tolerance was written as
`0.3` font units and compared against deviations measured in *em*, where a
whole glyph is about 1 — so the test passed on the first try every time and
every curve in the piece was flattened to a single straight chord. ㅇ was a
polygon. Both the flattening and its tolerance are now in font units, which is
why `scripts/glyph-outlines.py` hands over the font's own integer coordinates
rather than anything pre-scaled.

**The type is a window, not a mark.** Nothing is painted directly. Every form
is a white shape inside one `<mask>`, and the only thing on screen with colour
is a single plane behind it. That costs nothing at rest and buys the interior:
a *black* shape added to the mask takes ink away, so a letterform can be cut
into as well as drawn.

What shows through is the piece itself, enlarged and running ahead of where it
currently is — the visible form is always filled with the form it is about to
become. The cuts are choreographed rather than constant: barely there on the
two states that have to be read, full strength through the middle, where the
forms are neither script. They dim the ink rather than remove it — at full
strength a cut severs a stroke, and a third of the jamo line is thin vertical
strokes — and they are scaled to how big the loader is being drawn, since left
in viewBox units they are a constant *fraction* of the letterform.

A sheen crosses the plane once over the run: dark edges around a lit core, so
it reads as light catching an edge rather than as a wash. That core is the
site's own `--accent` and the only colour in the piece — everything else is the
page's ink on the page's ground — and it follows the theme for free, because
that token is already a different value on each. It is a dip across full ink
rather than a highlight across a held-back plane, so the resolved frame the
whole thing builds to lands at full weight.

**The camera moves.** A viewBox that opens close on the disc, holds while it is
still a mark, pulls back as the line opens out of it, and pushes in through the
morph. That push is doing real work: twenty contours becoming eleven means nine
shrink to nothing, and on a fixed camera the field visibly loses mass and comes
back, which reads as a fault. The opening framing is measured off the seed's own
outline rather than written down, because "framed on the disc" is the
requirement and a coordinate stops meaning that the moment the layout moves.

The run ends where it began: the camera closes back on the circle while the
frame fades out, so a loop dissolves into the next pass and a single run hands
off to the page rather than switching off. There is no fade *in* — the mark has
to be there when the run starts, and any ramp at all opens on an empty frame.
`REST` — not 1 — marks where the sequence lands, which is the frame reduced
motion draws and the one to screenshot.

**Nothing in the sequence is a cut.** A circle becomes nine jamo becomes eight
letters as one continuous change of the same twenty contours. Twenty become
eleven: the nine with no counterpart collapse to a point inside themselves and
stop having area, which is the lossy half of the transliteration said in
geometry rather than in a caption — 박상현 carries more than SEAN PARK keeps.
Contours are matched left to right and never crossing, and only where the
winding agrees, then point order is rotation-aligned; without that last step a
morph unwinds and cartwheels. The two scripts differ in how they make a hole —
the jamo carry three true counters, in ㅂ, ㅇ and ㅎ, while Pretendard's Latin
caps cut theirs as hairline slits in a single contour — so all three Korean
counters are among the ones that collapse. A slit is about a thousandth of the
frame wide, which is why the baked coordinates keep five decimal places: round
its two sides onto each other and the counter it cuts fills solid.

**No webfont ships.** Every letterform is baked outline data. Live text cannot
do any of the above: the morph needs each contour of one state paired with a
contour of the next, resampled to a shared point count and rotation-aligned so
a straight lerp between them is a valid outline at every step. `npm run
build:loader` does that matching once against Pretendard Variable (OFL, pinned
as a devDependency) and writes `src/loader/morphs.ts`, which also carries the
frame it derived — so there is no second copy of the composition to drift.
Needs `python3 -m pip install fonttools`.

**It gates a real load.** `src/loader/gate.ts` mounts the sequence as a curtain
over the home page and takes it away again. The curtain is in `index.html`
rather than created by script, so it covers the page from first paint instead
of flashing the content it introduces, and `src/main.ts` splits three.js into
its own chunk — bundled together, the loading animation could not start until
the thing it is covering for had finished downloading.

Everything about the gate is the difference between an intro and an obstacle.
It plays **once per session**, so a second visit or a back button lands on the
page itself. Any click, key, scroll or touch **lifts it early**. Reduced motion
**never sees it at all** — not a static frame; a full-screen panel held over
the page for two and a half seconds is worse than no animation. And it cannot
get stuck: the element carries a CSS failsafe that removes it on a timer
whatever happens, so a script error takes the animation down rather than the
site. The whole curtain is `aria-hidden` and the counter is not exposed as
progress, because it counts out an animation and not a download — dressing it
up as the latter would be a lie told to exactly the people least able to check
it.

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
than guessable.

`npm run play` is its counterpart and not a duplicate: it shoots real rAF
playback on a wall clock, so it sees what seeking cannot. Every fault that
survived into the finished piece was found this way — the field collapsing to a
cluster halfway through, three syllables landing on top of one another at a
handover, three hundred milliseconds of one hairline in an empty frame at the
start, and the SVG spilling across the page whenever the camera pushed in. None
of them appear in a single seeked still. Frames land in `shots/loader/`
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
