---
name: vs-qa
description: QA 에이전트 팀을 실행합니다. 프로젝트 구조 분석 → 시나리오 생성 → 검증 → 이슈 수집 → 수정 플래닝까지 수행합니다.
invocation: user
---

# QA 에이전트 팀 실행

프로젝트의 플랜을 대상으로 QA 에이전트 팀을 실행합니다.
qa-coordinator가 시나리오를 생성하고, qa-func-tester/qa-flow-tester가 병렬 검증하며,
qa-reporter가 이슈를 정리하고 수정 플랜을 생성합니다.

## When to Use

**사용하세요:**
- 구현 중/후 시나리오 기반 결함 탐지가 필요할 때
- 새 기능 구현 후 다양한 사용자 플로우를 검증할 때
- 이슈 수집 및 수정 플래닝이 필요할 때

**사용하지 마세요:**
- 플랜 완료 최종 판정 → `vs-plan-verify` 사용
- 개별 태스크 완료 검증 → `verification` 에이전트 자동 실행 (vs-next에 포함)
- 보안 취약점 점검 → `vs-security` 사용

**모드별 한 줄 가이드:**

| 모드 | 상황 |
|------|------|
| Full | 플랜의 모든 완료 태스크를 종합 검증할 때 |
| Incremental | 마지막 QA 이후 변경분만 빠르게 재검증할 때 |
| Targeted | 특정 태스크만 집중 검증할 때 |
| Visual | 브라우저 기반 시각/기능 검증이 필요할 때 |
| Design Verification | DESIGN.md 준수 여부와 디자인 일관성을 확인할 때 |

**vs-qa vs vs-plan-verify 비교:**

| 관점 | vs-qa | vs-plan-verify |
|------|-------|----------------|
| 목적 | 결함 발견 및 이슈 수집 | 플랜 완료 최종 게이트 |
| 시점 | 구현 중/후 언제든 | 모든 태스크 완료 후 |
| 방법 | QA 에이전트 팀 위임 | 직접 npm test/build/lint 실행 |
| 결과 | QA findings + 수정 플랜 | Pass/Fail 판정 |
| 트리거 | 수동 (`/vs-qa`) | 수동 (`/vs-plan-verify`) 또는 vs-dashboard 알림 |

## CLI Reference

### QA 실행
- `vs --json qa run create <plan_id> [--trigger <type>]` — QA Run 생성
- `vs --json qa run list [--plan <plan_id>]` — QA Run 목록
- `vs --json qa run show <run_id>` — QA Run 상세

### 시나리오 / Findings / 상태 조회
- `vs --json qa scenario list <run_id>` — 시나리오 목록 (이전: `/vs-qa-scenarios`)
- `vs --json qa finding list [--run <run_id>]` — 이슈 목록 (이전: `/vs-qa-findings`)
- `vs --json qa stats [--plan <plan_id>]` — QA 통계 (이전: `/vs-qa-status`)

### QA 설정 관리
- `vs --json qa config resolve [plan_id]` — 프로젝트 QA 규칙 조회 (L0+L1+L2 머지)
- `vs --json qa config validate` — qa-rules.yaml 유효성 검증
- `vs --json qa config init` — 프로젝트 분석 후 qa-rules.yaml 자동 생성
- `vs --json qa config show` — 현재 설정을 보기 좋게 출력

### 기타
- `vs plan show <plan_id> --json` — 플랜 상세 + 태스크 트리

## Steps

1. **활성 플랜 확인**
   - Bash 도구로 `vs --json dashboard` 명령을 실행하세요
   - 활성 플랜이 없으면 "활성 플랜이 없습니다. `/vs-plan`으로 플랜을 먼저 생성하세요" 안내
   - 활성 플랜이 1개면 자동 선택
   - 여러 개면 `AskUserQuestion`으로 대상 플랜 선택:
     - question: "어떤 플랜의 QA를 실행할까요?"
     - 각 플랜을 선택지로 제시 (제목 + 진행률)

2. **사전 검증**
   - `vs plan show <plan_id> --json`으로 태스크 조회
   - done 태스크가 0개이면: "완료된 태스크가 없어 QA를 실행할 수 없습니다" 경고 후 STOP
   - `vs --json qa run list --plan <plan_id>`로 기존 Run 확인
   - running 상태의 Run이 있으면:
     ```
     이미 진행 중인 QA Run이 있습니다 (ID: {run_id}).
     ```
     - `AskUserQuestion`으로 "대기" / "취소 후 새로 실행" 선택

3. **QA 모드 선택**
   - `AskUserQuestion`으로 모드 선택:
     - question: "QA 모드를 선택하세요"
     - header: "QA 모드"
     - 선택지:
       - label: "전체 (Full)", description: "플랜의 모든 완료 태스크를 대상으로 QA 수행"
       - label: "증분 (Incremental)", description: "마지막 QA 이후 변경분만 재검증"
       - label: "타겟 (Targeted)", description: "특정 태스크만 대상으로 QA 수행"
       - label: "Visual", description: "browser-control 기반 시각/기능 검증 포함 — 기존 QA + acceptance 테스터 병렬 실행"
       - label: "디자인 검증 (Design Verification)", description: "UI 변경 파일 대상 디자인 일관성/AI slop/반응형/DESIGN.md 준수 검증 — acceptance 테스터의 디자인 체크리스트 실행"
   - incremental 선택 시: **Diff-aware 라우트 매핑** 자동 실행:
     1. `git diff --name-only HEAD~5` (또는 마지막 QA 이후)로 변경 파일 수집
     2. 변경 파일에서 영향 라우트를 자동 추론:
        - `pages/xxx.tsx` 또는 `pages/xxx/index.tsx` → `/xxx`
        - `app/xxx/page.tsx` → `/xxx`
        - `src/routes/xxx.tsx` → `/xxx`
        - 컴포넌트 파일(components/)이면: `Grep`으로 해당 컴포넌트를 import하는 페이지를 역추적
        - **API 파일**(api/, routes/, controllers/, server/)이면: 해당 API 엔드포인트 경로를 추출하고, `Grep`으로 프론트엔드에서 해당 경로를 호출하는 파일을 역추적
          - 동적 경로 파라미터(`:id`, `[id]`, `${id}`)는 `.*`로 치환하여 Grep 패턴 생성
            - 예: `/api/plugins/:id` → Grep 패턴: `/api/plugins/.*`
          - 검색 패턴: `fetch.*{endpoint}`, `axios.*{endpoint}`, `api\.(get|post|put|delete).*{endpoint}`, `useFetch.*{endpoint}`, `useQuery.*{endpoint}`
          - 발견된 프론트 파일의 라우트를 affected_routes에 추가
     3. 비UI 파일만 변경 + API 역추적으로도 프론트 파일이 발견되지 않는 경우: 라우트 매핑 스킵, API/로직 변경으로 분류
     4. 추론된 라우트 목록을 coordinator에 `affected_routes`로 전달
     5. coordinator는 해당 라우트에 집중하여 시나리오를 생성
   - targeted 선택 시 추가 질문: 대상 태스크 선택
   - visual 선택 시: mode를 `visual`로 설정. coordinator가 기존 func/flow 테스터와 함께 qa-acceptance-tester도 디스패치합니다
   - design-verification 선택 시: mode를 `design-verification`으로 설정. coordinator가 design verification 시나리오만 생성하여 qa-acceptance-tester에게 위임합니다. func/flow 테스터는 디스패치하지 않습니다

4. **QA 깊이 선택**
   - `AskUserQuestion`으로 깊이 선택:
     - question: "QA 깊이를 선택하세요"
     - header: "QA 깊이"
     - 선택지:
       - label: "Quick", description: "핵심 시나리오만 (critical/high) — 빠른 검증"
       - label: "Standard (권장)", description: "표준 시나리오 (medium까지) — 균형 잡힌 검증"
       - label: "Thorough", description: "심층 시나리오 (low까지) — 완전한 검증"

5. **리뷰 모드 선택**
   - `AskUserQuestion`으로 리뷰 모드 선택:
     - question: "시나리오를 실행 전에 리뷰하시겠습니까?"
     - header: "리뷰 모드"
     - multiSelect: false
     - 선택지:
       - label: "리뷰 후 실행 (권장)", description: "생성된 시나리오를 확인하고 추가/제외한 뒤 실행합니다"
       - label: "바로 실행", description: "시나리오 리뷰 없이 바로 QA를 실행합니다"
   - "리뷰 후 실행" → review_mode: `review`
   - "바로 실행" → review_mode: `auto`

6. **QA Run 생성**
   - Bash 도구로 `vs --json qa run create <plan_id>` 명령을 실행하세요
   - 생성된 run_id를 기록하세요

7. **qa-coordinator 에이전트 디스패치**
   - Agent 도구를 사용하여 qa-coordinator 에이전트를 디스패치하세요:
     - `subagent_type`: 없음 (일반 에이전트)
     - `run_in_background`: false
     - 전달 정보:
       ```
       당신은 qa-coordinator 에이전트입니다.
       다음 정보로 QA를 실행하세요:

       - plan_id: {plan_id}
       - run_id: {run_id}
       - mode: {full|incremental|targeted|visual|design-verification}
       - depth: {quick|standard|thorough}
       - review_mode: {review|auto}
       - target_tasks: {targeted 모드 시 태스크 ID 목록}

       agents/qa-coordinator.md의 Execution Process를 따라 실행하세요.
       ```
   - coordinator가 내부적으로 qa-func-tester, qa-flow-tester, qa-reporter를 디스패치합니다

8. **결과 대기 & 리포트 표시**
   - coordinator의 최종 리포트를 사용자에게 표시하세요
   - `vs --json qa run show <run_id>`로 최종 상태를 확인하세요

9. **후속 조치 안내**
   - `AskUserQuestion`으로 다음 단계 선택:
     - question: "다음으로 무엇을 하시겠습니까?"
     - header: "다음 단계"
     - 조건부 선택지:
       - (수정 플랜 생성됨) "수정 플랜 실행" → `/vs-next`로 QA Fix 플랜의 태스크 시작
       - (이슈 있음) "이슈 상세 확인" → `/vs-qa-findings`
       - "대시보드 확인" → `/vs-dashboard`
       - "QA 재실행" → `/vs-qa` (다른 모드/깊이로)

## 다음 단계

- → `/vs-qa-status`로 QA 결과 상세 조회
- → `/vs-qa-findings`로 이슈 관리
- → `/vs-dashboard`로 전체 현황 확인
- → `/vs-next`로 수정 플랜 태스크 시작
