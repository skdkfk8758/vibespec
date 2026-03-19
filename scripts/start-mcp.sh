#!/bin/bash
PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -d "$PLUGIN_ROOT/node_modules/better-sqlite3" ]; then
  npm install --production --prefix "$PLUGIN_ROOT" 2>/dev/null
fi
exec node "$PLUGIN_ROOT/dist/mcp/server.js"
