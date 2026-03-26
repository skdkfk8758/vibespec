#!/bin/bash
set -euo pipefail

# PreToolUse(Bash) hook: careful 모드 활성화 시 파괴적 명령을 차단

trap 'exit 0' ERR

# 공유 유틸 로드
source "$(dirname "$0")/lib/read-config.sh"

ENABLED=$(vs_config_get "careful.enabled" "false")

if [ "$ENABLED" != "true" ]; then
  exit 0
fi

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

if [ -z "$COMMAND" ]; then
  exit 0
fi

BLOCKED=""

if echo "$COMMAND" | grep -qE '\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b'; then
  BLOCKED="rm -rf 명령이 감지되었습니다"
fi

if echo "$COMMAND" | grep -qiE '\bDROP\s+(TABLE|DATABASE|INDEX|SCHEMA)\b'; then
  BLOCKED="DROP TABLE/DATABASE 명령이 감지되었습니다"
fi

if echo "$COMMAND" | grep -qiE '\bTRUNCATE\s+'; then
  BLOCKED="TRUNCATE 명령이 감지되었습니다"
fi

if echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*(-f\b|--force\b)' && ! echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*--force-with-lease\b'; then
  BLOCKED="git push --force 명령이 감지되었습니다"
fi

if echo "$COMMAND" | grep -qE '\bgit\s+reset\s+.*--hard\b'; then
  BLOCKED="git reset --hard 명령이 감지되었습니다"
fi

if echo "$COMMAND" | grep -qE '\bgit\s+clean\s+.*-[a-zA-Z]*f'; then
  BLOCKED="git clean -f 명령이 감지되었습니다"
fi

if [ -n "$BLOCKED" ]; then
  jq -n \
    --arg reason "⚠️ [careful 모드] $BLOCKED. 비활성화: vs careful off" \
    '{"decision": "block", "reason": $reason}'
fi

exit 0
