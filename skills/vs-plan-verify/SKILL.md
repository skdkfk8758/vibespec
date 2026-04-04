---
name: vs-plan-verify
description: "[QA] Verify completed plan with regression tests."
invocation: user
argument-hint: "[<plan_id>] [--interactive]"
---

# Plan Verification

## Step 0: 모드 판정

`$ARGUMENTS`에 `--interactive` 플래그가 있는지 확인하세요:
- **interactive 모드**: PASS/WARN 후속 체크포인트가 활성화됩니다
- **자동 모드 (기본)**: PASS 시 "안내만 표시" (질문 없음), WARN 시에도 안내 + 다음 단계 제안만

**안전장치 예외** (모드 무관):
- FAIL 시 "실패 항목 수정/강제 완료/유지" 선택 — 항상 질문
- 강제 완료 사유 입력 — 항상 질문
- 다중 활성 플랜 선택 — 항상 질문

플랜의 모든 태스크 완료 후, 전체 구현의 완성도를 검증합니다.
개별 태스크 검증(`verification`)이 "나무"를 본다면, 이 스킬은 "숲"을 봅니다.

## When to Use

**사용하세요:**
- 플랜의 모든 태스크가 done/skipped 상태일 때
- `vs plan complete <plan_id> --json` Bash 도구로 실행 전 최종 게이트로
- `vs-dashboard`에서 "completable" 알림이 뜬 플랜에 대해

**사용하지 마세요:**
- 시나리오 기반 결함 탐지 → `vs-qa` 사용 (결함 발견 도구)
- 개별 태스크 검증 → `verification` 스킬 사용
- 아직 in_progress/todo 태스크가 남아있을 때 (Step 1에서 FAIL 처리됨)

> **vs-qa와의 차이:** `vs-qa`는 시나리오 기반으로 결함을 **발견**하는 도구이고, `vs-plan-verify`는 플랜 완료를 **판정**하는 게이트입니다. 일반적으로 `vs-qa` → `vs-plan-verify` 순서로 실행합니다.

**vs-qa vs vs-plan-verify 비교:**

| 관점 | vs-qa | vs-plan-verify |
|------|-------|----------------|
| 목적 | 결함 발견 및 이슈 수집 | 플랜 완료 최종 게이트 |
| 시점 | 구현 중/후 언제든 | 모든 태스크 완료 후 |
| 방법 | QA 에이전트 팀 위임 | 직접 npm test/build/lint 실행 |
| 결과 | QA findings + 수정 플랜 | Pass/Fail 판정 |
| 트리거 | 수동 (`/vs-qa`) | 수동 (`/vs-plan-verify`) 또는 vs-dashboard 알림 |

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
   **vs-qa 실행 이력 확인:**
   - `vs --json qa run list --plan <plan_id>`를 Bash 도구로 실행하여 최근 QA Run을 확인하세요
   - 최근 `completed` QA Run이 있으면:
     - QA Run 완료 시점 이후 코드 변경이 있는지 `git log --since="{qa_completed_at}" --oneline`으로 확인
     - 변경 없음 → "이미 vs-qa로 검증을 거쳤습니다. 회귀 테스트는 코드 변경분만 확인합니다" 안내
     - 변경 있음 → "vs-qa 이후 코드가 변경되었으므로 전체 회귀 테스트가 필요합니다" 안내
   - QA Run이 없으면 안내 없이 기존 로직 진행

   프로젝트 전체에 대해 기술 검증을 실행하세요:

   ### 공통 npm 유효성 검증

   아래 3가지 npm 스크립트를 순차 실행합니다. 각 스크립트는 **3-step 구조**(check → execute → report)를 따릅니다:

   | 단계 | 스크립트 | 실행 명령 | SKIP 조건 |
   |------|----------|-----------|-----------|
   | a. 테스트 | `test` | `npm test` | package.json에 test 스크립트 없음 |
   | b. 빌드 | `build` | `npm run build` | package.json에 build 스크립트 없음 |
   | c. Lint | `lint` | `npm run lint` | package.json에 lint 스크립트 없음 |

   **각 스크립트별 절차:**
   1. **Check**: `package.json`의 scripts에서 해당 키 존재 여부를 확인. 없으면 `SKIP` 처리
   2. **Execute**: 해당 npm 명령을 실행
   3. **Report**: exit code를 기록. 테스트의 경우 통과/실패 테스트 수도 포함

   **테스트 부분 실패 판정**: 실패한 테스트가 있을 경우 git blame/log로 해당 테스트의 추가 시점을 확인하세요
   - 이번 플랜에서 **새로 추가된 테스트만** 실패 → `WARN` (신규 테스트 불안정)
   - **기존 테스트**가 실패 → `FAIL` (회귀 발생)

2a. **골격 정합성 최종 게이트** (선택적)
   - 조건: 프로젝트 루트에 골격 문서(PRD.md/DESIGN.md/POLICY.md/ARCHITECTURE.md) 1개 이상 존재
   - 조건 미충족 시 이 단계를 SKIP 처리하세요
   - skeleton-evolve 에이전트를 디스패치하세요 (model: haiku):
     ```
     당신은 skeleton-evolve 에이전트입니다.
     agents/skeleton-evolve.md의 Execution Process를 따라 실행하세요.

     plan_id: {plan_id}
     plan_spec: {플랜 스펙}
     task_results: {태스크 결과 목록}
     changed_files: {플랜 전체 변경 파일}
     skeleton_docs: {골격 문서 내용}
     ```
   - 결과 처리 (10초 이내 판정):
     - Auto 변경이 있으면: 자동 적용 (게이트 통과 상태이므로)
     - Suggest/Locked 변경이 있으면: WARN 요소로 추가
     - cross-reference 충돌이 있으면: 충돌 심각도에 따라 WARN 또는 FAIL
     - 변경/충돌 없으면: PASS
   - 리포트에 추가:
     ```
     ### 골격 정합성
     - Auto 적용: N건
     - Suggest 대기: N건 (승인 필요)
     - Locked 대기: N건 (사유 필요)
     - 충돌: N건
     - 판정: [PASS | WARN | FAIL | SKIP]
     ```
   - WARN/FAIL 시: "골격 문서 업데이트가 필요합니다. 플랜 완료 전 `/vs-skeleton-status`를 확인하세요." 안내

3. **Success Criteria 검증**
   - 플랜 스펙에서 `## Success Criteria` 섹션을 파싱하세요
   - 섹션이 없으면 이 단계를 건너뛰세요
   - 각 기준에 대해:
     - **정량적 기준 실측** — 기준에 측정 가능한 수치가 포함된 경우 (테스트 수, 파일 줄 수, grep 결과 건수, CLI 명령 동작 등):
       1. 기준에서 검증 명령을 도출하세요 (예: "테스트 전체 통과" → `npx vitest run`, "as any 0건" → `grep -rn 'as any' src/`, "index.ts 150줄 이하" → `wc -l src/cli/index.ts`)
       2. Bash 도구로 해당 명령을 실행하세요
       3. 실제 측정값과 기준값을 비교하여 `PASS` / `FAIL` 판정
       4. 리포트에 **실제 값**을 근거로 표시하세요 (예: "실측: 63줄 ≤ 150줄 → PASS")
       5. 명령 실행 실패 시 → `WARN` ("측정 실패: {에러 메시지}")으로 폴백
     - **정성적 기준** (코드 품질, UX 등): 코드 변경분으로 판단 가능하면 → `PASS` / `WARN`
     - 판단 근거를 찾을 수 없음 → `WARN`
     - 명백히 미충족 → `FAIL`

4. **QA Findings 검증**
   - `vs --json qa run list --plan <plan_id>`를 Bash 도구로 실행하여 QA Run 목록을 조회하세요
   - **QA Run이 없는 경우**: 이 단계를 `SKIP` 처리하세요 (리포트에 "QA 미실행 — SKIP" 표시)
   - **QA Run이 있는 경우**: 가장 최근 `completed` 상태의 Run을 선택하세요
     1. `vs --json qa finding list --run <run_id> --status open`으로 미해결 이슈를 조회하세요
     2. severity별 집계: critical / high / medium / low
     3. 판정:
        - critical findings **1건 이상** → `FAIL` 요소
        - high findings **3건 이상** → `WARN` 요소
        - medium/low만 → 리포트에 참고로 표시, 판정에 영향 없음
        - 미해결 이슈 0건 → `PASS`
   - 리포트에 **QA Findings** 섹션을 추가하세요:
     ```
     ### QA Findings
     - QA Run: #{run_id} ({날짜}) — {status}
     - 미해결 이슈: critical: {N} | high: {N} | medium: {N} | low: {N}
     - 판정: [PASS | WARN | FAIL | SKIP]
     ```

5. **주의 태스크 집계**
   - `has_concerns: true`로 완료된 태스크 목록을 수집하세요 (metrics 필드 확인)
   - 각 concern의 **severity를 분류**하세요:
     - **critical**: 보안 취약점, 데이터 손실 가능성, 핵심 기능 미동작 → FAIL 요소로 취급
     - **minor**: 코드 스타일, 경미한 성능 이슈, 개선 권고사항 → WARN 요소로 취급
   - concern 내용(description)에서 severity를 판단하되, 명시되지 않은 경우 minor로 간주하세요
   - skipped 태스크와 사유를 수집하세요
   - blocked 태스크가 있으면 사유를 수집하세요

5. **최종 판정**

   ```
   PASS = 미완료 태스크 없음 AND 회귀 테스트 전체 통과(또는 SKIP) AND success criteria 전항목 PASS AND critical concerns 없음 AND QA critical findings 없음
   WARN = 미완료 태스크 없음 AND 회귀 테스트 통과(또는 신규 테스트만 실패) AND (success criteria에 WARN 존재 OR minor concerns 존재 OR skipped 태스크 존재 OR QA high findings 3건+)
   FAIL = 미완료 태스크 존재 OR 기존 테스트 실패(회귀) OR success criteria에 FAIL 존재 OR critical concerns 존재 OR QA critical findings 1건+
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

   ### QA Findings
   - QA Run: #{run_id} ({날짜}) — {status} (없으면 "QA 미실행 — SKIP")
   - 미해결 이슈: critical: {N} | high: {N} | medium: {N} | low: {N}
   - 판정: [PASS | WARN | FAIL | SKIP]

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

   **자동 모드 (기본)**: 1줄 안내만 표시 — `"✓ PASS. vs plan complete <plan_id>로 완료 처리하거나 /vs-merge로 머지하세요."` (질문 없음)

   **interactive 모드**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
   - "플랜 검증이 통과했습니다. 어떻게 진행할까요?"
   - 선택지:
     - "플랜 완료" → `vs plan complete <plan_id> --json`을 Bash 도구로 실행
     - "머지 진행" → `/vs-merge` 안내
     - "유지" → 아무 작업 안 함

   **WARN:**
   → 리포트를 사용자에게 보여주세요

   **자동 모드 (기본)**: 1줄 안내 표시 — `"⚠ WARN {N}건. 세부는 리포트 참조. 주의사항 수용 시 vs plan complete --has-concerns 사용."` (질문 없음)

   **interactive 모드**: `AskUserQuestion`으로 다음 선택지를 제시하세요:
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
