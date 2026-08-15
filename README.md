# portfolio-v5

Three.js portfolio site. Vite + TypeScript, no framework.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
npm test           # Playwright tests (starts its own preview server)
npm run shots      # regenerate specimen screenshots into shots/
```

## Layout

| Path                 | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `src/main.ts`        | Entry point; boots the scene, disposes it on HMR          |
| `src/scene.ts`       | WebGL scene, render loop, and teardown                    |
| `tests/`             | Playwright specs for the home page and the specimen       |
| `src/type.css`       | Type and colour system — the chosen Editorial treatment    |
| `src/article.css`    | Case-study template: masthead, facts, figure, decisions    |
| `src/style.css`      | Home page chrome layered over the canvas                   |
| `content/posts/`     | Blog posts — markdown with frontmatter, the only place you write |
| `lib/blog.ts`        | Loads posts and renders the blog's HTML                   |
| `plugins/blog.ts`    | Generates `blog/` and reloads it in dev                   |
| `src/blog.css`       | Blog index and post styles                                |
| `specimen/`          | Type specimen page, served at `/specimen/`                |
| `src/specimen.css`   | The three typographic treatments; all type lives in CSS   |
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

## Type specimen

`npm run dev`, then open <http://localhost:5173/specimen/>. It holds a compact
sample of the case-study template under three typographic treatments, so they can be
compared on real content rather than on lorem ipsum. It is a design tool, not a page
of the site — the long-form version of that sample now lives in the blog.

**Editorial (Newsreader) is the chosen system**; it lives in `src/type.css` and is
what the rest of the site uses. The specimen defaults to it and keeps the two
rejected alternatives so the decision stays re-checkable against real content.

| Treatment | Faces                         | Status                           |
| --------- | ----------------------------- | -------------------------------- |
| Editorial | Newsreader                    | **Chosen** — long-form, magazine |
| Swiss     | Inter Tight + Inter           | Rejected — neutral, product-adjacent |
| Technical | IBM Plex Sans + IBM Plex Mono | Rejected — engineering docs      |

Controls across the top change treatment, theme, body size, and measure, and the
choice persists across reloads. `1` `2` `3` switch treatment, `g` overlays the
twelve-column grid, `r` hides the chrome for an undistracted read.

Fonts are self-hosted latin-subset woff2 under `public/fonts/` (SIL Open Font
License). Re-run `python3 scripts/fetch-fonts.py` from the repository root to change
the set.

## Tests

`npm test` runs Playwright against a production preview it starts itself. The suite
guards the things a stylesheet or pipeline change can silently break: that each
treatment resolves to a real webfont rather than a system fallback, that the dark
accent clears AA, that settings survive a reload, that nothing scrolls horizontally
on a phone, that posts render their frontmatter and markdown, and that drafts stay
out of a production build. `tests/blog-content.spec.ts` exercises the loader
directly, without a browser.

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
