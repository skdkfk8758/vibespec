#!/bin/bash
set -euo pipefail

# Stop hook: 세션 종료 시 미커밋 변경사항을 git stash로 자동 보존
# stash 메시지 형식: vibespec-session:{branch}:{worktree_path}:{plan_id}:{task_id}:{timestamp}

# 에러 발생 시 조용히 종료 (세션 종료를 블로킹하지 않음)
trap 'exit 0' ERR

# git repo 루트 해석 (worktree 호환)
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$REPO_ROOT" || exit 0

# 워크트리 감지: 워크트리에서는 stash를 생성하지 않음
# (공유 stash에 브랜치 간 교차 오염 방지)
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0
if [[ "$GIT_DIR" == *"/worktrees/"* ]]; then
  exit 0
fi

# 변경사항 체크: unstaged + staged 모두 확인
if git diff --quiet HEAD 2>/dev/null && git diff --cached --quiet 2>/dev/null; then
  # untracked 파일도 체크
  UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null)
  if [ -z "$UNTRACKED" ]; then
    exit 0
  fi
fi

# 현재 브랜치명 획득
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || BRANCH="unknown"
[ -z "$BRANCH" ] && BRANCH="unknown"

# 워크트리 경로 (main repo이면 "main")
WORKTREE_PATH="main"

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
STASH_MSG="vibespec-session:${BRANCH}:${WORKTREE_PATH}:${PLAN_ID}:${TASK_ID}:${TIMESTAMP}"

# untracked 파일을 포함하여 stash (--include-untracked)
git stash push --include-untracked -m "$STASH_MSG" 2>/dev/null || true

# stash 개수 제한: vibespec-session 패턴의 stash가 5개를 초과하면 오래된 것부터 삭제
MAX_STASH=5
VS_STASH_REFS=$(git stash list 2>/dev/null | grep 'vibespec-session' | cut -d: -f1 || true)
VS_STASH_COUNT=$(echo "$VS_STASH_REFS" | grep -c 'stash@' 2>/dev/null || echo "0")

if [ "$VS_STASH_COUNT" -gt "$MAX_STASH" ]; then
  # 가장 오래된 것(높은 인덱스)부터 삭제 — 역순으로 drop해야 인덱스가 밀리지 않음
  DROP_REFS=$(echo "$VS_STASH_REFS" | tail -n +"$((MAX_STASH + 1))")
  echo "$DROP_REFS" | while IFS= read -r ref; do
    [ -n "$ref" ] && git stash drop "$ref" 2>/dev/null || true
  done
fi

exit 0
