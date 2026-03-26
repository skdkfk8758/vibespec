#!/bin/bash
set -e
trap 'exit 0' ERR

# PreToolUse hook: git commit 시 README.md 최신화 여부 체크
# - package.json, src/ 변경이 있는데 README.md 변경이 없으면 경고

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null || echo "")

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# staged 파일 목록 확인
STAGED=$(git diff --cached --name-only 2>/dev/null || true)

if [ -z "$STAGED" ]; then
  exit 0
fi

# src/ 또는 package.json 변경이 있는지 확인
HAS_CODE_CHANGE=false
if echo "$STAGED" | grep -qE '^(src/|package\.json)'; then
  HAS_CODE_CHANGE=true
fi

# README.md 변경이 있는지 확인
HAS_README_CHANGE=false
if echo "$STAGED" | grep -qE '^README\.md$'; then
  HAS_README_CHANGE=true
fi

# 코드 변경은 있는데 README 변경이 없으면 경고
if [ "$HAS_CODE_CHANGE" = true ] && [ "$HAS_README_CHANGE" = false ]; then
  jq -n '{
    decision: "ask",
    reason: "src/ 또는 package.json 변경이 감지되었지만 README.md는 수정되지 않았습니다. README 최신화가 필요한지 확인해주세요."
  }'
  exit 0
fi

exit 0
