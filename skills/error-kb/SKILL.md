---
name: error-kb
description: "[Learn] Search and record error patterns and solutions."
invocation: deferred
---

# Error Knowledge Base

에러 발생 시 과거 해결책을 조회하고, 디버깅 완료 후 새 에러를 기록합니다.

## When to Use

- 에러/버그 발생 시 (테스트 실패, 빌드 에러, 런타임 에러)
- 디버깅 완료 후 해결책 기록
- 구현 시작 전 관련 에러 패턴 사전 조회
- Trigger keywords: "에러", "error", "bug", "테스트 실패", "빌드 에러", "런타임 에러", "왜 안돼", "디버그"

## Steps

1. **에러 KB 검색**
   - Bash 도구로 `vs error-kb search "<에러 키워드>" --json` 명령을 실행하세요
   - 에러 메시지, 스택 트레이스, 관련 키워드를 검색어로 사용하세요

2. **결과 분석**
   - 매칭되는 에러가 발견되면:
     - 기록된 해결책(solution)을 확인하고 적용을 시도하세요
     - 이전 발생 횟수(occurrences)와 심각도(severity)를 참고하세요
   - 매칭되는 에러가 없으면:
     - 일반 디버깅을 진행하세요

3. **에러 기록/업데이트** (디버깅 완료 직후 반드시 실행)
   - 먼저 Bash 도구로 `vs error-kb search "<에러 메시지 키워드>" --json`으로 기존 에러를 조회하세요
   - 기존 에러가 매칭되면:
     - Bash 도구로 `vs error-kb update <id> --occurrence "재발 상황: <컨텍스트>" --json` 명령을 실행하세요
   - 매칭되는 에러가 없으면 (새 에러):
     - Bash 도구로 `vs error-kb add --title "..." --cause "..." --solution "..." --tags "tag1,tag2" --severity <level> --json` 명령을 실행하세요
   - 현재 진행 중인 태스크가 있으면: cause/solution에 `[task:<ID>]` 태그를 포함하세요

   **Severity 판단 기준:**
   | 상황 | Severity |
   |------|----------|
   | 보안 취약점, 데이터 유실 | critical |
   | 빌드 실패, 배포 차단 | high |
   | 테스트 실패, 기능 오작동 | medium |
   | 경고, 스타일 이슈, 비기능적 | low |

4. **패턴 감지**
   - occurrences >= 3인 에러가 있으면 반복 패턴으로 간주하세요
   - `patterns/` 디렉토리에 해당 에러 패턴을 요약하는 문서 생성을 제안하세요
   - 패턴 문서에는 공통 원인, 예방 방법, 권장 해결 절차를 포함하세요

## Integration with other skills

- **vs-next**: 태스크 시작 시 관련 키워드로 `vs error-kb search` 실행을 권장합니다. 사전에 알려진 에러 패턴을 파악하면 구현 품질이 향상됩니다.
- **systematic-debugging**: 디버깅 스킬을 사용하여 문제를 해결한 후 `vs error-kb add`로 원인과 해결책을 기록하세요. 향후 동일 에러 발생 시 빠르게 대응할 수 있습니다.

## 다음 단계

- 에러 해결 후 → `/vs-next`로 태스크 작업 재개
- 반복 에러 패턴 발견 시 → `patterns/` 디렉토리에 예방 가이드 작성
- 디버깅이 필요한 경우 → `systematic-debugging` 스킬 활용
- 에러 현황 전체 조회 → `vs error-kb search "" --json`으로 전체 목록 확인
