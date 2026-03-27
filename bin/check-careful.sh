#!/usr/bin/env bash
# PreToolUse hook: Bash 명령에서 파괴적 명령을 차단합니다.
# careful.enabled=true일 때만 활성화됩니다.

set -euo pipefail

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-}"

# Bash 도구만 검사
if [[ "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

# DB에서 careful.enabled 확인
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CAREFUL_ENABLED=$(node "$SCRIPT_DIR/dist/cli/index.js" config get careful.enabled 2>/dev/null || echo "")

if [[ "$CAREFUL_ENABLED" != "true" ]]; then
  exit 0
fi

# 명령어 추출 (TOOL_INPUT에서 command 필드)
COMMAND=$(echo "$TOOL_INPUT" | node -e "
  try {
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log(d.command || '');
  } catch { console.log(''); }
" 2>/dev/null || echo "")

if [[ -z "$COMMAND" ]]; then
  exit 0
fi

# 파괴적 명령 패턴 검사
DANGEROUS_PATTERNS=(
  'rm\s+-rf'
  'rm\s+-fr'
  'DROP\s+TABLE'
  'DROP\s+DATABASE'
  'TRUNCATE\s+'
  'git\s+push\s+--force'
  'git\s+push\s+-f\b'
  'git\s+reset\s+--hard'
  'git\s+clean\s+-f'
  'git\s+checkout\s+--\s+\.'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qEi "$pattern"; then
    MATCHED=$(echo "$COMMAND" | grep -oEi "$pattern" | head -1)
    echo "⚠️  [vs-careful] 파괴적 명령이 감지되었습니다: $MATCHED" >&2
    echo "    명령: $COMMAND" >&2
    echo "    해제하려면: vs careful off" >&2
    exit 2
  fi
done

exit 0
