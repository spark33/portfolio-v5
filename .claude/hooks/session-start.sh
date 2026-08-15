#!/bin/bash
set -euo pipefail

# Web sessions get a fresh container each time, so dependencies must be
# reinstalled here. Local machines keep their own node_modules — skip.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] installing project dependencies"
npm install --no-audit --no-fund

# The design-inspiration MCP server is not published to npm, so it has to be
# built from source. Every one of its tools needs a Serper key, so building it
# without one just produces a server that fails on first call — skip instead.
#
# Set SERPER_API_KEY *and* DESIGN_MCP_HOME in the environment config (not here):
# MCP servers may start before variables exported from this hook are applied,
# whereas environment-config variables are present from the very start.
if [ -z "${SERPER_API_KEY:-}" ]; then
  echo "[session-start] SERPER_API_KEY unset — skipping design-inspiration MCP." >&2
  echo "[session-start] Set it in the environment config to enable design search." >&2
  exit 0
fi

DESIGN_MCP_HOME="${DESIGN_MCP_HOME:-$HOME/.cache/design-inspiration-mcp-server}"

if [ ! -d "$DESIGN_MCP_HOME/.git" ]; then
  echo "[session-start] cloning design-inspiration-mcp-server"
  rm -rf "$DESIGN_MCP_HOME"
  git clone --depth 1 \
    https://github.com/YonasValentin/design-inspiration-mcp-server.git \
    "$DESIGN_MCP_HOME"
fi

echo "[session-start] building design-inspiration-mcp-server"
(
  cd "$DESIGN_MCP_HOME"
  npm install --no-audit --no-fund
  npm run build
)

# Fallback for the case where DESIGN_MCP_HOME was not set in the environment
# config. Works only if MCP startup happens after hooks are applied, which is
# why the environment config remains the recommended route.
echo "export DESIGN_MCP_HOME=\"$DESIGN_MCP_HOME\"" >> "$CLAUDE_ENV_FILE"

echo "[session-start] done"
