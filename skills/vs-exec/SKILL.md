---
name: vs-exec
description: Use when the user wants to execute ALL tasks in a plan at once without subagent dispatch — run the entire plan end-to-end in the current session. This is the go-to skill when the user says "플랜 실행", "전체 실행", "쭉 돌려", "전부 구현", "끝까지 실행", "execute plan", "run all tasks", or any variation of "implement everything". Also use when the user is in a cowork/non-subagent environment and wants to process multiple tasks sequentially, or when they explicitly say "서브에이전트 없이", "에이전트 안 쓰고", "이 세션에서 전부", "한번에 끝내고 싶어". If the user wants to run just ONE task, use vs-next instead. If they want to PICK a specific task, use vs-pick. But if they want batch/full/all execution in a single session, this is the right skill.
invocation: user
---

# vs-exec

서브에이전트 없이 플랜의 전체 태스크를 현재 세션에서 순차 실행합니다.

vs-next/vs-pick은 태스크마다 tdd-implementer, verifier 에이전트를 디스패치하여 높은 품질을 보장합니다. 이 스킬은 서브에이전트를 사용하지 않으므로 컨텍스트 격리나 독립 리뷰의 이점이 없지만, 단일 세션에서 플랜을 빠르게 소화할 수 있습니다.

### vs-next와의 차이

| 항목 | vs-next (서브에이전트) | vs-exec (단일 세션) |
|------|----------------------|---------------------|
| 컨텍스트 격리 | 태스크별 fresh 컨텍스트 | 누적 (오염 가능) |
| 구현 | tdd-implementer 에이전트 | 직접 구현 |
| 검증 | verifier 에이전트 | verifier 에이전트 (인라인 모드 가능) |
| 병렬성 | 최대 3개 동시 실행 | 순차 실행 |
| 인라인 모드 | 없음 | `--inline`으로 서브에이전트 없이 검증 |
| 적합 상황 | 복잡한 플랜, 높은 품질 요구 | 소규모 플랜, 빠른 실행 우선 |

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

2. **활성 플랜 확인**
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

   **체크포인트**: `AskUserQuestion`으로 선택받으세요:
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

   **b. 구현**
   - 태스크 spec과 acceptance criteria를 기반으로 직접 구현하세요
   - 컨텍스트가 누적되므로 이전 구현의 실수가 전파되지 않도록 각 태스크 시작 시 spec을 다시 읽으세요

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

   2. **판정 처리**
      - **PASS**: 다음 단계(e)로 진행
      - **WARN**: 다음 단계(e)로 진행 (concerns 기록)
      - **FAIL**: debugger 에이전트 자동 재시도 (아래 참조)

   3. **FAIL 시 자동 재시도 (debugger 에이전트)**
      - FAIL 판정 시 debugger 에이전트를 디스패치하세요
      - 전달 정보: 태스크(title, spec, acceptance), 플랜 컨텍스트, verifier FAIL 리포트
      - debugger가 수정 완료 후 verifier를 다시 디스패치하여 재검증
      - **최대 2회 재시도**: 3번째 FAIL 시 태스크를 `blocked`로 변경하고 사용자에게 보고
      - 재시도 횟수를 종합 리포트에 기록하세요

   > **참고**: 독립적인 코드 품질 리뷰가 필요하면 커밋 전 `/simplify-loop`을 활용하거나 PR 리뷰를 활용하세요.

   **d. 검증 (인라인 모드: `--inline` 플래그 사용 시)**

   사용자가 vs-exec 호출 시 인라인 모드를 명시적으로 요청한 경우에만 이 모드를 사용합니다.
   서브에이전트 없이 직접 검증을 수행합니다:

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

   **f. 진행 저장**
   - 3개 태스크마다 또는 FAIL 발생 시 Bash 도구로 `vs context save --json --summary "..."` 명령을 실행하세요. 진행 상황 저장
   - 플랜 크기 가이드에 따라 중간 커밋이 필요한 시점이면 사용자에게 `/vs-commit` 제안

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

    **체크포인트**: `AskUserQuestion`으로 다음 단계를 선택받으세요:
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
