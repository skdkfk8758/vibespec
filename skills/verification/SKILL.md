---
name: verification
description: [QA] Use when verifying task completion as an internal quality gate.
invocation: reference
---

# Task Verification (Internal Gate)

태스크 완료 시점에서 acceptance criteria 충족 여부, 테스트, 빌드, lint를 검증하고 구조화된 리포트를 생성합니다.

> **Note:** 이 스킬은 vs-next/vs-exec의 내부 검증 게이트로 설계되었습니다. 대부분의 경우 verifier 에이전트가 이 로직을 자동으로 실행합니다. 수동 호출도 가능하지만, 일반적으로는 vs-next/vs-exec을 사용하세요.
>
> **5개 QA 도구 비교**: `docs/QA_SKILLS_MATRIX.md` 참조 (verification vs verifier vs qa-shadow vs vs-code-review vs simplify-loop).

## When to Use

**주요 호출자 (자동):**
- verifier 에이전트 — 독립 컨텍스트에서 이 스킬의 검증 로직을 실행
- vs-next — 완료 처리 단계에서 verifier 에이전트를 통해 간접 호출
- vs-pick — 완료 처리 단계에서 verification 스킬을 직접 호출 (verifier 에이전트를 경유하지 않음)
- vs-exec — 기본 모드에서 verifier 에이전트를 통해, --inline 모드에서 직접 실행

**수동 호출 (비권장):**
- 수동으로 구현 완료 검증이 필요할 때 직접 호출 가능하지만, vs-next/vs-exec 사용을 권장합니다

**사용하지 마세요:**
- 중간 저장(WIP 커밋) 시점
- 태스크 시작 전 검증

## Input

호출 시 다음 정보가 컨텍스트에 존재해야 합니다:
- **task**: 태스크 제목, spec, acceptance criteria (`vs task show <task_id> --json`으로 조회)
- **impl_report**: tdd-implementer 리포트 (있는 경우, 없으면 생략)
- **scope** (선택): 태스크의 allowed_files, forbidden_patterns (있는 경우)

## Steps

1. **Acceptance Criteria 파싱**
   - 태스크의 acceptance 필드를 개별 항목으로 분리하세요
   - 각 항목에 번호를 매기세요
   - acceptance가 비어있으면 이 단계를 건너뛰고 Step 2로 직행하세요

2. **기술 검증 실행**
   다음 명령을 순서대로 실행하고 결과를 수집하세요:

   **a. 테스트:**
   - `package.json`의 test 스크립트를 확인하세요
   - 있으면 `npm test`를 실행하세요
   - 없으면 `SKIP` 처리하세요
   - 결과: exit code, 통과/실패 테스트 수

   **b. 빌드:**
   - `package.json`의 build 스크립트를 확인하세요
   - 있으면 `npm run build`를 실행하세요
   - 없으면 `SKIP` 처리하세요
   - 결과: exit code

   **c. Lint:**
   - `package.json`의 lint 스크립트를 확인하세요
   - 있으면 `npm run lint`를 실행하세요
   - 없으면 `SKIP` 처리하세요
   - 결과: exit code

   **tdd-implementer 리포트가 있는 경우:**
   - 리포트의 테스트 결과를 신뢰하되, 테스트는 **반드시 재실행**하세요 (리팩토링 후 깨질 수 있음)
   - 빌드/lint는 리포트에 포함되지 않으므로 항상 실행하세요

3. **Scope Verification** (scope 정보가 있는 경우에만)
   태스크의 allowed_files, forbidden_patterns가 있으면 이 단계를 실행하세요. 둘 다 비어있으면 **SKIP**하세요.

   **a. 변경 파일 수집:**
   - `git diff --name-only` (태스크 시작 이후 변경분)로 변경된 파일 목록을 수집하세요

   **b. Scope 규칙 대조:**
   각 변경 파일에 대해:
   - `*.test.*`, `*.spec.*`, `__tests__/` 패턴에 매칭되는 파일은 **자동 예외** (TDD 허용)
   - allowed_files가 있으면: 파일이 허용 목록 glob에 매칭 안 되면 → **out_of_scope**
   - forbidden_patterns가 있으면: 파일이 금지 패턴에 매칭되면 → **forbidden_violation**

   **c. Scope 판정:**
   - 위반 없음 → scope verdict: **PASS**
   - 위반 있음 → scope verdict: **WARN** (단독으로 FAIL 아님)

4. **Acceptance Criteria 크로스체크**
   각 acceptance 항목에 대해:
   - `git diff HEAD~1` (또는 태스크 시작 이후 변경분)을 확인하세요
   - 해당 항목을 충족하는 **증거**를 찾으세요:
     - 관련 테스트가 존재하고 통과함 → `PASS`
     - 코드 변경이 항목의 요구사항을 구현함 → `PASS`
     - 관련 코드/테스트를 찾을 수 없음 → `WARN`
     - 코드가 명백히 요구사항과 다름 → `FAIL`
   - 각 항목의 판정과 근거를 기록하세요

4. **최종 판정**

   ```
   PASS = 기술 검증 전체 통과(또는 SKIP) AND acceptance 전항목 PASS AND scope PASS/SKIP
   WARN = 기술 검증 전체 통과(또는 SKIP) AND (acceptance에 WARN 항목 존재 OR scope WARN) (FAIL 없음)
   FAIL = 기술 검증 실패 OR acceptance에 FAIL 항목 존재
   ```

   Note: scope WARN은 단독으로 FAIL을 발생시키지 않습니다.

5. **리포트 출력**
   반드시 다음 형식으로 출력하세요:

   ```
   ## 검증 리포트

   ### Verdict: [PASS | WARN | FAIL]

   ### 기술 검증
   - 테스트: [PASS (N/N passed) | FAIL (N/N passed) | SKIP]
   - 빌드: [PASS | FAIL | SKIP]
   - Lint: [PASS | FAIL | SKIP]

   ### Acceptance Criteria 검증
   | # | 기준 | 판정 | 근거 |
   |---|------|------|------|
   | 1 | {criteria 내용} | [PASS|WARN|FAIL] | {근거} |
   | 2 | ... | ... | ... |

   ### Scope Verification
   - 변경 파일: N개
   - 범위 내: N개
   - 범위 외: N개 [파일 목록]
   - 금지 위반: N개 [파일 목록 + 위반 규칙]
   - 판정: [PASS | WARN | SKIP]
   (scope 정보가 없는 경우: "Scope 규칙 미지정 — SKIP")

   ### 변경 파일 요약
   | 파일 | +/- | 사유 |
   |------|-----|------|
   | src/a.ts | +10/-3 | AC #1 관련 |

   ### 요약
   - 충족: N/M
   - 미확인: N/M
   - 미충족: N/M
   ```

6. **판정별 후속 처리**

   **PASS:**
   → 태스크를 `done`으로 변경할 수 있습니다

   **WARN:**
   → 리포트를 사용자에게 보여주세요
   → **체크포인트**: `AskUserQuestion`으로 선택을 받으세요:
   ```
   [1] 완료 처리 → has_concerns: true로 done
   [2] 추가 구현 → 미확인 항목 구현 후 재검증
   [3] 건너뛰기
   선택 (1/2/3):
   ```
   → 사용자가 "완료 처리"를 선택하면 `has_concerns: true`로 metrics 기록 후 `done` 처리

   **FAIL:**
   → 리포트를 사용자에게 보여주세요
   → **체크포인트**: `AskUserQuestion`으로 선택을 받으세요:
   ```
   [1] 수정 후 재검증 → 실패 항목 수정 후 Step 1부터 재실행
   [2] 강제 완료 → has_concerns: true로 done
   [3] 건너뛰기
   선택 (1/2/3):
   ```
   → "강제 완료" 선택 시 `has_concerns: true`로 metrics 기록 후 `done` 처리
   → "수정 후 재검증" 선택 시 수정 작업 후 Step 1부터 재실행

## Rules

- 기술 검증(테스트/빌드/lint)은 반드시 실행하세요 — LLM 판단으로 대체하지 마세요
- acceptance criteria 크로스체크에서 확신이 없으면 `PASS`가 아닌 `WARN`으로 판정하세요
- FAIL 판정이더라도 사용자의 override를 허용하세요 (블로킹하지 않음)
- 이 스킬은 태스크 상태를 직접 변경하지 않습니다 — 판정 결과를 호출자(vs-next/vs-pick)에게 반환하세요
