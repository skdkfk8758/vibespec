#!/bin/bash
set -e

# PreToolUse hook: git commit 시 plugin.json 필수 필드 검증
# - skills 필드 누락 등 플러그인 매니페스트 무결성 체크

COMMAND=$(echo "$CLAUDE_TOOL_INPUT" | jq -r '.command // empty')

# git commit 명령이 아니면 통과
if ! echo "$COMMAND" | grep -qE '^git commit'; then
  exit 0
fi

PLUGIN_JSON=".claude-plugin/plugin.json"

# plugin.json 파일이 없으면 통과 (플러그인 프로젝트가 아닐 수 있음)
if [ ! -f "$PLUGIN_JSON" ]; then
  exit 0
fi

ERRORS=""

# 필수 필드 체크
for field in name version description skills; do
  VALUE=$(jq -r ".$field // empty" "$PLUGIN_JSON")
  if [ -z "$VALUE" ]; then
    ERRORS="${ERRORS}\n  - \"$field\" 필드가 누락됨"
  fi
done

# skills 디렉토리 존재 여부 체크
SKILLS_PATH=$(jq -r '.skills // empty' "$PLUGIN_JSON")
if [ -n "$SKILLS_PATH" ]; then
  # ./skills/ -> skills/
  SKILLS_DIR=$(echo "$SKILLS_PATH" | sed 's|^\./||')
  if [ ! -d "$SKILLS_DIR" ]; then
    ERRORS="${ERRORS}\n  - skills 경로 \"$SKILLS_PATH\"에 해당하는 디렉토리가 없음"
  fi
fi

if [ -n "$ERRORS" ]; then
  jq -n --arg errors "$ERRORS" '{
    decision: "block",
    reason: ("plugin.json 검증 실패:" + $errors + "\n커밋 전에 .claude-plugin/plugin.json을 수정해주세요.")
  }'
  exit 0
fi

exit 0
