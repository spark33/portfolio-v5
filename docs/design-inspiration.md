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

**1. Environment variables.** Open the environment dialog: at
[claude.ai/code](https://claude.ai/code), select the **cloud icon showing the current
environment's name**, in the row above the message box, then either **Add cloud
environment** or hover an existing one and select its **settings gear**. There is no
settings page or direct URL for this selector.

The dialog has four fields: Name, Network access, Environment variables, and Setup
script. In **Environment variables**, use `.env` format, one pair per line:

```text
DESIGN_MCP_HOME=/root/.cache/design-inspiration-mcp-server
SERPER_API_KEY=your-key-here
```

Values are copied once at session start, so edits only affect sessions started
afterward.

> **Credential warning.** The docs are explicit that this is not a secrets store:
> "Anyone who uses the environment can read the values, and cloud environments have no
> dedicated secrets store, so don't add API keys or other credentials." Environments
> you create are personal to your account, so for a personal environment the exposure
> is limited to you — but never put `SERPER_API_KEY` in an
> organization-shared environment, where every member can read it. Use a free-tier key
> you can rotate, and treat it as disposable.

Setting `DESIGN_MCP_HOME` here rather than relying on the hook's `$CLAUDE_ENV_FILE`
export matters: MCP servers may start before hook-exported variables are applied,
whereas environment-config variables exist from the start.

**2. The SessionStart hook**, already committed at
`.claude/hooks/session-start.sh` and registered in `.claude/settings.json`. It clones
and builds the server into `DESIGN_MCP_HOME` on session start. With `SERPER_API_KEY`
unset it logs why and exits cleanly, so sessions without the key still start normally
instead of erroring on every tool call.

The hook only takes effect for sessions started **after** it lands on the repo's
default branch.

**3. Network policy.** In the same dialog, set **Network access** to **Custom**, then
add to **Allowed domains**, one per line:

```text
google.serper.dev
```

Check **Also include default list of common package managers** — without it the
allowlist replaces the Trusted defaults, and the clone and `npm install` in the hook
both break. The four levels are None, Trusted (the default: package registries,
GitHub, cloud SDKs), Full, and Custom.

Verify with `/mcp` once a session starts.

### Why Mobbin needs none of this

Connector traffic does not go through the environment's domain allowlist at all — the
same is true of GitHub traffic, which uses a separate proxy. That is why Mobbin works
on the web as a connector while an identical `.mcp.json` HTTP server to
`api.mobbin.com` gets a `403` from the egress proxy. The connector path also runs
OAuth in your browser on claude.ai rather than in the container.

### Alternative to the committed hook

The environment dialog's **Setup script** field takes a Bash script that runs when a
session starts, *before Claude Code launches* — so variables it exports are guaranteed
to be in place before MCP servers start. That sidesteps the ordering caveat above.

The tradeoff: a setup script is per-environment and unversioned, while
`.claude/hooks/session-start.sh` is committed, reviewable, and applies to everyone who
clones the repo. This project uses the committed hook; the setup script is the better
choice only if the ordering turns out to bite.

Docs: https://code.claude.com/docs/en/claude-code-on-the-web
