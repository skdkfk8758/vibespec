#!/bin/bash
set -euo pipefail

# PreToolUse(Bash) hook: careful 모드 활성화 시 파괴적 명령을 차단
# 차단 대상: rm -rf, DROP TABLE, TRUNCATE, git push --force, git reset --hard, git clean

trap 'exit 0' ERR

# careful.enabled 확인
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENABLED=$(node "$PLUGIN_ROOT/dist/cli/index.js" --json config get careful.enabled 2>/dev/null | jq -r '.value // "false"' 2>/dev/null || echo "false")

if [ "$ENABLED" != "true" ]; then
  exit 0
fi

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

# 파괴적 명령 패턴 매칭
BLOCKED=""

# rm -rf (루트 또는 광범위 삭제)
if echo "$COMMAND" | grep -qE '\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b'; then
  BLOCKED="rm -rf 명령이 감지되었습니다"
fi

# DROP TABLE / DROP DATABASE
if echo "$COMMAND" | grep -qiE '\bDROP\s+(TABLE|DATABASE|INDEX|SCHEMA)\b'; then
  BLOCKED="DROP TABLE/DATABASE 명령이 감지되었습니다"
fi

# TRUNCATE TABLE
if echo "$COMMAND" | grep -qiE '\bTRUNCATE\s+'; then
  BLOCKED="TRUNCATE 명령이 감지되었습니다"
fi

# git push --force / -f (not --force-with-lease)
if echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*(-f\b|--force\b)' && ! echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*--force-with-lease\b'; then
  BLOCKED="git push --force 명령이 감지되었습니다"
fi

# git reset --hard
if echo "$COMMAND" | grep -qE '\bgit\s+reset\s+.*--hard\b'; then
  BLOCKED="git reset --hard 명령이 감지되었습니다"
fi

# git clean -fd / -f
if echo "$COMMAND" | grep -qE '\bgit\s+clean\s+.*-[a-zA-Z]*f'; then
  BLOCKED="git clean -f 명령이 감지되었습니다"
fi

if [ -n "$BLOCKED" ]; then
  jq -n \
    --arg reason "⚠️ [careful 모드] $BLOCKED. 비활성화: vs careful off" \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

exit 0
