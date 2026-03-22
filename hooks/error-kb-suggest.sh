#!/bin/bash

# PostToolUse hook: Bash 실행 결과에서 에러 패턴 감지 → KB 검색 제안
# 테스트 실패, 빌드 에러, 런타임 에러를 감지하면 additionalContext로 제안

# 성공한 명령은 무시
TOOL_EXIT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.exitCode // 0' 2>/dev/null)
if [ "$TOOL_EXIT" = "0" ]; then
  exit 0
fi

# 출력에서 첫 50줄만 파싱 (대량 출력 방지)
OUTPUT=$(echo "$CLAUDE_TOOL_OUTPUT" | jq -r '.stdout // empty, .stderr // empty' 2>/dev/null | head -50)

if [ -z "$OUTPUT" ]; then
  exit 0
fi

# 에러 패턴 감지
KEYWORD=""

if echo "$OUTPUT" | grep -qiE 'FAIL.*test|test.*FAIL|Tests.*failed'; then
  KEYWORD=$(echo "$OUTPUT" | grep -oE '(FAIL|×).*' | head -1 | sed 's/[^a-zA-Z0-9 ]//g' | cut -c1-50)
  ERROR_TYPE="테스트 실패"
elif echo "$OUTPUT" | grep -qE 'error TS[0-9]'; then
  KEYWORD=$(echo "$OUTPUT" | grep -oE 'error TS[0-9]+:.*' | head -1 | cut -c1-50)
  ERROR_TYPE="TypeScript 컴파일 에러"
elif echo "$OUTPUT" | grep -qiE 'BUILD FAILED|build failed|Build failed'; then
  KEYWORD=$(echo "$OUTPUT" | grep -iE 'BUILD FAILED|build failed' | head -1 | cut -c1-50)
  ERROR_TYPE="빌드 실패"
elif echo "$OUTPUT" | grep -qE '^Error:|^error:'; then
  KEYWORD=$(echo "$OUTPUT" | grep -E '^Error:|^error:' | head -1 | cut -c1-50)
  ERROR_TYPE="런타임 에러"
fi

# 에러 감지 시 제안 출력
if [ -n "$KEYWORD" ]; then
  CLEAN_KEYWORD=$(echo "$KEYWORD" | tr -d '"' | tr -d "'" | xargs)
  # Obsidian vault 설정 여부 확인
  VAULT_OPT=""
  if vs config get obsidian.vault >/dev/null 2>&1; then
    VAULT_OPT=" --with-obsidian"
  fi
  jq -n --arg type "$ERROR_TYPE" --arg kw "$CLEAN_KEYWORD" --arg vopt "$VAULT_OPT" '{
    additionalContext: ($type + "가 감지되었습니다. `vs error-kb search \"" + $kw + "\"" + $vopt + " --json`으로 과거 해결책을 확인해보세요.")
  }'
fi

exit 0
