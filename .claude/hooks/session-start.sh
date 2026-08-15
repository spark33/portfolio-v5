#!/bin/bash
set -euo pipefail

# Web sessions get a fresh clone each time, so project dependencies must be
# reinstalled here. Local machines manage their own node_modules — skip.
#
# This deliberately does NOT build the design-inspiration MCP server. That is
# VM provisioning, so it belongs in the environment's setup script, which runs
# before Claude Code launches and whose filesystem is snapshotted and reused.
# Doing it here instead would re-clone on every session and race MCP startup.
# See docs/design-inspiration.md.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] installing project dependencies"
npm install --no-audit --no-fund

echo "[session-start] done"
