#!/bin/bash
# UserPromptSubmit hook: !rv 키워드 감지 시 재검증 플래그 생성
# doubt 패턴 (plugins-for-claude-natives) 차용

# UserPromptSubmit hook은 fail-open (exit 0 기본)
# 에러 시에도 사용자 프롬프트를 차단하지 않음
trap 'exit 0' ERR

# stdin에서 사용자 프롬프트 읽기
PROMPT=$(cat 2>/dev/null || true)

if [ -z "$PROMPT" ]; then
  exit 0
fi

# 코드 블록 내 !rv 제거 (백틱 블록 안의 내용 무시)
# 1) 멀티라인 코드 블록 (```...```) 제거
CLEANED=$(echo "$PROMPT" | perl -0777 -pe 's/```.*?```//gs' 2>/dev/null || echo "$PROMPT")
# 2) 인라인 코드 (`...`) 제거
CLEANED=$(echo "$CLEANED" | sed 's/`[^`]*`//g' 2>/dev/null || echo "$CLEANED")

# !rv 키워드 감지: 라인 시작 또는 공백 뒤의 !rv (단어 경계)
if echo "$CLEANED" | grep -qE '(^|[[:space:]])!rv([[:space:]]|$)'; then
  # 플래그 파일 생성
  FLAG_FILE="/tmp/vibespec-revalidate-${PPID}-$$.flag"
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")

  cat > "$FLAG_FILE" 2>/dev/null <<EOF
{"mode":"standard","count":0,"timestamp":"$TIMESTAMP"}
EOF
fi

exit 0
