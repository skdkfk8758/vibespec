#!/bin/bash
set -euo pipefail

# PostToolUse(ExitWorktree) hook: 워크트리 나갈 때 vs-merge 안내 메시지 표시
# 조건: 워크트리 브랜치에 메인 대비 커밋 차이가 있을 때만

trap 'exit 0' ERR

# 워크트리인지 확인 (git-dir에 /worktrees/ 포함)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0
if [[ "$GIT_DIR" != *"/worktrees/"* ]]; then
  exit 0
fi

# 메인 브랜치 감지
if git rev-parse --verify main &>/dev/null; then
  TARGET="main"
elif git rev-parse --verify master &>/dev/null; then
  TARGET="master"
else
  exit 0
fi

# 커밋 차이 확인
COMMIT_COUNT=$(git log --oneline "${TARGET}..HEAD" 2>/dev/null | wc -l | tr -d ' ')

if [ "$COMMIT_COUNT" -gt 0 ]; then
  if command -v jq &>/dev/null; then
    jq -n --arg reason "/vs-merge로 워크트리 변경사항을 ${TARGET} 브랜치에 병합할 수 있습니다. (${COMMIT_COUNT}개 커밋 감지)" \
      '{ reason: $reason }'
  else
    echo "{\"reason\": \"/vs-merge로 워크트리 변경사항을 ${TARGET} 브랜치에 병합할 수 있습니다. (${COMMIT_COUNT}개 커밋 감지)\"}"
  fi
fi

exit 0
