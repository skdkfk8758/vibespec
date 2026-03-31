#!/bin/bash
set -eo pipefail

# PreToolUse(Bash) hook: 워크트리 내에서 메인 브랜치 변경 명령을 차단
# 차단: checkout, switch, merge, push 등 메인 브랜치를 변경하는 명령
# 허용: log, diff, show 등 읽기 전용 명령

trap 'exit 2' ERR  # fail-closed: 파싱 에러 시 차단 (git rev-parse 실패는 || exit 0으로 개별 처리)

# jq 사전 체크: 미설치 시 명시적 에러 메시지와 함께 차단
if ! command -v jq &>/dev/null; then
  echo '{"decision":"block","reason":"[worktree-guard] jq가 설치되어 있지 않습니다. brew install jq 또는 apt install jq로 설치하세요."}'
  exit 2
fi

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

# git 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^\s*git\b'; then
  exit 0
fi

# 워크트리 내부인지 확인
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null) || exit 0
if [[ "$GIT_DIR" != *"/worktrees/"* ]]; then
  exit 0
fi

# 메인 브랜치명 감지
if git rev-parse --verify main &>/dev/null; then
  MAIN_BRANCH="main"
elif git rev-parse --verify master &>/dev/null; then
  MAIN_BRANCH="master"
else
  exit 0
fi

# 읽기 전용 git 서브명령 — 이들은 항상 허용
READONLY_CMDS="log|diff|show|branch|status|stash|rev-parse|merge-base|ls-files|ls-tree|cat-file|for-each-ref|name-rev|describe|shortlog|blame|reflog"
if echo "$COMMAND" | grep -qE "^\s*git\s+($READONLY_CMDS)\b"; then
  exit 0
fi

# 차단 대상: checkout/switch로 메인 브랜치 이동
if echo "$COMMAND" | grep -qE "^\s*git\s+(checkout|switch)\s+.*\b${MAIN_BRANCH}\b"; then
  jq -n \
    --arg reason "워크트리에서 ${MAIN_BRANCH} 브랜치로 전환할 수 없습니다. 작업 완료 후 /vs-merge로 병합하세요." \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# 차단 대상: merge로 메인 브랜치 병합
if echo "$COMMAND" | grep -qE "^\s*git\s+merge\s+.*\b${MAIN_BRANCH}\b"; then
  jq -n \
    --arg reason "워크트리에서 ${MAIN_BRANCH} 브랜치를 직접 머지할 수 없습니다. /vs-merge를 사용하세요." \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# 차단 대상: push로 메인 브랜치에 직접 푸시
if echo "$COMMAND" | grep -qE "^\s*git\s+push\s+.*\b${MAIN_BRANCH}\b"; then
  jq -n \
    --arg reason "워크트리에서 ${MAIN_BRANCH} 브랜치로 직접 push할 수 없습니다. /vs-merge로 병합 후 push하세요." \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# 차단 대상: -C 옵션 없이 원본 리포의 메인 브랜치를 대상으로 하는 명령
# (vs-merge는 git -C <path>를 사용하므로 이 패턴에 해당하지 않음)

exit 0
