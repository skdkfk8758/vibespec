#!/bin/bash
set -euo pipefail

# SessionStart hook: 마켓플레이스 최신 버전과 설치된 버전 비교
# - 새 버전이 있으면 additionalContext로 알림 주입
# - 네트워크 실패 시 조용히 종료 (세션 시작을 블로킹하지 않음)

trap 'exit 0' ERR

MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/vibespec-marketplace"
REGISTRY="$HOME/.claude/plugins/installed_plugins.json"

# 마켓플레이스 디렉토리 존재 확인
if [ ! -d "$MARKETPLACE_DIR" ]; then
  exit 0
fi

# 레지스트리에서 현재 설치된 버전 읽기
if [ ! -f "$REGISTRY" ]; then
  exit 0
fi

# jq 또는 python3로 현재 버전 추출
CURRENT_VERSION=""
if command -v jq &>/dev/null; then
  CURRENT_VERSION=$(jq -r '.["vibespec@vibespec-marketplace"].version // .["vibespec@vibespec"].version // empty' "$REGISTRY" 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  CURRENT_VERSION=$(python3 -c "
import json, sys
try:
    d = json.load(open('$REGISTRY'))
    v = d.get('vibespec@vibespec-marketplace', d.get('vibespec@vibespec', {})).get('version', '')
    print(v)
except: pass
" 2>/dev/null || true)
fi

if [ -z "$CURRENT_VERSION" ]; then
  exit 0
fi

# 마켓플레이스 최신 버전을 가져오기 (git fetch, 타임아웃 5초)
cd "$MARKETPLACE_DIR" 2>/dev/null || exit 0
timeout 5 git fetch origin --quiet 2>/dev/null || exit 0

# origin/main의 marketplace.json에서 최신 버전 읽기
LATEST_VERSION=""
MARKETPLACE_JSON=$(git show origin/main:.claude-plugin/marketplace.json 2>/dev/null || true)

if [ -z "$MARKETPLACE_JSON" ]; then
  exit 0
fi

if command -v jq &>/dev/null; then
  LATEST_VERSION=$(echo "$MARKETPLACE_JSON" | jq -r '.plugins[0].version // empty' 2>/dev/null || true)
elif command -v python3 &>/dev/null; then
  LATEST_VERSION=$(echo "$MARKETPLACE_JSON" | python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    print(d.get('plugins', [{}])[0].get('version', ''))
except: pass
" 2>/dev/null || true)
fi

if [ -z "$LATEST_VERSION" ]; then
  exit 0
fi

# 버전 비교 (동일하면 종료)
if [ "$CURRENT_VERSION" = "$LATEST_VERSION" ]; then
  exit 0
fi

# semver 비교 — LATEST가 CURRENT보다 높은지 확인
version_gt() {
  # $1 > $2 이면 return 0
  local IFS=.
  local i ver1=($1) ver2=($2)
  for ((i=0; i<${#ver1[@]}; i++)); do
    local v1=${ver1[i]:-0}
    local v2=${ver2[i]:-0}
    if ((v1 > v2)); then return 0; fi
    if ((v1 < v2)); then return 1; fi
  done
  return 1
}

if ! version_gt "$LATEST_VERSION" "$CURRENT_VERSION"; then
  exit 0
fi

# 변경사항 요약 가져오기 (최근 5개 커밋 메시지)
CHANGES=$(git log --oneline "v${CURRENT_VERSION}..origin/main" --max-count=5 2>/dev/null || git log --oneline HEAD~5..origin/main --max-count=5 2>/dev/null || echo "")

# 알림 컨텍스트 구성
CONTEXT="VibeSpec 새 버전이 있습니다: v${CURRENT_VERSION} → v${LATEST_VERSION}. /vs-update로 업데이트하세요."
if [ -n "$CHANGES" ]; then
  CONTEXT="${CONTEXT}\n주요 변경: ${CHANGES}"
fi

# JSON 출력
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
