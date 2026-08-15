#!/bin/bash
# Reference copy of the cloud environment's Setup script.
#
# This file is NOT executed from the repo. The live copy lives in the
# environment dialog at claude.ai/code (cloud icon above the message box →
# environment → Setup script). It is kept here so the script is reviewable and
# versioned; paste it into the dialog, and update both together.
#
# Runs as root on Ubuntu 24.04, before Claude Code launches, and only when no
# cached environment exists. The filesystem is snapshotted once it completes and
# reused by later sessions, so this clone and build are paid for once rather
# than per session. It re-runs when the script or the allowed network hosts
# change, and after the cache expires (~7 days).
#
# MUST exit zero — a non-zero exit makes the session fail to start. Hence no
# `set -e`, failure-tolerant steps, and an unconditional `exit 0`.
#
# Touches only /root/.cache, never the repository: a setup script provisions the
# VM and cannot assume the clone exists yet.

set -uo pipefail

DESIGN_MCP_HOME=/root/.cache/design-inspiration-mcp-server

# design-inspiration-mcp-server is not published to npm despite what its README
# says, so it has to be built from source. No API key is needed at build time,
# only at runtime, so this stays independent of SERPER_API_KEY.
if [ ! -d "$DESIGN_MCP_HOME/.git" ]; then
  rm -rf "$DESIGN_MCP_HOME"
  git clone --depth 1 \
    https://github.com/YonasValentin/design-inspiration-mcp-server.git \
    "$DESIGN_MCP_HOME" || true
fi

if [ -d "$DESIGN_MCP_HOME" ]; then
  (
    cd "$DESIGN_MCP_HOME" \
      && npm install --no-audit --no-fund \
      && npm run build
  ) || echo "[setup] design-inspiration build failed; design search unavailable" >&2
fi

# Powers design_extract_tokens.
npm install -g dembrandt --no-audit --no-fund || true

exit 0
