---
name: vs-acceptance
description: Use when verifying that implemented features actually work as intended. Dev server를 시작하고, acceptance criteria 기반으로 browser-control 및 코드 분석 검증을 수행합니다. 머지 후, 플랜 검증, 또는 독립 호출 가능.
invocation: user
argument-hint: "[plan_id] [--url <dev-server-url>]"
---

# Acceptance Testing

구현된 기능이 실제로 의도대로 동작하는지 검증합니다.
빌드/테스트 통과를 넘어, 실제 브라우저에서 UI가 렌더링되고 사용자 플로우가 작동하는지 확인합니다.

## When to Use

**사용하세요:**
- vs-merge 후 Post-Merge Acceptance로 (Phase 6.5에서 자동 연결)
- vs-plan-verify 전에 실제 동작을 확인하고 싶을 때
- 구현 완료 후 수동으로 동작을 검증하고 싶을 때

**사용하지 마세요:**
- 단위 테스트/빌드 검증 → `verification` 스킬
- 체계적 QA 시나리오 검증 → `/vs-qa`
- 코드 품질 리뷰 → `/simplify-loop`

## Input Resolution

1. **`plan_id`** — 해당 플랜의 done 태스크 acceptance criteria를 검증 대상으로 사용
2. **`--url <url>`** — 이미 실행 중인 dev server URL 지정
3. **인자 없음** — 활성 플랜 자동 탐색 또는 `git diff` 기반 변경 범위 파악

## Steps

### Phase 1: 컨텍스트 수집

1. **플랜 확인**
   - `$ARGUMENTS`에 plan_id가 있으면 해당 플랜 사용
   - 없으면 `vs --json plan list`로 active 플랜 자동 탐색
   - 활성 플랜이 없으면 **plan-free 모드**: `git diff --stat HEAD~5..HEAD`로 최근 변경 파일을 수집하여 검증 범위로 사용

2. **검증 대상 수집**
   - **플랜 모드**: `vs plan show <plan_id> --json`으로 done 태스크의 acceptance criteria를 수집
   - **plan-free 모드**: 변경된 파일에서 관련 기능/모듈을 추론

3. **프로젝트 타입 감지**
   - `package.json`의 `scripts` 필드에서 `dev`, `start`, `serve` 스크립트 확인
   - 웹 프로젝트: dev server 시작 → browser 검증
   - 비웹 프로젝트: 코드 분석만 수행

### Phase 2: Dev Server 준비

1. **URL 확인**
   - `--url`이 지정되었으면 해당 URL 사용
   - 미지정이면 `package.json`에서 dev server 명령 감지:
     - `scripts.dev` → `npm run dev` (기본 포트 추정: 3000, 5173, 8080 순)
     - `scripts.start` → `npm start`
     - `scripts.serve` → `npm run serve`

2. **기존 서버 확인**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
   ```
   - 200/304 응답 → 이미 실행 중, 새로 시작하지 않음
   - 연결 실패 → dev server 시작 필요

3. **Dev Server 시작** (필요한 경우)
   ```bash
   npm run dev &
   DEV_PID=$!
   ```
   - 최대 30초 대기, health check 반복
   - 시작 실패 → browser 검증 SKIP, 코드 분석만 수행으로 fallback
   - 사용자에게 "dev server를 시작했습니다 (PID: {pid})" 알림

### Phase 3: Acceptance 시나리오 생성

수집된 acceptance criteria를 검증 시나리오로 변환합니다:

1. **각 AC 항목에서 시나리오 추출**
   - AC의 각 항목을 개별 시나리오로 변환
   - 예: "로그인 API가 올바른 토큰을 반환해야 한다" → 시나리오: 로그인 API 토큰 검증

2. **시나리오 우선순위 결정**
   - 핵심 기능 (MUST) → critical
   - 보조 기능 (SHOULD) → high
   - 부가 기능 (COULD) → medium

3. **QA Run 생성**
   ```bash
   vs --json qa run create <plan_id> --trigger post_merge
   ```
   - plan-free 모드에서는 QA Run 생성 없이 로컬 검증만 수행

4. **시나리오 DB 등록** (플랜 모드)
   ```bash
   vs --json qa scenario create <run_id> \
     --title "<시나리오 제목>" \
     --description "<Given-When-Then 형식>" \
     --category acceptance \
     --priority <critical|high|medium> \
     --related-tasks "<task_ids>"
   ```

### Phase 4: 검증 실행

1. **qa-acceptance-tester 에이전트 디스패치**
   - Agent 도구를 사용하여 디스패치:
     ```
     당신은 qa-acceptance-tester 에이전트입니다.
     다음 정보로 acceptance 검증을 실행하세요:

     - run_id: {run_id}
     - scenarios: {시나리오 목록}
     - plan_context: {플랜 제목, 스펙 요약}
     - project_info: {기술 스택, 테스트 러너}
     - dev_server_url: {URL}

     agents/qa-acceptance-tester.md의 Execution Process를 따라 실행하세요.
     ```
   - `run_in_background: false`로 결과를 기다리세요

2. **plan-free 모드에서는**:
   - 에이전트 디스패치 대신 직접 검증 수행
   - 변경된 파일의 관련 테스트 실행
   - browser-control로 핵심 페이지 확인 (dev server가 있는 경우)

### Phase 5: 결과 리포트

에이전트 결과를 다음 형식으로 출력하세요:

```
## Acceptance Testing 리포트

### Verdict: [PASS | WARN | FAIL]

### 검증 모드: [browser | code-analysis | mixed]
### 플랜: {title} (#{plan_id}) 또는 "plan-free 모드"

### 시나리오 결과
| # | 시나리오 | 결과 | 증거 |
|---|---------|------|------|
| 1 | {title} | PASS | {evidence} |
| 2 | {title} | FAIL | {error} |

### 발견된 이슈
- {finding 목록 또는 "없음"}

### 통계
- 총 시나리오: N개
- PASS: N / WARN: N / FAIL: N / SKIP: N
```

### Phase 6: 후속 처리

1. **Dev Server 정리** (시작한 경우)
   ```bash
   kill $DEV_PID 2>/dev/null
   ```

2. **판정별 후속**

   **PASS:**
   → "모든 acceptance 검증이 통과했습니다." 표시
   → 호출자(vs-merge 등)에게 PASS 반환

   **WARN:**
   → 리포트 표시 후 `AskUserQuestion`:
   - "경고 항목이 있습니다. 어떻게 진행할까요?"
   - 선택지:
     - "계속 진행" → 호출자에게 WARN 반환
     - "이슈 확인" → `/vs-qa-findings`로 안내

   **FAIL:**
   → 리포트 표시 후 `AskUserQuestion`:
   - "검증 실패 항목이 있습니다. 어떻게 진행할까요?"
   - 선택지:
     - "수정 후 재검증" → 실패 원인 가이드 제공
     - "강제 진행" → 호출자에게 WARN으로 변환하여 반환 (사용자 명시적 선택)
     - "중단" → 호출자에게 FAIL 반환 (vs-merge에서는 롤백)

## Rules

- dev server 시작 시 반드시 PID를 기록하고, 완료 후 정리하세요
- browser-control 불가 시 에이전트가 자동으로 코드 분석 모드로 전환합니다
- plan-free 모드에서는 QA DB에 기록하지 않습니다 (로컬 검증만)
- 기존 vs-qa의 기능과 중복되지 않도록: vs-qa는 "시나리오 생성 → 체계적 QA", vs-acceptance는 "AC 기반 동작 확인"에 집중

## 다음 단계

- → `/vs-qa`로 종합 QA 실행
- → `/vs-qa-findings`로 이슈 관리
- → `/vs-plan-verify`로 플랜 검증
- → `/vs-merge`로 머지 진행
