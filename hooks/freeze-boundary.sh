#!/bin/bash
set -euo pipefail

# PreToolUse(Edit/Write) hook: freeze 활성화 시 지정 디렉토리 외 파일 편집 차단

trap 'exit 0' ERR

source "$(dirname "$0")/lib/read-config.sh"

FREEZE_PATH=$(vs_config_get "freeze.path" "")

if [ -z "$FREEZE_PATH" ]; then
  exit 0
fi

TOOL_NAME="${CLAUDE_TOOL_NAME:-Bash}"

# Edit/Write 도구만 검사 (Bash는 완벽한 차단 불가)
if [ "$TOOL_NAME" != "Edit" ] && [ "$TOOL_NAME" != "Write" ]; then
  exit 0
fi

FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 절대경로로 변환
if [[ "$FILE_PATH" != /* ]]; then
  FILE_PATH="$(pwd)/$FILE_PATH"
fi
# 정규화
FILE_PATH=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && echo "$(pwd)/$(basename "$FILE_PATH")" || echo "$FILE_PATH")

# freeze.path 하위인지 확인
if [[ "$FILE_PATH" != "$FREEZE_PATH"* ]]; then
  jq -n \
    --arg reason "🔒 [freeze 모드] $FILE_PATH 는 freeze 경계($FREEZE_PATH) 밖입니다. 해제: vs freeze off" \
    '{"decision": "block", "reason": $reason}'
fi

exit 0
