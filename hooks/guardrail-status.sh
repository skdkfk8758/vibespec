#!/bin/bash
set -euo pipefail

# SessionStart hook: 가드레일 활성화 상태를 세션 시작 시 표시

trap 'exit 0' ERR

source "$(dirname "$0")/lib/read-config.sh"

CAREFUL=$(vs_config_get "careful.enabled" "false")
FREEZE=$(vs_config_get "freeze.path" "")

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
