#!/bin/bash
set -euo pipefail

# PreToolUse(Edit/Write/Bash) hook: freeze 활성화 시 지정 디렉토리 외 파일 편집 차단
# Edit/Write: file_path가 freeze.path 하위인지 확인
# Bash: 파일 수정 명령(>, >>, tee, sed -i, mv, cp)이 freeze.path 외부를 대상으로 하면 차단

trap 'exit 0' ERR

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
FREEZE_PATH=$(node "$PLUGIN_ROOT/dist/cli/index.js" --json config get freeze.path 2>/dev/null | jq -r '.value // empty' 2>/dev/null || echo "")

if [ -z "$FREEZE_PATH" ]; then
  exit 0
fi

# CLAUDE_TOOL_NAME: Edit, Write, or Bash
TOOL_NAME="${CLAUDE_TOOL_NAME:-Bash}"

check_path_in_boundary() {
  local target_path="$1"
  # 빈 경로는 무시
  if [ -z "$target_path" ]; then
    return 0
  fi
  # 절대경로로 변환
  if [[ "$target_path" != /* ]]; then
    target_path="$(pwd)/$target_path"
  fi
  # 정규화 (.. 등 처리)
  target_path=$(cd "$(dirname "$target_path")" 2>/dev/null && echo "$(pwd)/$(basename "$target_path")" || echo "$target_path")

  # freeze.path 하위인지 확인
  if [[ "$target_path" == "$FREEZE_PATH"* ]]; then
    return 0
  fi
  return 1
}

if [ "$TOOL_NAME" = "Edit" ] || [ "$TOOL_NAME" = "Write" ]; then
  FILE_PATH=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
  if [ -n "$FILE_PATH" ]; then
    if ! check_path_in_boundary "$FILE_PATH"; then
      jq -n \
        --arg reason "🔒 [freeze 모드] $FILE_PATH 는 freeze 경계($FREEZE_PATH) 밖입니다. 해제: vs freeze off" \
        '{"decision": "block", "reason": $reason}'
      exit 0
    fi
  fi
fi

# Bash 도구의 경우: 파일 수정 명령에서 대상 경로 추출은 복잡하므로,
# 주요 패턴만 검사 (>, >>, tee, sed -i 등의 리디렉션 대상)
# 완벽한 차단은 불가능하므로 Edit/Write 차단에 의존
if [ "$TOOL_NAME" = "Bash" ]; then
  # Bash에서의 파일 수정 패턴 검사는 선택적
  # 주요 위험 패턴: 명시적 파일 경로로의 리디렉션
  :
fi

exit 0
