#!/bin/bash
set -euo pipefail

# PreToolUse(Bash/Edit/Write) hook: careful + freeze 통합 안전 가드
# careful 모드: 파괴적 Bash 명령 차단
# freeze 모드: 지정 디렉토리 외 파일 편집 차단

trap 'exit 2' ERR

source "$(dirname "$0")/lib/read-config.sh"
vs_require_jq "safety-guard"

TOOL_NAME="${CLAUDE_TOOL_NAME:-Bash}"

# ── careful 모드: Bash 명령 검사 ──
if [ "$TOOL_NAME" = "Bash" ]; then
  CAREFUL_ENABLED=$(vs_config_get "careful.enabled" "false")
  if [ "$CAREFUL_ENABLED" = "true" ]; then
    COMMAND=$(vs_extract_command)
    if [ -n "$COMMAND" ]; then
      BLOCKED=""
      if echo "$COMMAND" | grep -qE '\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b'; then
        BLOCKED="rm -rf 명령이 감지되었습니다"
      elif echo "$COMMAND" | grep -qiE '\bDROP\s+(TABLE|DATABASE|INDEX|SCHEMA)\b'; then
        BLOCKED="DROP TABLE/DATABASE 명령이 감지되었습니다"
      elif echo "$COMMAND" | grep -qiE '\bTRUNCATE\s+'; then
        BLOCKED="TRUNCATE 명령이 감지되었습니다"
      elif echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*(-f\b|--force\b)' && ! echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*--force-with-lease\b'; then
        BLOCKED="git push --force 명령이 감지되었습니다"
      elif echo "$COMMAND" | grep -qE '\bgit\s+reset\s+.*--hard\b'; then
        BLOCKED="git reset --hard 명령이 감지되었습니다"
      elif echo "$COMMAND" | grep -qE '\bgit\s+clean\s+.*-[a-zA-Z]*f'; then
        BLOCKED="git clean -f 명령이 감지되었습니다"
      fi

      if [ -n "$BLOCKED" ]; then
        jq -n --arg reason "⚠️ [careful 모드] $BLOCKED. 비활성화: vs careful off" \
          '{"decision": "block", "reason": $reason}'
        exit 2
      fi
    fi
  fi
fi

# ── freeze 모드: Edit/Write 범위 검사 ──
if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  FREEZE_PATH=$(vs_config_get "freeze.path" "")
  if [ -n "$FREEZE_PATH" ]; then
    FILE_PATH=$(vs_extract_file_path)
    if [ -n "$FILE_PATH" ]; then
      if [[ "$FILE_PATH" != /* ]]; then
        FILE_PATH="$(pwd)/$FILE_PATH"
      fi
      RESOLVED_DIR=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd)
      if [ -z "$RESOLVED_DIR" ]; then
        jq -n --arg path "$FILE_PATH" '{"decision":"block","reason":("[freeze] 경로 정규화 실패: " + $path)}'
        exit 2
      fi
      FILE_PATH="$RESOLVED_DIR/$(basename "$FILE_PATH")"

      if [[ "$FILE_PATH" != "$FREEZE_PATH"* ]]; then
        jq -n --arg reason "🔒 [freeze 모드] $FILE_PATH 는 freeze 경계($FREEZE_PATH) 밖입니다. 해제: vs freeze off" \
          '{"decision": "block", "reason": $reason}'
        exit 2
      fi
    fi
  fi
fi

exit 0
