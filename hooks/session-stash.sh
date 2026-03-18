#!/bin/bash
set -euo pipefail

# Stop hook: 세션 종료 시 미커밋 변경사항을 git stash로 자동 보존
# stash 메시지 형식: vibespec-session:{plan_id}:{task_id}:{timestamp}

# 에러 발생 시 조용히 종료 (세션 종료를 블로킹하지 않음)
trap 'exit 0' ERR

# git repo 루트 해석 (worktree 호환)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

# 변경사항 체크: unstaged + staged 모두 확인
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  # untracked 파일도 체크
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
  if [ -z "$UNTRACKED" ]; then
    exit 0
  fi
fi

# 활성 plan_id / in_progress task_id 조회
PLAN_ID="none"
TASK_ID="none"
DB_PATH="$REPO_ROOT/vibespec.db"

if [ -f "$DB_PATH" ] && command -v sqlite3 &>/dev/null; then
  PLAN_ID=$(sqlite3 "$DB_PATH" \
    "SELECT id FROM plans WHERE status = 'active' ORDER BY created_at DESC LIMIT 1;" \
    2>/dev/null) || PLAN_ID="none"
  [ -z "$PLAN_ID" ] && PLAN_ID="none"

  if [ "$PLAN_ID" != "none" ]; then
    TASK_ID=$(sqlite3 "$DB_PATH" \
      "SELECT id FROM tasks WHERE plan_id = '$PLAN_ID' AND status = 'in_progress' ORDER BY sort_order LIMIT 1;" \
      2>/dev/null) || TASK_ID="none"
    [ -z "$TASK_ID" ] && TASK_ID="none"
  fi
fi

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
STASH_MSG="vibespec-session:${PLAN_ID}:${TASK_ID}:${TIMESTAMP}"

# untracked 파일을 포함하여 stash (--include-untracked)
git stash push --include-untracked -m "$STASH_MSG" 2>/dev/null || true

exit 0
