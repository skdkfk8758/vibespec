#!/bin/bash
set -e

# PostToolUse hook: git commit 후 태스크 ID 참조 감지
# 커밋 메시지에 [task:ID] 또는 [vp:ID] 패턴이 있으면 태스크 상태 업데이트 제안

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty')

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# 커밋 성공 여부 확인 (exit code 0 = 성공)
TOOL_EXIT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.exitCode // 0' 2>/dev/null)
if [ "$TOOL_EXIT" != "0" ]; then
  exit 0
fi

# 커밋 메시지에서 태스크 ID 추출
OUTPUT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.stdout // empty' 2>/dev/null || echo "")
TASK_IDS=$(echo "$OUTPUT" | grep -oE '\[(task|vp):[a-zA-Z0-9_-]+\]' | sed 's/\[task://;s/\[vp://;s/\]//' || true)

if [ -n "$TASK_IDS" ]; then
  jq -n --arg tasks "$TASK_IDS" '{
    reason: ("커밋에서 태스크 참조 감지: " + $tasks + ". vp_task_update로 태스크 상태를 업데이트하세요.")
  }'
fi

exit 0
