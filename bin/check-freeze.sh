#!/usr/bin/env bash
# PreToolUse hook: Edit/Write 대상 파일이 freeze.path 범위 안인지 검사합니다.
# freeze.path가 설정되어 있을 때만 활성화됩니다.

set -euo pipefail

TOOL_NAME="${TOOL_NAME:-}"
TOOL_INPUT="${TOOL_INPUT:-}"

# Edit, Write, Bash 도구 검사
if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Bash" ]]; then
  exit 0
fi

# DB에서 freeze.path 확인
SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FREEZE_PATH=$(node "$SCRIPT_DIR/dist/cli/index.js" config get freeze.path 2>/dev/null || echo "")

if [[ -z "$FREEZE_PATH" ]]; then
  exit 0
fi

# 대상 파일 경로 추출
TARGET_FILE=$(echo "$TOOL_INPUT" | node -e "
  try {
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    if (d.file_path) {
      // Edit/Write 도구: file_path 직접 추출
      console.log(d.file_path);
    } else if (d.command) {
      // Bash 도구: 리다이렉션 대상 파일 추출 (>, >>, tee)
      // 참고: 완벽하지 않으나 주요 패턴을 커버
      const m = d.command.match(/(?:>|>>|tee\s+(?:-a\s+)?)\s*([^\s;|&]+)/);
      if (m) console.log(m[1]);
      else console.log('');
    } else {
      console.log('');
    }
  } catch { console.log(''); }
" 2>/dev/null || echo "")

if [[ -z "$TARGET_FILE" ]]; then
  exit 0
fi

# 절대 경로로 변환
FREEZE_ABS=$(cd "$FREEZE_PATH" 2>/dev/null && pwd || echo "$FREEZE_PATH")
TARGET_ABS=$(cd "$(dirname "$TARGET_FILE")" 2>/dev/null && echo "$(pwd)/$(basename "$TARGET_FILE")" || echo "$TARGET_FILE")

# prefix 매칭: 대상 파일이 freeze.path 하위인지 확인
if [[ "$TARGET_ABS" == "$FREEZE_ABS"* ]]; then
  exit 0
fi

echo "⚠️  [vs-freeze] 편집 범위 밖입니다." >&2
echo "    허용 범위: $FREEZE_PATH" >&2
echo "    대상 파일: $TARGET_FILE" >&2
echo "    해제하려면: vs freeze off" >&2
exit 2
