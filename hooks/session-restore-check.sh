#!/bin/bash
set -euo pipefail

# SessionStart hook: vibespec 관련 stash 감지 → additionalContext로 알림 주입
# stash 메시지 패턴 (새): vibespec-session:{branch}:{worktree_path}:{plan_id}:{task_id}:{timestamp}
# stash 메시지 패턴 (구): vibespec-session:{plan_id}:{task_id}:{timestamp}

trap 'exit 0' ERR

# git repo 확인
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0

# 현재 브랜치명 획득
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) || CURRENT_BRANCH="unknown"

# 현재 워크트리 경로 판별
if [[ "$GIT_DIR" == *"/worktrees/"* ]]; then
  CURRENT_WORKTREE=$(basename "$GIT_DIR")
else
  CURRENT_WORKTREE="main"
fi

# vibespec-session 패턴의 stash 검색
STASH_LIST=$(git stash list 2>/dev/null | grep 'vibespec-session' || true)

if [ -z "$STASH_LIST" ]; then
  exit 0
fi

# 브랜치 매칭 필터링
MATCHED_DETAILS=""
MATCHED_COUNT=0
OTHER_COUNT=0

while IFS= read -r line; do
  STASH_REF=$(echo "$line" | cut -d: -f1)
  MSG=$(echo "$line" | grep -oE 'vibespec-session:[^"]*' || echo "")
  if [ -z "$MSG" ]; then
    continue
  fi

  # 필드 수로 새/구 형식 엄격 판별 (-eq 6 또는 -eq 4만 허용)
  FIELD_COUNT=$(echo "$MSG" | tr ':' '\n' | wc -l | tr -d ' ')

  if [ "$FIELD_COUNT" -eq 6 ]; then
    # 새 형식: vibespec-session:{branch}:{worktree_path}:{plan_id}:{task_id}:{timestamp}
    STASH_BRANCH=$(echo "$MSG" | cut -d: -f2)
    STASH_WORKTREE=$(echo "$MSG" | cut -d: -f3)
    PLAN=$(echo "$MSG" | cut -d: -f4)
    TASK=$(echo "$MSG" | cut -d: -f5)
    TS=$(echo "$MSG" | cut -d: -f6)
  elif [ "$FIELD_COUNT" -eq 4 ]; then
    # 기존 형식: vibespec-session:{plan_id}:{task_id}:{timestamp}
    STASH_BRANCH="unknown"
    PLAN=$(echo "$MSG" | cut -d: -f2)
    TASK=$(echo "$MSG" | cut -d: -f3)
    TS=$(echo "$MSG" | cut -d: -f4)
  else
    # 예상 외 형식 — 건너뛰기
    OTHER_COUNT=$((OTHER_COUNT + 1))
    continue
  fi

  # worktree_path 초기화 (구형 포맷은 STASH_WORKTREE가 미설정)
  STASH_WORKTREE="${STASH_WORKTREE:-main}"

  # detached HEAD는 브랜치 식별자가 아니므로 매치하지 않음
  if [ "$CURRENT_BRANCH" = "HEAD" ] || [ "$STASH_BRANCH" = "HEAD" ]; then
    OTHER_COUNT=$((OTHER_COUNT + 1))
  elif [ "$STASH_BRANCH" = "$CURRENT_BRANCH" ] && [ "$STASH_WORKTREE" = "$CURRENT_WORKTREE" ]; then
    MATCHED_COUNT=$((MATCHED_COUNT + 1))
    MATCHED_DETAILS="${MATCHED_DETAILS}  - ${STASH_REF}: branch=${STASH_BRANCH}, worktree=${STASH_WORKTREE}, plan=${PLAN}, task=${TASK}, saved=${TS}\n"
  elif [ "$STASH_BRANCH" = "unknown" ]; then
    # 구형 포맷은 ambiguous — 별도 카운트하되 매치에 포함하지 않음
    OTHER_COUNT=$((OTHER_COUNT + 1))
  else
    OTHER_COUNT=$((OTHER_COUNT + 1))
  fi
done <<< "$STASH_LIST"

# 매칭되는 stash가 없으면 종료
if [ "$MATCHED_COUNT" -eq 0 ] && [ "$OTHER_COUNT" -eq 0 ]; then
  exit 0
fi

# 컨텍스트 구성
CONTEXT=""
if [ "$MATCHED_COUNT" -gt 0 ]; then
  CONTEXT="현재 브랜치(${CURRENT_BRANCH})의 미커밋 변경사항 ${MATCHED_COUNT}개가 stash에 보존되어 있습니다. /vs-next 실행 시 자동으로 복원됩니다.\n${MATCHED_DETAILS}"
fi
if [ "$OTHER_COUNT" -gt 0 ]; then
  CONTEXT="${CONTEXT}(다른 브랜치의 stash ${OTHER_COUNT}개 존재)\n"
fi

# JSON 출력 (jq 우선, python3 폴백)
if command -v jq &>/dev/null; then
  echo -e "$CONTEXT" | jq -Rs '{ additionalContext: . }'
elif command -v python3 &>/dev/null; then
  ESCAPED=$(echo -e "$CONTEXT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
  echo "{\"additionalContext\": ${ESCAPED}}"
else
  FLAT=$(echo -e "$CONTEXT" | tr '\n' ' ')
  echo "{\"additionalContext\": \"${FLAT}\"}"
fi

exit 0
