# portfolio-v5

Three.js portfolio site. Vite + TypeScript, no framework.

```sh
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build to dist/
npm run preview    # serve the production build
```

## Layout

| Path                 | Purpose                                                  |
| -------------------- | -------------------------------------------------------- |
| `src/main.ts`        | Entry point; boots the scene, disposes it on HMR          |
| `src/scene.ts`       | WebGL scene, render loop, and teardown                    |
| `src/style.css`      | Page chrome layered over the canvas                       |
| `specimen/`          | Type specimen page, served at `/specimen/`                |
| `src/specimen.css`   | The three typographic treatments; all type lives in CSS   |
| `scripts/fetch-fonts.py` | Regenerates `public/fonts/` and `src/fonts.css`       |
| `.mcp.json`          | Design-reference MCP servers                              |

`createScene(canvas)` returns a handle with `dispose()`, which cancels the render
loop, removes listeners, and frees GPU resources. Keep that contract when adding
geometry — every `dispose()`-able you create should be released there.

The scene clamps device pixel ratio to 2 and honours
`prefers-reduced-motion: reduce` by holding the mesh still.

## Design

[`docs/concept.md`](docs/concept.md) is the design brief: site architecture, the
interactive-figure system, content model, and performance budget. Written before
implementation; the starter scene in `src/scene.ts` predates it.

## Type specimen

`npm run dev`, then open <http://localhost:5173/specimen/>. It renders the case-study
template from the design brief under three typographic treatments, so they can be
compared on real content rather than on lorem ipsum.

| Treatment | Faces                         | Register                         |
| --------- | ----------------------------- | -------------------------------- |
| Swiss     | Inter Tight + Inter           | Neutral, tight, product-adjacent |
| Editorial | Newsreader                    | Long-form, magazine              |
| Technical | IBM Plex Sans + IBM Plex Mono | Engineering documentation        |

Controls across the top change treatment, theme, body size, and measure, and the
choice persists across reloads. `1` `2` `3` switch treatment, `g` overlays the
twelve-column grid, `r` hides the chrome for an undistracted read.

Fonts are self-hosted latin-subset woff2 under `public/fonts/` (SIL Open Font
License). Re-run `python3 scripts/fetch-fonts.py` from the repository root to change
the set.

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
