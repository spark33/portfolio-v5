# Design inspiration sources

MCP servers that pull real UI/UX references into the editor while building. Where
each one is configured depends on where it has to run.

| Server             | Local Claude Code       | Claude Code on the web       |
| ------------------ | ----------------------- | ---------------------------- |
| Mobbin             | user-scoped MCP server  | claude.ai connector          |
| design-inspiration | `.mcp.json` + env vars  | `.mcp.json` + SessionStart hook |

## Mobbin

Official Mobbin MCP server (`https://api.mobbin.com/mcp`, streamable HTTP, OAuth) —
searchable library of real app screens, flows, and UI patterns. Tools:
`search_screens`, `search_flows`, `search_sections`.

**On the web: a claude.ai custom connector.** OAuth runs in your browser on
claude.ai and the connector's traffic does not pass through the session container's
egress proxy, so both things that block a plain `.mcp.json` HTTP server — no browser,
blocked egress — simply do not apply. Add it under Settings → Connectors → Add custom
connector, with URL `https://api.mobbin.com/mcp`, then authorize it.

**Locally: user-scoped**, so it is available in every project rather than this one:

```sh
claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp
```

Then `/mcp` → **mobbin** → `Authenticate`.

It is deliberately *not* in this repo's `.mcp.json`. Committing it there would make
every web session start a second, unauthenticated copy alongside the connector and
prompt for an OAuth flow that cannot complete headlessly.

## design-inspiration

Stands in for Collect UI, which publishes no API, feed, or MCP server — and has no
official or community one. Collect UI is a curated gallery of Daily UI submissions
that are mostly Dribbble shots, so searching Dribbble and friends directly covers the
same ground.

Tools: `design_search_images`, `design_search_references`, `design_search_styles`,
`design_extract_tokens` (pulls colors, type, spacing, radii, and shadows off any live
site).

**It is not published to npm** — its README says `npm install -g`, but that package
does not exist. It has to be built from source.

### Locally

```sh
git clone https://github.com/YonasValentin/design-inspiration-mcp-server.git \
  ~/src/design-inspiration-mcp-server
cd ~/src/design-inspiration-mcp-server
npm install && npm run build
npm install -g dembrandt          # only for design_extract_tokens
```

Add to `~/.zshrc` (or `~/.bashrc`), then restart Claude Code — `.mcp.json` expands
these at launch, so a running session will not pick them up:

```sh
export DESIGN_MCP_HOME="$HOME/src/design-inspiration-mcp-server"
export SERPER_API_KEY="..."       # free tier: 2,500 searches — serper.dev
```

### On the web

A stdio server is a child process on whatever machine runs Claude Code, and web
sessions run in a fresh container that has none of the above. Three pieces are needed,
and **all three are required** — any one missing and the server will not start.

**1. Environment variables.** In the environment's configuration on
claude.ai/code, add:

| Variable          | Value                                             |
| ----------------- | ------------------------------------------------- |
| `SERPER_API_KEY`  | your key from serper.dev                           |
| `DESIGN_MCP_HOME` | `/root/.cache/design-inspiration-mcp-server`       |

Set them there rather than exporting from the hook. MCP servers may start before
variables exported via `$CLAUDE_ENV_FILE` are applied; environment-config variables
are present from the very start. The hook writes `DESIGN_MCP_HOME` to
`$CLAUDE_ENV_FILE` as a fallback, but do not rely on it alone.

**2. The SessionStart hook**, already committed at
`.claude/hooks/session-start.sh` and registered in `.claude/settings.json`. It clones
and builds the server into `DESIGN_MCP_HOME` on session start. With `SERPER_API_KEY`
unset it logs why and exits cleanly, so sessions without the key still start normally
instead of erroring on every tool call.

The hook only takes effect for sessions started **after** it lands on the repo's
default branch.

**3. Network policy.** The environment's egress policy must allow
`google.serper.dev`, or every search returns a proxy `403`. `github.com` and
`registry.npmjs.org` are already reachable, so the clone and build work as-is.

Verify with `/mcp` once a session starts.

Docs: https://code.claude.com/docs/en/claude-code-on-the-web
