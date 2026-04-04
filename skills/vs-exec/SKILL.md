---
name: vs-exec
description: "[Core] Execute all tasks in one session. (일괄 실행)"
invocation: user
argument-hint: "[--inline] [--interactive]"
---

# vs-exec

## Step 0: 모드 판정

`$ARGUMENTS`에 `--interactive` 플래그가 있는지 확인하세요:
- **interactive 모드**: Phase 2 리뷰 체크포인트·Phase 4 종합 리포트 체크포인트 활성화
- **자동 모드 (기본)**: Phase 2는 리뷰 리포트 표시 후 "실행 시작" 자동 선택, Phase 4는 안내만

**자동 모드 기본값**:
| 체크포인트 | 자동 기본값 |
|---|---|
| careful 모드 제안 | **건너뛰기** (이미 on이면 스킵) |
| Phase 2 플랜 리뷰 | **실행 시작** (리뷰 리포트는 표시) |
| Phase 4 종합 리포트 | **안내만** (커밋/리뷰/대시보드 질문 없음) |

**안전장치 예외** (모드 무관):
- 배치 실행 중 FAIL 에스컬레이션 (수동 수정/건너뛰기/배치 중단) — 항상 질문
- Wave Gate RED 판정 — 항상 질문

플랜의 전체 태스크를 현재 세션에서 순차 실행합니다. 구현은 직접 수행하고, 검증은 기본적으로 verifier 에이전트를 디스패치합니다 (`--inline` 모드에서는 검증도 직접 수행).

vs-next/vs-pick은 태스크마다 tdd-implementer + verifier 에이전트를 디스패치하여 높은 품질을 보장합니다. vs-exec은 구현 서브에이전트(tdd-implementer)를 사용하지 않으므로 컨텍스트 격리나 독립 리뷰의 이점이 없지만, 단일 세션에서 플랜을 빠르게 소화할 수 있습니다.

> **Note:** 기본 모드에서도 verifier 에이전트는 디스패치됩니다. 완전히 서브에이전트 없이 실행하려면 `--inline` 플래그를 사용하세요.

### vs-next와의 차이

| 항목 | vs-next (서브에이전트) | vs-exec 기본 모드 | vs-exec --inline 모드 |
|------|----------------------|-------------------|----------------------|
| 컨텍스트 격리 | 태스크별 fresh 컨텍스트 | 누적 (오염 가능) | 누적 (오염 가능) |
| 구현 | tdd-implementer 에이전트 | 직접 구현 | 직접 구현 |
| 검증 | verifier 에이전트 | verifier 에이전트 | 직접 검증 (서브에이전트 없음) |
| 병렬성 | 최대 3개 동시 실행 | 순차 실행 | 순차 실행 |
| 적합 상황 | 복잡한 플랜, 높은 품질 요구 | 중간 규모, 빠른 실행 | 소규모, 최소 오버헤드 |

이 테이블은 사용자가 vs-exec을 처음 사용하거나, vs-next와의 차이를 물을 때만 보여주세요. 매번 표시하지 마세요.

### 플랜 크기 가이드

컨텍스트 윈도우는 유한합니다. 단일 세션에서 모든 태스크를 실행하므로 플랜 크기에 따라 접근을 달리하세요:

- **5개 이하**: 적합. 전체 실행 가능
- **6~10개**: 주의. 3~4개 태스크마다 중간 커밋(`/vs-commit`)을 권장
- **10개 초과**: vs-next의 서브에이전트 배치 실행이 더 적합하다고 안내하세요. 사용자가 그래도 vs-exec을 원하면 진행하되, 5개 단위로 끊어 실행하고 커밋하세요

## Steps

### Phase 1: 플랜 로드

1. **워크트리 환경 확인**
   - `git rev-parse --git-dir`로 워크트리 내부인지 확인하세요
   - 워크트리 밖이면 (경로에 `/worktrees/`가 없으면):
     → "메인 브랜치에서 직접 작업하게 됩니다. `/vs-worktree`로 격리 환경을 먼저 세팅하시겠습니까?"라고 안내하세요

2. **가드레일 활성화 제안**
   - Bash 도구로 `vs careful status` 명령을 실행하세요
   - careful이 비활성화 상태이면 `AskUserQuestion`으로 안내하세요:
     - "배치 실행 전 파괴적 명령 차단(careful 모드)을 활성화하시겠습니까?"
     - 선택지: "활성화" (→ `vs careful on`), "건너뛰기"
   - 이 제안은 선택적이며, 사용자가 건너뛰면 바로 다음 단계로 진행합니다

3. **활성 플랜 확인**
   - Bash 도구로 `vs plan list --json` 명령을 실행하세요. active/approved 플랜을 조회하세요
   - 여러 개면 `AskUserQuestion`으로 선택받으세요
   - 없으면 `/vs-plan`으로 안내하세요

3. **플랜 전체 로드**
   - Bash 도구로 `vs plan show <plan_id> --json` 명령을 실행하세요. spec + 전체 태스크 트리를 가져오세요
   - todo 태스크만 필터링하여 실행 대상 목록을 만드세요
   - 이미 done인 태스크는 건너뛰되, in_progress인 태스크가 있으면 우선 포함하세요
   - 플랜 크기 가이드에 따라 실행 전략을 결정하세요

### Phase 2: 비판적 리뷰

플랜을 맹목적으로 실행하면 안 됩니다. 실행 전에 플랜 자체의 품질을 검증하세요. 핵심 질문은 하나입니다: **"이 플랜대로 구현하면 실제로 동작하는 결과물이 나오는가?"**

4. **스펙 완성도 검토**
   - 플랜의 spec을 읽고 다음을 확인하세요:
     - Overview가 구현 범위를 명확히 정의하는가?
     - Requirements에 모호하거나 상충하는 항목이 없는가?
     - Data Model / API 정의가 구현에 충분한가?
     - Edge Cases가 식별되어 있는가?
   - 문제가 있으면 구체적으로 기록하세요 (이후 리포트에 포함)

5. **태스크 의존성 및 순서 검증**
   - 태스크 간 암묵적 의존성을 분석하세요:
     - DB 스키마 → 모델 → API → UI 순서가 맞는가?
     - 공유 유틸리티가 먼저 구현되는가?
     - 테스트 인프라가 선행되는가?
   - sort_order와 parent-child 관계가 실제 의존성을 반영하는지 확인하세요
   - 순서가 잘못된 경우 실행 순서를 재배치하세요 (DB 상태는 변경하지 않고 실행 순서만 조정)

6. **Acceptance Criteria 검토**
   - 각 태스크의 acceptance가 검증 가능한 기준인지 확인하세요
   - "잘 동작해야 함" 같은 모호한 기준은 구체적 기준으로 재해석하세요
   - acceptance가 비어있는 태스크는 spec에서 기준을 도출하세요

7. **리뷰 리포트 출력**

   ```
   ## 플랜 리뷰

   ### 플랜: {title}
   - 실행 대상: {N}개 (todo: {N}, in_progress: {N}) / 전체: {N}개
   - 실행 순서: {재배치된 순서 또는 "원래 순서 유지"}

   ### 스펙 품질: [GOOD | WARN | POOR]
   {발견된 이슈가 있으면 나열}

   ### 의존성: [OK | 재배치 필요]
   {변경 사항이 있으면 나열}

   ### Acceptance Criteria
   - 명확: {N}개 / 보완 필요: {N}개 / 부재: {N}개
   ```

   **자동 모드 (기본)**: 리뷰 리포트를 표시한 후 **자동으로 "실행 시작"** 진행. 리포트에 POOR 등급이 있으면 경고 후 진행. 사용자는 Ctrl+C로 중단 가능.

   **interactive 모드**: `AskUserQuestion`으로 선택받으세요:
   - "실행 시작": 리뷰 결과를 반영하여 실행 진행
   - "스펙 수정 후 실행": `/vs-review`로 이동하여 스펙 보완 후 재시작
   - "취소": 실행 중단

### Phase 3: 순차 실행

8. **태스크 루프**
   실행 대상 태스크를 순서대로 처리합니다. 각 태스크마다:

   **a. 태스크 시작**
   - 태스크 제목, spec, acceptance를 출력하세요
   - Bash 도구로 `vs task update <task_id> in_progress --json` 명령을 실행하세요. 상태 변경

   **컨텍스트 정리 (4번째 태스크부터)**: 4개 이상의 태스크를 실행한 경우, 각 태스크 시작 전에 다음을 수행하세요:
   - 이전 태스크들의 상세 구현 내용(코드 diff, 디버깅 과정 등)을 1~2줄 요약으로 축소하세요. 예: "T1: auth 미들웨어 구현 완료 (PASS), T2: user API CRUD 구현 (WARN - lint 경고)"
   - 플랜의 spec을 `vs plan show <plan_id> --json`로 다시 로드하세요
   - 현재 태스크의 spec과 acceptance criteria만 상세하게 유지하세요
   - 이렇게 하면 컨텍스트 윈도우를 절약하고 이전 태스크의 구현 세부사항에 의한 간섭을 줄일 수 있습니다

   **b. 크로스 플랜 겹침 확인** (태스크에 `allowed_files`가 있는 경우만)
   - 다른 활성 플랜의 태스크와 `allowed_files` 겹침 확인
   - 겹침 발견 시 경고만 표시, 진행은 차단하지 않음
   - `allowed_files` 미설정 시 스킵

   **c. 구현**
   - 태스크 spec과 acceptance criteria를 기반으로 직접 구현하세요
   - 컨텍스트가 누적되므로 이전 구현의 실수가 전파되지 않도록 각 태스크 시작 시 spec을 다시 읽으세요

   **TDD 적합성 참고** (vs-exec는 항상 직접 구현이지만, 참고 정보로 판별 결과를 기록):
   - vs-next의 TDD 자동 판별 테이블(Step 7)과 동일한 기준으로 각 태스크의 TDD 적합성을 판별하세요
   - 종합 리포트(Phase 4)에 `판별: TDD/직접` 컬럼을 포함하세요
   - TDD 적합 태스크가 다수이면 종합 리포트에 "TDD가 적합한 태스크가 {N}개 있습니다. `/vs-next` 배치 모드 사용을 검토하세요." 안내를 추가

   **c. 검증 (기본 모드: verifier 에이전트 디스패치)**

   구현 완료 후 독립적인 검증을 위해 **verifier 에이전트를 디스패치**합니다:

   1. **verifier 에이전트 디스패치**
      - Agent 도구를 사용하여 verifier 에이전트를 `run_in_background: false`로 디스패치하세요
      - 전달 정보:
        - task: 태스크 제목, spec, acceptance criteria
        - plan_context: 플랜 제목, 스펙 요약
        - impl_report: 구현 과정 요약 (변경 파일, 핵심 변경 내용)
        - scope: allowed_files, forbidden_patterns (있는 경우)
      - verifier는 독립 컨텍스트에서 테스트/빌드/lint 실행, AC 크로스체크, scope 검증을 수행하고 PASS/WARN/FAIL 판정을 반환합니다

      **QA Shadow 병렬 디스패치** (선택적):
      - 조건: `modules.shadow`가 `true` → qa-shadow 에이전트를 verifier와 병렬 디스패치
      - shadow 결과에 따른 done/has-concerns/ALERT 처리
      - **상세 절차: completion-checks SKILL.md "1. QA Shadow 병렬 디스패치" 참조**

   2. **Adaptive Planner Watcher** (선택적):
      - 조건: `modules.adaptive_planner`가 `true` → 6개 트리거 감지 후 plan-advisor 디스패치 제안
      - **상세 절차 및 6개 트리거 테이블: completion-checks SKILL.md "4. Adaptive Planner Watcher" 참조**

   3. **판정 처리**
      - **PASS**: 다음 단계(e)로 진행
      - **WARN**: 다음 단계(e)로 진행 (concerns 기록)
      - **FAIL**: debugger 에이전트 자동 재시도 (아래 참조)

   4. **FAIL 시 자동 재시도 (debugger 에이전트)**
      - FAIL 판정 시 debugger 에이전트를 디스패치하세요
      - 전달 정보: 태스크(title, spec, acceptance), 플랜 컨텍스트, verifier FAIL 리포트
      - debugger가 수정 완료 후 verifier를 다시 디스패치하여 재검증
      - **최대 2회 재시도**: 3번째 FAIL 시 태스크를 `blocked`로 변경하고 사용자에게 보고
      - 재시도 횟수를 종합 리포트에 기록하세요

   > **참고**: 독립적인 코드 품질 리뷰가 필요하면 커밋 전 `/simplify-loop`을 활용하거나 PR 리뷰를 활용하세요.

   > **스코프 규칙 우선순위**: freeze(훅, 물리적 차단) > allowed_files(DB, WARN) > Modification Plan(에이전트 자율). 상세: verifier 에이전트 문서 참조.

   **d. 검증 (인라인 모드: `--inline` 플래그 사용 시)**

   사용자가 vs-exec 호출 시 인라인 모드를 명시적으로 요청한 경우에만 이 모드를 사용합니다.
   서브에이전트 없이 직접 검증을 수행합니다.

   > **품질 게이트 경고**: 인라인 모드에서는 다음 검증이 생략됩니다:
   > - Phase 3 (코드 품질 검사) — 기존 패턴 준수, 범위 이탈, 보안 점검 없음
   > - Phase 3.5 (Self-Challenge) — Error KB 대조, Rules 대조, 역방향 검증 없음
   > - QA Shadow — 경량 병렬 QA 없음
   > - Debugger 자동 재시도 — FAIL 시 1회 수동 수정만 시도
   >
   > 복잡한 태스크나 높은 품질이 요구되는 경우 기본 모드(verifier 에이전트) 또는 `/vs-next`를 사용하세요.

   - **테스트 실행**: 프로젝트의 테스트 명령 실행 (package.json의 test 스크립트, 또는 pytest, cargo test 등)
   - **빌드 확인**: 빌드 스크립트가 있으면 실행
   - **Lint 확인**: lint 스크립트가 있으면 실행
   - **Acceptance 크로스체크**: 각 acceptance 항목에 대해 코드 변경분에서 충족 증거를 확인
   - **Scope Verification** (태스크에 allowed_files/forbidden_patterns가 있는 경우):
     - `git diff --name-only`로 변경 파일 수집
     - 각 파일을 allowed_files/forbidden_patterns와 대조 (`*.test.*`, `*.spec.*` 파일은 자동 예외)
     - 범위 밖 변경 시 WARN 보고 (FAIL 아님)
     - scope 미지정 시 이 단계를 건너뛰세요
   - **셀프 코드 리뷰**: `git diff`로 보안 취약점, 버그, spec 불일치를 점검 (편향 주의)

   판정 기준 (인라인 모드):
   ```
   PASS = 기술 검증 통과 AND acceptance 전항목 충족 AND scope PASS/SKIP
   WARN = 기술 검증 통과 AND (acceptance에 미확인 항목 존재 OR scope WARN)
   FAIL = 기술 검증 실패 OR acceptance 미충족 항목 존재
   ```

   FAIL 시: 1회 자동 수정 시도 → 재검증 → 여전히 FAIL이면 blocked 처리

   **e. 태스크 완료 처리**
   - PASS: Bash 도구로 `vs task update <task_id> done --json` 명령을 실행하세요 — 다음 태스크로 진행
   - WARN: 간략히 사용자에게 알리고 Bash 도구로 `vs task update <task_id> done --json --has-concerns` 명령을 실행하세요. 기록 후 계속 진행 (최종 리포트에서 모아서 보고)
   - FAIL (blocked): Bash 도구로 `vs task update <task_id> blocked --json` 명령을 실행하고 사용자에게 보고

   **f. 백로그 매칭** (PASS/WARN 후, Phase 4 직전에 1회만)
   - 변경 파일과 open 백로그를 매칭하여 관련 항목 제안
   - **상세 절차: completion-checks SKILL.md "5. 백로그 매칭" 참조**

   **g. 중간 커밋**
   - 중간 커밋이 필요하면 `/vs-commit` 제안

   **h. 마일스톤 QA 자동 트리거** (3개 태스크마다 체크)
   - auto_trigger 설정 기반, 50%/100% 마일스톤 도달 시 QA 제안
   - **상세 절차: vs-next SKILL.md "마일스톤 QA 자동 트리거" 참조**

   **h. 마일스톤 QA 자동 트리거** (3개 태스크마다 또는 진행 저장 시점에 체크)
   1. `vs --json qa config resolve <plan_id>`로 auto_trigger 설정을 조회하세요
   2. `auto_trigger.enabled`가 `false`이면 스킵
   3. 플랜 진행률 계산: `done / (total - skipped) * 100`
   4. `auto_trigger.milestones`와 비교하여 처음 도달한 마일스톤 확인
   5. `qa_overrides.dismissed_milestones`에 있거나 이미 QA Run이 있으면 스킵
   6. 마일스톤 도달 시 `AskUserQuestion`으로 QA 제안:
      - question: "플랜 진행률이 {N}%에 도달했습니다. QA를 실행하시겠습니까?"
      - header: "QA 자동 트리거"
      - 선택지 (100% 시): "QA 실행 (강력 권장)" / "나중에"
      - 선택지 (중간 마일스톤): "QA 실행" / "나중에"
   7. "QA 실행" → `vs --json qa run create <plan_id> --trigger auto` 후 `/vs-qa` 안내
   8. "나중에" → `dismissed_milestones`에 기록

9. **실패 시 의존 태스크 처리**
   - 태스크가 blocked되면 해당 태스크에 의존하는 후속 태스크를 skipped로 변경하세요
   - 사용자에게 알리고 계속 진행 가능한 독립 태스크가 있으면 이어서 실행하세요

### Phase 4: 종합 리포트

10. **전체 테스트 실행**
    - 모든 태스크 처리 후 전체 테스트 스위트를 실행하세요
    - 개별 태스크에서 통과했더라도 통합 시 깨질 수 있습니다

11. **종합 리포트 출력**

    ```
    ## 플랜 실행 완료

    ### 플랜: {title}

    ### 태스크 결과
    | # | 태스크 | 결과 | 비고 |
    |---|--------|------|------|
    | 1 | {제목} | PASS | — |
    | 2 | {제목} | WARN | {concern 요약} |
    | 3 | {제목} | BLOCKED | {사유} |
    | 4 | {제목} | SKIPPED | T3 의존 |

    ### 통계
    - PASS: {N} / WARN: {N} / BLOCKED: {N} / SKIPPED: {N}
    - 전체 테스트: {passed}/{total}
    - 빌드: [PASS | FAIL]

    ### WARN 항목 (주의 필요)
    - T2: {concern 상세}

    ### BLOCKED 항목 (해결 필요)
    - T3: {차단 사유 및 제안}

    ### 품질 참고
    이 실행은 서브에이전트 없이 단일 세션에서 수행되었습니다.
    독립적 코드 리뷰가 포함되지 않았으므로, 중요 변경사항은
    PR 리뷰를 통해 추가 검증을 권장합니다.
    ```

    **자동 모드 (기본)**: 1줄 안내만 표시 — `"✓ 실행 완료. /vs-commit로 커밋하거나 BLOCKED 항목을 먼저 해결하세요."` (질문 없음)

    **interactive 모드**: `AskUserQuestion`으로 다음 단계를 선택받으세요:
    - "커밋": `/vs-commit`으로 변경사항 정리
    - "추가 리뷰": WARN/BLOCKED 항목 수동 해결
    - "대시보드": `/vs-dashboard`로 전체 현황 확인

## Rules

- **검증 에이전트 사용**: 기본 모드에서는 verifier 에이전트를 디스패치하여 독립 검증을 수행합니다. `--inline` 모드에서는 검증도 직접 수행합니다.
- **리뷰 먼저**: Phase 2를 건너뛰지 마세요. 플랜을 비판 없이 실행하면 잘못된 스펙의 오류가 전체로 전파됩니다.
- **컨텍스트 오염 인식**: 태스크가 진행될수록 컨텍스트가 쌓입니다. 각 태스크 시작 시 spec을 다시 읽어서 이전 실수를 반복하지 마세요.
- **멈추지 않는 실행**: WARN은 기록하고 계속 진행하세요. FAIL만 사용자 개입을 요청하세요. 매번 멈추면 배치 실행의 가치가 사라집니다.
- **정직한 품질 표시**: 종합 리포트에서 셀프 리뷰의 한계를 언급하세요. 사용자가 추가 리뷰 필요 여부를 판단할 수 있어야 합니다.

## 다음 단계

- → `/vs-commit`으로 변경사항 논리 단위 커밋
- → `/vs-dashboard`로 진행률 확인
- → BLOCKED 태스크 수동 해결 후 `/vs-next` 또는 재실행
