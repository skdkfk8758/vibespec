#!/bin/bash
set -euo pipefail
trap 'exit 0' ERR  # 정보성 훅: 에러 시 fail-open (조용히 통과)

# SessionStart hook: 직전 세션의 머지 리포트가 있으면 /vs-recap 안내
# - vs merge-report latest가 null이 아니면 additionalContext로 1줄 힌트 주입
# - vs CLI 없음, 타임아웃, 파싱 실패 시 조용히 종료

# vs CLI 존재 확인
if ! command -v vs &>/dev/null; then
  exit 0
fi

# timeout 명령 선택 (macOS: gtimeout, Linux: timeout, 없으면 직접 실행)
TIMEOUT_CMD=""
if command -v timeout &>/dev/null; then
  TIMEOUT_CMD="timeout 3"
elif command -v gtimeout &>/dev/null; then
  TIMEOUT_CMD="gtimeout 3"
fi

# 머지 리포트 조회 (3초 timeout — 훅 전체 5초 이내)
REPORT_JSON=$($TIMEOUT_CMD vs merge-report latest --json 2>/dev/null || true)

if [ -z "$REPORT_JSON" ] || [ "$REPORT_JSON" = "null" ]; then
  exit 0
fi

# 브랜치/커밋 정보 추출 (jq 우선, python3 fallback)
INFO=""
if command -v jq &>/dev/null; then
  INFO=$(echo "$REPORT_JSON" | jq -r '
    select(. != null) |
    "\(.source_branch // "?") → \(.target_branch // "?") (\(.commit_hash // "" | .[0:8]))"
  ' 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  INFO=$(echo "$REPORT_JSON" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    if d:
        src = d.get('source_branch', '?')
        tgt = d.get('target_branch', '?')
        h = (d.get('commit_hash') or '')[:8]
        print(f'{src} → {tgt} ({h})')
except: pass
" 2>/dev/null || true)
fi

if [ -z "$INFO" ]; then
  exit 0
fi

# additionalContext 출력
CONTEXT="직전 세션 머지 리포트가 있습니다: ${INFO}. /vs-recap으로 변경사항·Review Checklist를 확인하세요."

if command -v jq &>/dev/null; then
  echo "$CONTEXT" | jq -Rs '{ additionalContext: . }'
elif command -v python3 &>/dev/null; then
  echo "$CONTEXT" | python3 -c 'import sys,json; print(json.dumps({"additionalContext": sys.stdin.read().strip()}))'
else
  echo "{\"additionalContext\": \"${CONTEXT}\"}"
fi

exit 0
