#!/bin/bash
set -e
trap 'exit 0' ERR

# PostToolUse hook: git commit 후 태스크 ID 참조 감지
# 커밋 메시지에 [task:ID] 또는 [vp:ID] 패턴이 있으면 태스크 상태 업데이트 제안

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null || echo "")

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# CLAUDE_TOOL_OUTPUT에서 출력 추출 (JSON 또는 raw text 모두 처리)
OUTPUT=""
if echo "$CLAUDE_TOOL_OUTPUT" | jq -e . >/dev/null 2>&1; then
  TOOL_EXIT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.exitCode // 0' 2>/dev/null)
  if [ "$TOOL_EXIT" != "0" ]; then
    exit 0
  fi
  OUTPUT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.stdout // empty' 2>/dev/null || echo "")
else
  OUTPUT="${CLAUDE_TOOL_OUTPUT:-}"
fi
TASK_IDS=$(echo "$OUTPUT" | grep -oE '\[(task|vp):[a-zA-Z0-9_-]+\]' | sed 's/\[task://;s/\[vp://;s/\]//' || true)

if [ -n "$TASK_IDS" ]; then
  jq -n --arg tasks "$TASK_IDS" '{
    reason: ("커밋에서 태스크 참조 감지: " + $tasks + ". vs task update로 태스크 상태를 업데이트하세요.")
  }'
fi

# fix:/hotfix: 커밋 감지 시 에러 KB 기록 제안
COMMIT_MSG=$(echo "$OUTPUT" | grep -oE '(fix|hotfix)(\([^)]*\))?:.*' | head -1 || true)
if [ -n "$COMMIT_MSG" ]; then
  # 커밋 메시지에서 설명 부분 추출 (type(scope): 이후)
  FIX_TITLE=$(echo "$COMMIT_MSG" | sed 's/^[^:]*: *//')
  if [ -n "$FIX_TITLE" ]; then
    CLEAN_TITLE=$(echo "$FIX_TITLE" | tr -d '"' | tr -d "'" | cut -c1-80)
    jq -n --arg title "$CLEAN_TITLE" '{
      additionalContext: ("이 수정사항을 에러 KB에 기록하면 향후 동일 에러 발생 시 빠르게 해결할 수 있습니다.\n`vs error-kb add --title \"" + $title + "\" --severity medium --json`")
    }'
  fi
fi

exit 0
