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
| `src/figures/hangul-hero/` | 박상현 → "Sean Park" morph; see [Hangul hero](#hangul-hero) |
| `scripts/bake-glyphs.mjs` | Bakes that figure's glyph outlines to a distance-field atlas |
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

## Hangul hero

`src/figures/hangul-hero/` renders 박상현 as a mark that morphs into "Sean Park".
POC stage: it lives in Storybook only and is not on a page yet.

The name decomposes into its nine jamo — 박 = ㅂㅏㄱ, 상 = ㅅㅏㅇ, 현 = ㅎㅕㄴ — from
the Hangul Compatibility Jamo block, each of which moves independently. Nine into
eight does not divide, so eight take a Latin letter each and ㅇ fuses into the "a"
of "Sean" instead: 상's vowel and final are the "ang" that English spells with one
letter, and a ring settling into a bowl is a merge the eye can follow.

**It is one distance field, not geometry.** Every glyph is baked to a signed
distance field tile, and the mark is the smooth-minimum union of all nine sampled
fields. That is what makes it read as a single connected object while its parts
cross: where two parts pass close, the union necks them together. Shading comes
from the field's own screen-space gradient, so the bevel is exact at any zoom and
antialiases to the pixel — one draw call, no meshes, no lights.

| Piece | Does |
| ----- | ---- |
| `layout.ts` | Hangul block cells, the Latin line, and the jamo → letter mapping |
| `field.glsl.ts` | The shader: sample nine pairs, blend outlines, smooth-union, shade |
| `ease.ts` | Custom eases, written out rather than picked from presets |
| `index.ts` | Scene, timeline, and the mount/dispose lifecycle |
| `glyphs.ts`, `glyphs.sdf.bin` | Generated. Do not edit — re-run the bake |

```sh
npm run bake:glyphs   # re-bake after changing the glyph set or atlas constants
npm run shots:hero    # contact sheet of the morph, needs Storybook running
```

`scripts/bake-glyphs.mjs` downloads Noto Sans KR Bold (OFL) to a gitignored cache,
extracts outlines with opentype.js, rasterises them, and writes the atlas plus a
typed metadata module. The 6 MB font is a build input only; nothing parses a font
at runtime. Output is deterministic, so a no-op re-run leaves the tree clean.

Two stories. **Decomposition** puts the transform on a 0 → 1 slider with no timing
or camera work around it — that is where the motion gets judged, and the sequence
plays the same timeline, so the two cannot drift. **Sequence** runs it on its beats
with the copy fading in beneath.

Known gaps at POC stage: the cells only describe vertical-vowel syllables (고 or 문
would need a second set), and the reduced-motion path is verified by hand because
the Playwright config drives the site preview rather than Storybook.

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
