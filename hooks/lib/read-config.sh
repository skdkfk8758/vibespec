#!/bin/bash
# 공유 유틸리티: VibeSpec config를 SQLite에서 직접 읽기
# Node.js 프로세스 호출 없이 ~1ms로 config 값을 조회

_vs_find_db() {
  # VIBESPEC_DB_PATH 환경변수 우선
  if [ -n "${VIBESPEC_DB_PATH:-}" ]; then
    echo "$VIBESPEC_DB_PATH"
    return
  fi

  # git 프로젝트 루트에서 vibespec.db 찾기
  local root
  root=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
  if [ -n "$root" ] && [ -f "$root/vibespec.db" ]; then
    echo "$root/vibespec.db"
    return
  fi

  # 현재 디렉토리
  if [ -f "vibespec.db" ]; then
    echo "vibespec.db"
    return
  fi

  echo ""
}

# vs_config_get <key> [default]
# SQLite에서 직접 config 값을 읽습니다.
vs_config_get() {
  local key="$1"
  local default="${2:-}"
  local db_path
  db_path=$(_vs_find_db)

  if [ -z "$db_path" ] || [ ! -f "$db_path" ]; then
    echo "$default"
    return 0
  fi

  # sqlite3가 없으면 fallback으로 node CLI 사용
  if ! command -v sqlite3 &>/dev/null; then
    local plugin_root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[1]}")/.." && pwd)}"
    local value
    value=$(node "$plugin_root/dist/cli/index.js" --json config get "$key" 2>/dev/null | jq -r '.value // empty' 2>/dev/null || echo "")
    if [ -z "$value" ]; then
      echo "$default"
    else
      echo "$value"
    fi
    return 0
  fi

  local value
  # key를 이스케이프하여 SQL injection 방지 (single quote 이중화)
  local safe_key="${key//\'/\'\'}"
  value=$(sqlite3 "$db_path" "SELECT value FROM vs_config WHERE key='$safe_key' LIMIT 1;" 2>/dev/null || echo "")

  if [ -z "$value" ]; then
    echo "$default"
  else
    echo "$value"
  fi
}

# jq 사전 체크 — 미설치 시 에러 메시지와 함께 차단
vs_require_jq() {
  local caller="${1:-hook}"
  if ! command -v jq &>/dev/null; then
    echo "{\"decision\":\"block\",\"reason\":\"[$caller] jq가 설치되어 있지 않습니다. brew install jq 또는 apt install jq로 설치하세요.\"}"
    exit 2
  fi
}

# CLAUDE_TOOL_INPUT에서 command 필드 추출
vs_extract_command() {
  echo "${CLAUDE_TOOL_INPUT:-}" | jq -r '.command // empty' 2>/dev/null
}

# CLAUDE_TOOL_INPUT에서 file_path 필드 추출
vs_extract_file_path() {
  echo "${CLAUDE_TOOL_INPUT:-}" | jq -r '.file_path // empty' 2>/dev/null
}
