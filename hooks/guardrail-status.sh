#!/bin/bash
set -euo pipefail

# SessionStart hook: 가드레일 활성화 상태를 세션 시작 시 표시

trap 'exit 0' ERR

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

CAREFUL=$(node "$PLUGIN_ROOT/dist/cli/index.js" --json config get careful.enabled 2>/dev/null | jq -r '.value // "false"' 2>/dev/null || echo "false")
FREEZE=$(node "$PLUGIN_ROOT/dist/cli/index.js" --json config get freeze.path 2>/dev/null | jq -r '.value // empty' 2>/dev/null || echo "")

STATUS=""

if [ "$CAREFUL" = "true" ]; then
  STATUS="⚠️ careful 모드 활성화 중"
fi

if [ -n "$FREEZE" ]; then
  if [ -n "$STATUS" ]; then
    STATUS="$STATUS | 🔒 freeze: $FREEZE"
  else
    STATUS="🔒 freeze: $FREEZE"
  fi
fi

if [ -n "$STATUS" ]; then
  echo "$STATUS"
fi

exit 0
