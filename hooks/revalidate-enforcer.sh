#!/bin/bash
# Stop hook: 재검증 플래그 존재 시 응답을 가로채고 재검증 프롬프트 주입
# doubt 패턴 (plugins-for-claude-natives) 차용

# fail-open: 에러 시 원본 응답 그대로 전달
trap 'exit 0' ERR

# glob으로 현재 세션의 플래그 파일 검색 (PPID-*.flag 패턴)
FLAG_FILE=$(ls /tmp/vibespec-revalidate-${PPID}-*.flag 2>/dev/null | head -1)

# 플래그 파일 존재 확인
if [ -z "$FLAG_FILE" ] || [ ! -f "$FLAG_FILE" ]; then
  exit 0
fi

# 플래그 읽기
FLAG_CONTENT=$(cat "$FLAG_FILE" 2>/dev/null || echo '{}')

# jq 없으면 간단 파싱으로 fallback
if command -v jq &>/dev/null; then
  COUNT=$(echo "$FLAG_CONTENT" | jq -r '.count // 0' 2>/dev/null || echo "0")
else
  COUNT=$(echo "$FLAG_CONTENT" | grep -o '"count":[0-9]*' | grep -o '[0-9]*' || echo "0")
fi

# 무한루프 방지: count >= 1이면 플래그 삭제 후 통과
if [ "$COUNT" -ge 1 ] 2>/dev/null; then
  rm -f "$FLAG_FILE"
  exit 0
fi

# count를 1로 증가시켜 플래그 업데이트
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")
cat > "$FLAG_FILE" 2>/dev/null <<EOF
{"mode":"standard","count":1,"timestamp":"$TIMESTAMP"}
EOF

# 재검증 프롬프트를 stdout으로 출력 (additionalContext로 주입됨)
cat <<'REVALIDATE'
[재검증 모드 활성화] 이전 응답을 다음 관점에서 재검증하세요:
1) 사실 정확성 — 잘못된 정보나 부정확한 주장이 있는가?
2) 논리적 일관성 — 답변 내에서 모순되는 내용이 있는가?
3) 누락된 고려사항 — 중요하지만 빠뜨린 관점이 있는가?
4) 잠재적 hallucination — 확신할 수 없는 내용을 사실처럼 서술했는가?

문제를 발견하면 수정하고, 수정 사항을 명시하세요. 문제가 없으면 원본 응답을 유지하세요.
REVALIDATE

exit 0
