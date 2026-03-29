#!/bin/bash
set -euo pipefail
trap 'exit 0' ERR  # 정보성 훅: 에러 시 fail-open (조용히 통과)

# SessionStart hook: self-improve 상태 알림
# pending 파일 수, 규칙 수, 쿨다운 상태를 체크하여 알림

# 프로젝트 루트 감지
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

PENDING_DIR="$PROJECT_ROOT/.claude/self-improve/pending"
RULES_DIR="$PROJECT_ROOT/.claude/rules"
MAX_RULES=30

MESSAGES=""

# 1) Pending 파일 수 체크
if [ -d "$PENDING_DIR" ]; then
  PENDING_COUNT=$(ls -1 "$PENDING_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  if [ "$PENDING_COUNT" -gt 0 ] 2>/dev/null; then
    MESSAGES="${MESSAGES}self-improve pending ${PENDING_COUNT}건이 대기 중입니다. \`/self-improve\`로 처리하세요.\n"
  fi
fi

# 2) Rules 파일 수 체크 (archive 제외)
if [ -d "$RULES_DIR" ]; then
  RULES_COUNT=$(ls -1 "$RULES_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')
  if [ "$RULES_COUNT" -gt "$MAX_RULES" ] 2>/dev/null; then
    MESSAGES="${MESSAGES}활성 규칙이 ${RULES_COUNT}개로 상한(${MAX_RULES})을 초과했습니다. \`/self-improve-review\`로 정리하세요.\n"
  fi
fi

# 3) 아무 알림도 없으면 무음 종료 (AC03)
if [ -z "$MESSAGES" ]; then
  exit 0
fi

# additionalContext 출력
jq -n --arg msg "$MESSAGES" '{
  additionalContext: $msg
}'

exit 0
