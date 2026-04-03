---
name: self-improve
description: "[Learn] Generate improvement rules from fix/error signals."
invocation: deferred
---

# Self-Improve

fix 커밋이나 디버깅 후 자동으로 수집된 pending 신호를 분석하여, 에러 패턴을 학습하고 반복 방지 규칙을 생성합니다.

## When to Use

- `self-improve-trigger` hook이 pending 파일 생성을 알렸을 때
- SessionStart에서 pending 대기 건수가 표시되었을 때
- 디버깅 완료 후 수동으로 교훈을 기록하고 싶을 때
- Trigger keywords: "self-improve", "자동 규칙", "학습", "패턴 기록"

## Steps

### Phase 1: Pending 수집

1. Bash 도구로 `.claude/self-improve/pending/` 디렉토리의 JSON 파일 목록을 확인하세요
   ```bash
   ls -la .claude/self-improve/pending/*.json 2>/dev/null
   ```
2. 각 JSON 파일을 읽어 pending 항목을 수집하세요
3. **중복 제거**: `commit_hash`가 동일한 항목은 가장 최신 것만 유지하세요
4. pending이 없으면 "처리할 pending이 없습니다"라고 알리고 종료하세요

### Phase 2: 근본 원인 분석 + 규칙 생성

각 pending 항목에 대해:

**a. 분석**

1. **diff 내용 분석**: `diff_content` 필드를 읽고 "무엇이 수정되었는가?" 파악
2. **커밋 메시지 분석**: `commit_message`에서 "왜 수정했는가?" 파악
3. **카테고리 분류**: 아래 7개 중 가장 적합한 것을 선택

   | 카테고리 | 설명 | 예시 |
   |----------|------|------|
   | `LOGIC_ERROR` | 로직 오류, null check 누락, 조건 반전 | optional chaining 누락 |
   | `TYPE_ERROR` | 타입 불일치, 잘못된 타입 사용 | string을 number로 사용 |
   | `API_MISUSE` | API/라이브러리 잘못된 사용법 | deprecated API 호출 |
   | `MISSING_EDGE` | 엣지 케이스 누락 | 빈 배열, 0 길이 문자열 |
   | `PATTERN_VIOLATION` | 프로젝트 패턴 위반 | 네이밍 컨벤션 불일치 |
   | `CONFIG_ERROR` | 설정/환경 관련 실수 | 잘못된 환경 변수 |
   | `TEST_GAP` | 테스트 커버리지 부족 | 미테스트 경로 |

4. **한 줄 요약** 생성: 규칙으로 만들 수 있는 형태의 문장
   예: "외부 API 응답의 모든 필드는 optional로 취급해야 한다"

**b. 규칙 생성**

분석 완료 후 바로 `.claude/rules/` 파일을 생성하세요:

1. 기존 규칙과 중복되는지 확인하세요:
   ```bash
   ls .claude/rules/{category}-*.md 2>/dev/null
   ```
   - 동일 카테고리 + 유사한 제목의 규칙이 이미 있으면 건너뛰세요

2. 규칙 파일을 아래 템플릿으로 생성하세요:

   ```markdown
   ---
   title: {한 줄 규칙 제목}
   source: self-improve
   category: {LOGIC_ERROR|TYPE_ERROR|API_MISUSE|MISSING_EDGE|PATTERN_VIOLATION|CONFIG_ERROR|TEST_GAP}
   prevented: 0
   created: {오늘 날짜 YYYY-MM-DD}
   last_triggered: {오늘 날짜}
   ---

   ## Rule
   {한 문장으로 된 명확한 규칙}

   ## Why
   {이 규칙이 필요한 이유 - 과거 에러 사례 요약 (2-3줄)}

   ## Examples
   ### Bad
   ```{lang}
   {잘못된 코드 패턴 - diff에서 추출}
   ```
   ### Good
   ```{lang}
   {올바른 코드 패턴 - 수정 후 코드에서 추출}
   ```

   ## Applies When
   {이 규칙이 적용되는 상황 조건 - 구체적 파일 패턴이나 모듈명}
   ```

3. `.claude/rules/{category}-{slug}.md` 경로에 Write 도구로 파일을 생성하세요
   - `{slug}`: 제목을 lowercase, 공백을 하이픈으로 변환, 50자 이내

4. **상한 체크**: 활성 규칙이 30개를 초과하면 사용자에게 `/self-improve-review`를 권장하세요

### Phase 3: 정리 및 요약

1. 처리 완료된 pending 파일을 `.claude/self-improve/processed/`로 이동하세요:
   ```bash
   mv .claude/self-improve/pending/{filename}.json .claude/self-improve/processed/
   ```

2. 결과 요약을 출력하세요:
   ```
   ## Self-Improve 결과

   ### 처리 현황
   - 처리: {N}건 / 건너뜀: {N}건 / 중복: {N}건

   ### 규칙 생성
   - 새 규칙 생성: {N}건
   - 중복 건너뜀: {N}건

   ### 생성된 규칙
   | 파일 | 카테고리 | 제목 |
   |------|----------|------|
   | .claude/rules/{file} | {category} | {title} |
   ```

## Integration

- **vs-commit**: fix 커밋 시 self-improve-trigger hook이 pending을 자동 생성합니다
- **self-improve-review**: 축적된 규칙의 효과를 분석하고 정리합니다

## 다음 단계

- → `/self-improve-review`로 규칙 효과 분석 및 정리
- → `/vs-next`로 다음 태스크 재개
