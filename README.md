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
| `.mcp.json`          | Design-reference MCP servers                              |

`createScene(canvas)` returns a handle with `dispose()`, which cancels the render
loop, removes listeners, and frees GPU resources. Keep that contract when adding
geometry — every `dispose()`-able you create should be released there.

The scene clamps device pixel ratio to 2 and honours
`prefers-reduced-motion: reduce` by holding the mesh still.

## Design references

Mobbin and a Dribbble/Behance/Awwwards search server are wired up as MCP servers
for pulling UI references while building. Setup, required API keys, and sandbox
caveats: [`docs/design-inspiration.md`](docs/design-inspiration.md).
