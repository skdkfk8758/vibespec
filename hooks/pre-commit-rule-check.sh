#!/bin/bash
set -euo pipefail
trap 'exit 0' ERR  # 정보성 훅: 에러 시 fail-open (조용히 통과)

# PreToolUse hook: git commit 전 관련 규칙 리마인드
# .claude/rules/*.md에서 Applies When을 파싱하여 변경 파일과 매칭

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# 프로젝트 루트 감지
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
RULES_DIR="$PROJECT_ROOT/.claude/rules"

# rules 디렉토리가 없거나 비어있으면 무시
if [ ! -d "$RULES_DIR" ]; then
  exit 0
fi

RULE_FILES=$(ls -1 "$RULES_DIR"/*.md 2>/dev/null)
if [ -z "$RULE_FILES" ]; then
  exit 0
fi

# 변경 파일 목록 (staged)
CHANGED_FILES=$(git diff --cached --name-only 2>/dev/null || git diff --name-only HEAD 2>/dev/null || echo "")
if [ -z "$CHANGED_FILES" ]; then
  exit 0
fi

# 각 규칙의 Applies When과 변경 파일 매칭
MATCHED_RULES=""

for rule_file in $RULE_FILES; do
  # title 추출 (frontmatter에서)
  RULE_TITLE=$(grep -m1 '^title:' "$rule_file" 2>/dev/null | sed 's/^title: *//')
  if [ -z "$RULE_TITLE" ]; then
    continue
  fi

  # Applies When 섹션 추출
  APPLIES_WHEN=$(sed -n '/^## Applies When/,/^## /p' "$rule_file" 2>/dev/null | grep -v '^##' | tr '\n' ' ' | xargs)
  if [ -z "$APPLIES_WHEN" ]; then
    continue
  fi

  # 변경 파일과 Applies When 텍스트 매칭 (간단한 키워드 매칭)
  for changed_file in $CHANGED_FILES; do
    # 파일 경로의 디렉토리/모듈명으로 매칭
    DIR_NAME=$(dirname "$changed_file" | sed 's|/|-|g')
    BASE_NAME=$(basename "$changed_file" | sed 's/\.[^.]*$//')

    if echo "$APPLIES_WHEN" | grep -qiE "$DIR_NAME|$BASE_NAME"; then
      MATCHED_RULES="${MATCHED_RULES}- [$(basename "$rule_file" .md)] ${RULE_TITLE}\n"
      break
    fi
  done
done

# 매칭 규칙이 있으면 리마인드
if [ -n "$MATCHED_RULES" ]; then
  jq -n --arg rules "$MATCHED_RULES" '{
    additionalContext: ("커밋 전 확인: 관련 self-improve 규칙이 있습니다:\n" + $rules + "규칙을 준수하는지 확인 후 커밋하세요.")
  }'
fi

exit 0
