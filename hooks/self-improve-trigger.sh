#!/bin/bash
set -euo pipefail
trap 'exit 0' ERR  # 정보성 훅: 에러 시 fail-open (조용히 통과)

# PostToolUse hook: fix/hotfix/debug 커밋 감지 → pending 파일 생성
# self-improve 파이프라인의 신호 수집 단계

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null || echo "")

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# CLAUDE_TOOL_OUTPUT에서 출력 추출 (JSON 또는 raw text 모두 처리)
OUTPUT=""
TOOL_EXIT="0"
if echo "$CLAUDE_TOOL_OUTPUT" | jq -e . >/dev/null 2>&1; then
  TOOL_EXIT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.exitCode // 0' 2>/dev/null || echo "0")
  if [ "$TOOL_EXIT" != "0" ]; then
    exit 0
  fi
  OUTPUT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.stdout // empty' 2>/dev/null || echo "")
else
  OUTPUT="${CLAUDE_TOOL_OUTPUT:-}"
fi

# Early exit: successful command that doesn't look like a git commit with fix/hotfix/debug
if [ "$TOOL_EXIT" = "0" ] && ! echo "$OUTPUT" | grep -qiE '(fix|hotfix|debug)'; then
  exit 0
fi

COMMIT_MSG=$(echo "$OUTPUT" | head -5)

# fix:/hotfix:/debug: 타입만 감지 — 일반 커밋(feat:/chore: 등)은 무시
if ! echo "$COMMIT_MSG" | grep -qiE '^\s*(fix|hotfix|debug)(\([^)]*\))?:'; then
  # stdout에 없으면 커밋 메시지를 직접 확인
  LATEST_MSG=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  if ! echo "$LATEST_MSG" | grep -qiE '^(fix|hotfix|debug)(\([^)]*\))?:'; then
    exit 0
  fi
  COMMIT_MSG="$LATEST_MSG"
fi

# 프로젝트 루트 감지
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
PENDING_DIR="$PROJECT_ROOT/.claude/self-improve/pending"
mkdir -p "$PENDING_DIR"

# 커밋 해시
COMMIT_HASH=$(git rev-parse HEAD 2>/dev/null || echo "unknown")

# 커밋 메시지 (한 줄)
FULL_MSG=$(git log -1 --pretty=%s 2>/dev/null || echo "$COMMIT_MSG")

# diff 추출 (최대 200줄)
DIFF_CONTENT=$(git diff HEAD~1 HEAD 2>/dev/null | head -200 || echo "")

# diff 요약 (변경 파일 목록)
DIFF_SUMMARY=$(git diff HEAD~1 HEAD --stat 2>/dev/null | tail -1 || echo "")

# 태스크 ID 추출 (있으면)
TASK_ID=$(echo "$FULL_MSG" | grep -oE '\[(task|vp):[a-zA-Z0-9_-]+\]' | sed 's/\[task://;s/\[vp://;s/\]//' | head -1 || true)

# 타임스탬프 기반 파일명
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")

# pending JSON 생성
PENDING_FILE="$PENDING_DIR/${TIMESTAMP}.json"

# jq로 안전하게 JSON 생성
jq -n \
  --arg type "fix_commit" \
  --arg commit_hash "$COMMIT_HASH" \
  --arg commit_message "$FULL_MSG" \
  --arg diff_summary "$DIFF_SUMMARY" \
  --arg diff_content "$DIFF_CONTENT" \
  --arg task_id "$TASK_ID" \
  --arg timestamp "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  '{
    type: $type,
    commit_hash: $commit_hash,
    commit_message: $commit_message,
    diff_summary: $diff_summary,
    diff_content: $diff_content,
    task_id: (if $task_id == "" then null else $task_id end),
    timestamp: $timestamp
  }' > "$PENDING_FILE" 2>/dev/null

# 성공 시 additionalContext 출력
if [ -f "$PENDING_FILE" ]; then
  PENDING_COUNT=$(ls -1 "$PENDING_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  jq -n --arg count "$PENDING_COUNT" '{
    additionalContext: ("fix 커밋이 감지되어 self-improve pending에 기록되었습니다 (대기 " + $count + "건). 규칙 자동 생성 중... (background)")
  }'

  # Background auto-rule generation
  if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
    nohup node "${CLAUDE_PLUGIN_ROOT}/dist/scripts/auto-rule-gen.js" >/dev/null 2>&1 &
  fi
fi

exit 0
