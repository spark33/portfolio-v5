# Design inspiration sources

This project uses MCP servers to pull real UI/UX references into the editor while
building. Config lives in `.mcp.json` at the repo root.

## Mobbin

Official Mobbin MCP server — searchable library of real app screens, flows, and UI
patterns.

- URL: `https://api.mobbin.com/mcp`
- Transport: Streamable HTTP
- Auth: OAuth. On first tool call your browser opens and you sign in with your
  Mobbin account. A Mobbin account is required; some content is behind their paid
  tier.

Already configured in `.mcp.json`. To register it globally instead of per-project:

```sh
claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp
```

Verify with `/mcp` inside Claude Code, or `claude mcp list`.

## Collect UI

`collectui.com` publishes no API, RSS feed, or MCP server, and no official or
community MCP server for it exists. It is a curated gallery of Daily UI
submissions, most of which are Dribbble shots — so the practical substitute is a
server that searches Dribbble and friends directly. See the open question in the
project notes before adding one.

## Environment caveat

Claude Code on the web runs in a sandboxed container whose outbound network access
is governed by the environment's network policy. In the current environment
`api.mobbin.com` is blocked by the egress proxy (`403` on CONNECT), and the OAuth
handshake needs a browser that a headless container does not have. So:

- **Local Claude Code**: works as configured.
- **Claude Code on the web**: needs the environment's network policy widened to
  allow `api.mobbin.com`, and the OAuth flow still will not complete headlessly.

Docs: https://code.claude.com/docs/en/claude-code-on-the-web
