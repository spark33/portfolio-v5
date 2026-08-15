# Design inspiration sources

MCP servers that pull real UI/UX references into the editor while building.
Config lives in `.mcp.json` at the repo root. Run `/mcp` inside Claude Code to
check connection status.

## Mobbin

Official Mobbin MCP server — searchable library of real app screens, flows, and UI
patterns.

- URL: `https://api.mobbin.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth. On first tool call your browser opens and you sign in with your
  Mobbin account. An account is required; some content sits behind their paid tier.

Already configured. To register it globally instead of per-project:

```sh
claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp
```

## Design inspiration (Dribbble / Behance / Awwwards / Mobbin / Pinterest)

Stands in for Collect UI, which publishes no API, feed, or MCP server — and has no
official or community one. Collect UI is a curated gallery of Daily UI submissions
that are mostly Dribbble shots, so searching Dribbble and friends directly covers
the same material and more.

Tools: `design_search_images`, `design_search_references`, `design_search_styles`,
`design_extract_tokens` (pulls colors, type, spacing, radii, and shadows off any
live site).

**It is not published on npm** — its README says `npm install -g`, but that package
does not exist. Clone and build from source:

```sh
git clone https://github.com/YonasValentin/design-inspiration-mcp-server.git
cd design-inspiration-mcp-server
npm install && npm run build     # produces dist/index.js
```

Then export both variables that `.mcp.json` reads (add to your shell profile):

```sh
export DESIGN_MCP_HOME="/absolute/path/to/design-inspiration-mcp-server"
export SERPER_API_KEY="..."      # free tier: 2,500 searches — serper.dev
```

`design_extract_tokens` additionally needs `npm install -g dembrandt`.

Keeping the key in the environment rather than in `.mcp.json` is deliberate — the
config is committed, so no secret should live in it.

## Environment caveat

Claude Code on the web runs in a sandboxed container whose outbound access is set by
the environment's network policy. In the current environment `api.mobbin.com` is
blocked by the egress proxy (`403` on CONNECT), as is `collectui.com`, and the OAuth
handshake needs a browser the container does not have.

- **Local Claude Code**: works as configured.
- **Claude Code on the web**: needs the network policy widened to allow
  `api.mobbin.com` and `google.serper.dev`; Mobbin's OAuth still will not complete
  headlessly.

Docs: https://code.claude.com/docs/en/claude-code-on-the-web
