---
name: vs-plan-verify
description: Use when verifying that a completed plan's implementation is correct. Aggregates task status, runs regression tests, and checks plan-level success criteria before marking the plan as complete.
invocation: user
---

# Plan Verification

플랜의 모든 태스크 완료 후, 전체 구현의 완성도를 검증합니다.
개별 태스크 검증(`verification`)이 "나무"를 본다면, 이 스킬은 "숲"을 봅니다.

## When to Use

**사용하세요:**
- 플랜의 모든 태스크가 done/skipped 상태일 때
- `vs plan complete <plan_id> --json` Bash 도구로 실행 전 최종 게이트로
- `vs-dashboard`에서 "completable" 알림이 뜬 플랜에 대해

**사용하지 마세요:**
- 개별 태스크 검증 → `verification` 스킬 사용
- 아직 in_progress/todo 태스크가 남아있을 때 (Step 1에서 FAIL 처리됨)

## Input

- **plan_id** (선택): 검증할 플랜 ID. 미지정 시 자동 탐색

## Steps

1. **플랜 상태 조회**
   - plan_id가 없으면 `vs plan list --json --status active` → `vs plan list --json --status approved` 순으로 Bash 도구로 실행하여 탐색하세요
   - 복수 플랜이면 사용자에게 선택을 요청하세요
   - `vs plan show <plan_id> --json`을 Bash 도구로 실행하여 플랜 + 태스크 트리를 조회하세요
   - 태스크 상태별 집계: done / skipped / blocked / in_progress / todo

   **조기 종료 조건:**
   - in_progress 또는 todo 태스크가 1개 이상 → **FAIL** (리포트 Step 5로 직행)
   - 태스크가 0개 → **WARN** ("태스크가 없습니다")
   - 모든 태스크가 skipped → **WARN** ("모든 태스크가 건너뛰어졌습니다")

2. **회귀 테스트 실행**
   프로젝트 전체에 대해 기술 검증을 실행하세요:

   **a. 테스트:**
   - `package.json`의 test 스크립트를 확인하세요
   - 있으면 `npm test`를 실행하세요
   - 없으면 `SKIP` 처리하세요
   - 결과: exit code, 통과/실패 테스트 수
   - **부분 실패 판정**: 실패한 테스트가 있을 경우 git blame/log로 해당 테스트의 추가 시점을 확인하세요
     - 이번 플랜에서 **새로 추가된 테스트만** 실패 → `WARN` (신규 테스트 불안정)
     - **기존 테스트**가 실패 → `FAIL` (회귀 발생)

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

3. **Success Criteria 검증**
   - 플랜 스펙에서 `## Success Criteria` 섹션을 파싱하세요
   - 섹션이 없으면 이 단계를 건너뛰세요
   - 각 기준에 대해:
     - 프로젝트 코드, 테스트 결과, git log를 근거로 충족 여부를 판정하세요
     - **정량적 기준** (응답시간, 커버리지 등): 측정 가능하면 실제 값을 확인 → `PASS` / `FAIL`
     - **정성적 기준** (코드 품질, UX 등): 코드 변경분으로 판단 가능하면 → `PASS` / `WARN`
     - 판단 근거를 찾을 수 없음 → `WARN`
     - 명백히 미충족 → `FAIL`

4. **주의 태스크 집계**
   - `has_concerns: true`로 완료된 태스크 목록을 수집하세요 (metrics 필드 확인)
   - 각 concern의 **severity를 분류**하세요:
     - **critical**: 보안 취약점, 데이터 손실 가능성, 핵심 기능 미동작 → FAIL 요소로 취급
     - **minor**: 코드 스타일, 경미한 성능 이슈, 개선 권고사항 → WARN 요소로 취급
   - concern 내용(description)에서 severity를 판단하되, 명시되지 않은 경우 minor로 간주하세요
   - skipped 태스크와 사유를 수집하세요
   - blocked 태스크가 있으면 사유를 수집하세요

5. **최종 판정**

   ```
   PASS = 미완료 태스크 없음 AND 회귀 테스트 전체 통과(또는 SKIP) AND success criteria 전항목 PASS AND critical concerns 없음
   WARN = 미완료 태스크 없음 AND 회귀 테스트 통과(또는 신규 테스트만 실패) AND (success criteria에 WARN 존재 OR minor concerns 존재 OR skipped 태스크 존재)
   FAIL = 미완료 태스크 존재 OR 기존 테스트 실패(회귀) OR success criteria에 FAIL 존재 OR critical concerns 존재
   ```

6. **리포트 출력**
   반드시 다음 형식으로 출력하세요:

   ```
   ## 플랜 검증 리포트

   ### Verdict: [PASS | WARN | FAIL]

   ### 플랜 현황
   - 플랜: {title} (#{plan_id})
   - 전체 태스크: N개
   - 완료: N | 건너뜀: N | 차단: N | 진행중: N | 대기: N

   ### 회귀 테스트
   - 테스트: [PASS (N/N passed) | FAIL (N/N passed) | SKIP]
   - 빌드: [PASS | FAIL | SKIP]
   - Lint: [PASS | FAIL | SKIP]

   ### Success Criteria 검증
   | # | 기준 | 판정 | 근거 |
   |---|------|------|------|
   | 1 | {criteria} | [PASS|WARN|FAIL] | {근거} |

   ### 주의 사항
   - critical concerns: [{task_id}: {title} — {내용}] (없으면 "없음")
   - minor concerns: [{task_id}: {title} — {내용}] (없으면 "없음")
   - skipped 태스크: [{task_id}: {title} — {사유}] (없으면 "없음")

   ### 요약
   - Success Criteria 충족: N/M
   - 미확인: N/M
   - 미충족: N/M
   ```

7. **판정별 후속 처리**

   **PASS:**
   → **체크포인트**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - "플랜 검증이 통과했습니다. 어떻게 진행할까요?"
   - 선택지:
     - "플랜 완료" → `vs plan complete <plan_id> --json`을 Bash 도구로 실행
     - "머지 진행" → `/vs-merge` 안내
     - "유지" → 아무 작업 안 함

   **WARN:**
   → 리포트를 사용자에게 보여주세요
   → **체크포인트**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - "검증에 주의 사항이 있습니다. 어떻게 진행할까요?"
   - 선택지:
     - "플랜 완료" → `vs plan complete <plan_id> --json`을 Bash 도구로 실행
     - "주의 사항 해결 후 재검증" → 해당 태스크/항목 안내
     - "유지" → 아무 작업 안 함

   **FAIL:**
   → 리포트를 사용자에게 보여주세요
   → **체크포인트**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - "검증 실패 항목이 있습니다. 어떻게 진행할까요?"
   - 선택지:
     - "실패 항목 수정" → 실패 원인별 가이드 제공
     - "강제 완료" → 아래 **강제 완료 절차**를 따름
     - "유지" → 아무 작업 안 함

   **강제 완료 절차** (FAIL 상태에서 "강제 완료" 선택 시):
   1. 명시적 위험 경고를 출력하세요:
      ```
      ⚠️ 경고: 다음 검증 실패 항목이 해결되지 않은 상태로 플랜을 완료합니다.
      - {실패 항목 1}
      - {실패 항목 2}
      이로 인해 회귀 버그, 프로덕션 장애 등의 위험이 발생할 수 있습니다.
      ```
   2. `AskUserQuestion`으로 강제 완료 사유를 반드시 입력받으세요:
      - "강제 완료 사유를 입력해 주세요 (예: '해당 테스트는 다음 스프린트에서 수정 예정')"
   3. 사유를 플랜 완료 시 기록하세요:
      ```bash
      vs plan complete <plan_id> --json --note "강제 완료: {사용자 입력 사유}"
      ```

## Rules

- 회귀 테스트(테스트/빌드/lint)는 반드시 실행하세요 — LLM 판단으로 대체하지 마세요
- Success Criteria 검증에서 확신이 없으면 `PASS`가 아닌 `WARN`으로 판정하세요
- FAIL 판정이더라도 사용자의 override("강제 완료")를 허용하세요
- 이 스킬은 `verification`(태스크 단위)과 다릅니다 — 개별 태스크의 acceptance criteria는 재검증하지 않습니다
- `vs plan complete <plan_id> --json`은 사용자 승인 후에만 Bash 도구로 실행하세요

## 다음 단계

- → `/vs-merge`로 워크트리 머지 진행
- → `/vs-release`로 릴리즈 준비
- → `/vs-dashboard`로 전체 현황 재확인
