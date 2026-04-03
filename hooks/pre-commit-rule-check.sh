#!/bin/bash
set -euo pipefail
trap 'exit 0' ERR  # 정보성 훅: 에러 시 fail-open (조용히 통과)

# PreToolUse hook: git commit 전 관련 규칙 리마인드
# .claude/rules/*.md에서 Applies When을 파싱하여 변경 파일과 매칭

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty' 2>/dev/null)

# git commit 명령이 아니면 통과 (AC06)
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

# 프로젝트 루트 감지
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")
RULES_DIR="$PROJECT_ROOT/.claude/rules"

# rules 디렉토리가 없거나 비어있으면 무시 (AC05)
if [ ! -d "$RULES_DIR" ]; then
  exit 0
fi

mapfile -t RULE_FILES_ARR < <(ls -1 "$RULES_DIR"/*.md 2>/dev/null)
if [ ${#RULE_FILES_ARR[@]} -eq 0 ]; then
  exit 0
fi

# 변경 파일 목록 (staged)
mapfile -t CHANGED_FILES_ARR < <(git diff --cached --name-only 2>/dev/null || git diff --name-only HEAD 2>/dev/null)
if [ ${#CHANGED_FILES_ARR[@]} -eq 0 ]; then
  exit 0
fi

# DB 경로 사전 조회 (중복 find 방지)
_VS_DB=$(find "$PROJECT_ROOT" -maxdepth 1 -name "vibespec.db" 2>/dev/null | head -1)

# 각 규칙의 Applies When과 변경 파일 매칭
SOFT_RULES=""
HARD_RULES_JSON="[]"

for rule_file in "${RULE_FILES_ARR[@]}"; do
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
  MATCHED=false
  for changed_file in "${CHANGED_FILES_ARR[@]}"; do
    DIR_NAME=$(dirname "$changed_file" | sed 's|/|-|g')
    BASE_NAME=$(basename "$changed_file" | sed 's/\.[^.]*$//')

    if echo "$APPLIES_WHEN" | grep -qiE "$DIR_NAME|$BASE_NAME"; then
      MATCHED=true
      break
    fi
  done

  if [ "$MATCHED" = false ]; then
    continue
  fi

  # Enforcement 파싱 (default: SOFT) (AC03)
  ENFORCEMENT=$(grep -m1 '^Enforcement:' "$rule_file" 2>/dev/null | sed 's/^Enforcement: *//' | tr '[:lower:]' '[:upper:]' | xargs)
  if [ -z "$ENFORCEMENT" ]; then
    ENFORCEMENT="SOFT"
  fi

  # Rule-ID 파싱
  RULE_ID=$(grep -m1 '^Rule-ID:' "$rule_file" 2>/dev/null | sed 's/^Rule-ID: *//' | xargs)
  if [ -z "$RULE_ID" ]; then
    RULE_ID=$(basename "$rule_file" .md)
  fi

  if [ "$ENFORCEMENT" = "HARD" ]; then
    # NEVER DO 섹션 추출
    NEVER_DO=$(sed -n '/^## NEVER DO/,/^## /p' "$rule_file" 2>/dev/null | grep -v '^##' | tr '\n' ' ' | xargs)
    if [ -z "$NEVER_DO" ]; then
      # fallback: 전체 본문 (frontmatter 이후)
      NEVER_DO=$(sed -n '/^---$/,/^---$/!p' "$rule_file" 2>/dev/null | tail -n +2 | head -20 | tr '\n' ' ' | xargs)
    fi

    # HARD 규칙 JSON 배열에 추가 (AC04)
    HARD_RULES_JSON=$(echo "$HARD_RULES_JSON" | jq \
      --arg title "$RULE_TITLE" \
      --arg never_do "$NEVER_DO" \
      --arg rule_id "$RULE_ID" \
      '. + [{
        rule_title: $title,
        never_do: $never_do,
        fix_instruction: ("vs self-improve rules update " + $rule_id + " --enforcement SOFT")
      }]')
  else
    # SOFT 규칙 (AC02)
    SOFT_RULES="${SOFT_RULES}- [$(basename "$rule_file" .md)] ${RULE_TITLE}\n"

    if [ -n "$_VS_DB" ] && [ -n "$RULE_ID" ]; then
      sqlite3 "$_VS_DB" "UPDATE self_improve_rules SET occurrences = occurrences + 1, last_triggered_at = datetime('now') WHERE id = '$RULE_ID'" 2>/dev/null || true
    fi
  fi
done

# HARD 규칙이 있으면 exit 2로 강제 차단 (AC01)
HARD_COUNT=$(echo "$HARD_RULES_JSON" | jq 'length')
if [ "$HARD_COUNT" -gt 0 ]; then
  if [ -n "$_VS_DB" ]; then
    for _HARD_RULE_ID in $(echo "$HARD_RULES_JSON" | jq -r '.[].rule_id // empty' 2>/dev/null); do
      if [ -n "$_HARD_RULE_ID" ]; then
        sqlite3 "$_VS_DB" "UPDATE self_improve_rules SET occurrences = occurrences + 1, last_triggered_at = datetime('now') WHERE id = '$_HARD_RULE_ID'" 2>/dev/null || true
      fi
    done
  fi

  jq -n --argjson rules "$HARD_RULES_JSON" '{
    error: "HARD enforcement rules violated",
    violations: $rules,
    message: "커밋이 차단되었습니다. HARD 규칙을 위반하는 변경사항이 있습니다. 규칙을 준수하거나, fix_instruction을 사용하여 enforcement를 SOFT로 변경하세요."
  }'
  exit 2
fi

# SOFT 규칙이 있으면 리마인드 (AC02)
if [ -n "$SOFT_RULES" ]; then
  jq -n --arg rules "$SOFT_RULES" '{
    additionalContext: ("커밋 전 확인: 관련 self-improve 규칙이 있습니다:\n" + $rules + "규칙을 준수하는지 확인 후 커밋하세요.")
  }'
fi

exit 0
