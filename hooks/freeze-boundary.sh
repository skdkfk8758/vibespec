#!/bin/bash
set -euo pipefail

# PreToolUse(Edit/Write) hook: freeze 활성화 시 지정 디렉토리 외 파일 편집 차단

trap 'exit 2' ERR  # fail-closed: 파싱/경로 에러 시 차단 (안전 우선)

# jq 사전 체크: 미설치 시 명시적 에러 메시지와 함께 차단
if ! command -v jq &>/dev/null; then
  echo '{"decision":"block","reason":"[freeze-boundary] jq가 설치되어 있지 않습니다. brew install jq 또는 apt install jq로 설치하세요."}'
  exit 2
fi

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
# 정규화 — 실패 시 fail-closed (경로를 확인할 수 없으면 차단)
RESOLVED_DIR=$(cd "$(dirname "$FILE_PATH")" 2>/dev/null && pwd)
if [ -z "$RESOLVED_DIR" ]; then
  jq -n --arg path "$FILE_PATH" '{"decision":"block","reason":("[freeze-boundary] 경로 정규화 실패: " + $path + ". 경로를 확인할 수 없어 안전을 위해 차단합니다.")}'
  exit 2
fi
FILE_PATH="$RESOLVED_DIR/$(basename "$FILE_PATH")"

# freeze.path 하위인지 확인
if [[ "$FILE_PATH" != "$FREEZE_PATH"* ]]; then
  jq -n \
    --arg reason "🔒 [freeze 모드] $FILE_PATH 는 freeze 경계($FREEZE_PATH) 밖입니다. 해제: vs freeze off" \
    '{"decision": "block", "reason": $reason}'
fi

exit 0
