# Design inspiration sources

MCP servers that pull real UI/UX references into the editor while building. Where each
one is configured depends on where it has to run.

| Server             | Local Claude Code      | Claude Code on the web             |
| ------------------ | ---------------------- | ---------------------------------- |
| Mobbin             | user-scoped MCP server | claude.ai connector                |
| design-inspiration | `.mcp.json` + env vars | `.mcp.json` + cloud environment    |

## Mobbin

Official Mobbin MCP server (`https://api.mobbin.com/mcp`, streamable HTTP, OAuth) —
searchable library of real app screens, flows, and UI patterns. Tools:
`search_screens`, `search_flows`, `search_sections`.

> **Requires a paid Mobbin plan.** As of August 2026 every tool call on a free account
> returns `Mobbin MCP requires a paid plan`, authenticated or not. The setup below is
> still correct; it just yields nothing without a subscription.

**On the web: a claude.ai custom connector.** Add it under Settings → Connectors → Add
custom connector with URL `https://api.mobbin.com/mcp`, then authorize it.

Connector traffic does not pass through the cloud environment's domain allowlist at
all — the same is true of GitHub traffic, which uses a separate proxy — and OAuth runs
in your browser on claude.ai rather than in the container. That is why the connector
works on the web while an identical `.mcp.json` HTTP server to `api.mobbin.com` gets a
`403` from the egress proxy and then cannot complete a headless OAuth flow.

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
official or community one. Collect UI is a curated gallery of Daily UI submissions that
are mostly Dribbble shots, so searching Dribbble and friends directly covers the same
ground.

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
and **all three are required** — with any one missing the server will not start.

Open the environment dialog: at [claude.ai/code](https://claude.ai/code), select the
**cloud icon showing the current environment's name**, in the row above the message
box, then either **Add cloud environment** or hover an existing one and select its
**settings gear**. There is no settings page or direct URL for this selector. The
dialog has four fields: Name, Network access, Environment variables, and Setup script.

**1. Setup script.** Paste the contents of
[`.claude/cloud-setup.sh`](../.claude/cloud-setup.sh) — it clones and builds the server
into `/root/.cache/design-inspiration-mcp-server`. Keep the two in sync when either
changes.

This work belongs here rather than in the SessionStart hook. A setup script provisions
the VM, runs before Claude Code launches, and its filesystem is snapshotted and reused,
so the build is paid for once instead of every session — and `DESIGN_MCP_HOME` exists
before MCP servers start, rather than racing them.

**2. Environment variables**, in `.env` format, one pair per line:

```text
DESIGN_MCP_HOME=/root/.cache/design-inspiration-mcp-server
SERPER_API_KEY=your-key-here
```

Values are copied once at session start, so edits only affect sessions started
afterward.

> **Credential warning.** The docs are explicit that this is not a secrets store:
> "Anyone who uses the environment can read the values, and cloud environments have no
> dedicated secrets store, so don't add API keys or other credentials." Environments you
> create are personal to your account, so for a personal environment the exposure is
> limited to you — but never put `SERPER_API_KEY` in an organization-shared
> environment, where every member can read it. Use a free-tier key you can rotate, and
> treat it as disposable.

**3. Network access.** Set it to **Custom**, then add to **Allowed domains**, one per
line:

```text
google.serper.dev
```

Check **Also include default list of common package managers** — without it the
allowlist replaces the Trusted defaults, and the setup script's `git clone` and
`npm install` both break. The four levels are None, Trusted (the default: package
registries, GitHub, cloud SDKs), Full, and Custom.

Changing the setup script or the allowed hosts invalidates the environment cache, so
the setup script re-runs on the next session. Verify with `/mcp` once it starts.

## SessionStart hook

`.claude/hooks/session-start.sh` runs after Claude Code launches, on every session
including resumed ones, in cloud sessions only (`CLAUDE_CODE_REMOTE`). It installs
project dependencies and nothing else — per-project setup that has to happen every
session, as opposed to the VM provisioning handled by the setup script.

It only takes effect for sessions started **after** it lands on the repository's
default branch.
