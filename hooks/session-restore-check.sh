#!/bin/bash
set -euo pipefail

# SessionStart hook: vibespec 관련 stash 감지 → additionalContext로 알림 주입
# stash 메시지 패턴: vibespec-session:{plan_id}:{task_id}:{timestamp}

trap 'exit 0' ERR

# git repo 확인
git rev-parse --git-dir &>/dev/null || exit 0

# vibespec-session 패턴의 stash 검색
STASH_LIST=$(git stash list 2>/dev/null | grep 'vibespec-session' || true)

if [ -z "$STASH_LIST" ]; then
  exit 0
fi

# stash 개수
STASH_COUNT=$(echo "$STASH_LIST" | wc -l | tr -d ' ')

# 상세 정보 구성
DETAILS=""
while IFS= read -r line; do
  # stash@{N}: ... vibespec-session:{plan_id}:{task_id}:{timestamp}
  STASH_REF=$(echo "$line" | cut -d: -f1)
  MSG=$(echo "$line" | grep -oE 'vibespec-session:[^"]*' || echo "")
  if [ -n "$MSG" ]; then
    PLAN=$(echo "$MSG" | cut -d: -f2)
    TASK=$(echo "$MSG" | cut -d: -f3)
    TS=$(echo "$MSG" | cut -d: -f4)
    DETAILS="${DETAILS}  - ${STASH_REF}: plan=${PLAN}, task=${TASK}, saved=${TS}\n"
  fi
done <<< "$STASH_LIST"

CONTEXT="이전 세션에서 미커밋 변경사항 ${STASH_COUNT}개가 stash에 보존되어 있습니다. /vs-resume으로 복원하세요.\n${DETAILS}"

# JSON 출력 (jq 우선, python3 폴백)
if command -v jq &>/dev/null; then
  echo -e "$CONTEXT" | jq -Rs '{ additionalContext: . }'
elif command -v python3 &>/dev/null; then
  ESCAPED=$(echo -e "$CONTEXT" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
  echo "{\"additionalContext\": ${ESCAPED}}"
else
  # 최후 폴백: 줄바꿈 제거 후 단순 출력
  FLAT=$(echo -e "$CONTEXT" | tr '\n' ' ')
  echo "{\"additionalContext\": \"${FLAT}\"}"
fi

exit 0
