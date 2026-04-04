---
name: vs-plan-close
description: "[QA] Run closing verification bundle for a completed plan."
invocation: user
argument-hint: "[--plan <id>] [--skip-acceptance] [--skip-design]"
---

# Plan Close (플랜 종결 검증 번들)

플랜의 모든 태스크가 완료된 후, 3단계 검증(plan-verify → design-review → acceptance)을 순차 실행하여 플랜을 최종 종결합니다.

## When to Use

**사용하세요:**
- 플랜의 모든 태스크가 done/skipped 상태일 때 최종 게이트로
- 릴리즈·머지 직전에 플랜 수준 품질을 일괄 확인하고 싶을 때
- 개별 스킬을 따로따로 기억하지 않고 한 번에 돌리고 싶을 때

**사용하지 마세요:**
- 개별 태스크 검증 → `verification` 스킬
- 결함 탐색 → `/vs-qa`
- in_progress/todo 태스크가 남아있을 때 (Stage 1에서 FAIL 처리)

## Input

- **`--plan <id>`** (선택): 대상 플랜 ID. 생략 시 활성 플랜 자동 탐색
- **`--skip-acceptance`** (선택): acceptance 단계 강제 스킵
- **`--skip-design`** (선택): design-review 단계 강제 스킵

## Steps

### Step 1: 플랜 선택 및 사전 점검

1. `$ARGUMENTS`를 파싱하여 `--plan`, `--skip-acceptance`, `--skip-design` 플래그를 추출하세요
2. plan_id가 없으면 Bash 도구로 `vs --json plan list --status active` 실행 → 여러 개면 사용자에게 선택 요청
3. Bash 도구로 `vs --json plan show <plan_id>` 실행하여 태스크 상태를 집계하세요
4. **조기 종료 조건** — 아래 중 하나에 해당하면 **즉시 중단**하고 안내:
   - in_progress/todo 태스크 1개 이상 존재 → "아직 미완료 태스크가 있습니다. `/vs-next`로 완료 후 재시도하세요."
   - 태스크가 0개 → "태스크가 없습니다."

### Step 2: 조건부 단계 판정 (자동)

다음 기준으로 각 단계 실행 여부를 판정하세요:

**Design Review 조건** (기본 실행, `--skip-design`이면 스킵):
- `docs/DESIGN.md` 존재 여부 확인
- 플랜의 변경 파일에 UI 확장자(`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`)가 포함되는지 확인
- 둘 다 true → **실행**, 아니면 **스킵**

**Acceptance 조건** (기본 실행, `--skip-acceptance`이면 스킵):
- 플랜의 done 태스크 중 acceptance 필드가 비어있지 않은 태스크가 1개 이상 존재 → **실행**, 아니면 **스킵**

### Step 3: 단계별 순차 실행

각 단계는 이전 단계가 PASS/WARN인 경우에만 실행합니다. **FAIL 시 후속 단계는 실행하지 않습니다.**

#### Stage A: Plan Verify (필수, 항상 실행)

1. Skill 도구로 `vs-plan-verify` 스킬을 호출하세요 (args: `--plan <id>`)
2. 결과 verdict를 수집하세요: `PASS` / `WARN` / `FAIL`
3. FAIL이면 → Step 4의 부분 리포트로 직행

#### Stage B: Design Review (조건부)

Stage A가 PASS/WARN이고 Design 조건이 충족된 경우에만 실행.

1. Skill 도구로 `vs-design-review` 스킬을 호출하세요
2. 결과 verdict를 수집하세요
3. FAIL이면 → Step 4의 부분 리포트로 직행

스킵 조건이면 `verdict: SKIPPED, reason: "..."`로 기록만 하고 다음 단계로 진행하세요.

#### Stage C: Acceptance (조건부)

Stage A(와 B 실행 시)가 PASS/WARN이고 Acceptance 조건이 충족된 경우에만 실행.

1. Skill 도구로 `vs-acceptance` 스킬을 호출하세요 (args: `<plan_id>`)
2. 결과 verdict를 수집하세요

스킵 조건이면 `verdict: SKIPPED, reason: "..."`로 기록만 하세요.

### Step 4: 통합 리포트

3단계 결과를 아래 형식으로 출력하세요:

```
## Plan Close 통합 리포트

**플랜**: {plan_title} (`{plan_id}`)
**상태**: {OVERALL_VERDICT}

| 단계 | Verdict | 요약 |
|------|---------|------|
| Plan Verify | PASS/WARN/FAIL | {1줄 요약} |
| Design Review | PASS/WARN/FAIL/SKIPPED | {1줄 요약 또는 스킵 사유} |
| Acceptance | PASS/WARN/FAIL/SKIPPED | {1줄 요약 또는 스킵 사유} |

### 종합 판정
- 총 단계: 3
- PASS: {N} / WARN: {N} / FAIL: {N} / SKIPPED: {N}

### 다음 단계
{verdict별 안내}
```

**OVERALL_VERDICT 결정 규칙**:
- 1개 이상 FAIL → `FAIL`
- FAIL 없음 + 1개 이상 WARN → `WARN`
- 모든 실행 단계가 PASS (SKIPPED는 무시) → `PASS`
- 모든 단계가 SKIPPED → `SKIPPED`

**FAIL 시 부분 리포트**: FAIL 발생 이후 단계는 "실행 중단"으로 표시하고, 실행된 단계까지의 결과만 표시하세요.

### Step 5: 후속 조치 안내

- **PASS**: "플랜을 완료 처리할 수 있습니다. `vs plan complete <plan_id>` 또는 `/vs-commit`으로 커밋 정리를 진행하세요."
- **WARN**: "경미한 이슈가 있습니다. 리포트를 확인하고 `--has-concerns`로 완료하거나 수정 후 재실행하세요."
- **FAIL**: "수정이 필요합니다. 실패한 단계의 리포트를 확인하고 이슈 해결 후 `/vs-plan-close`를 재실행하세요."

## Rules

- 각 단계 스킬의 출력을 그대로 수집하고 임의로 재해석하지 마세요
- Stage A가 FAIL이면 반드시 Stage B/C를 실행하지 말 것 (시간 낭비 방지)
- SKIPPED는 OVERALL_VERDICT 판정에서 중립 (PASS도 FAIL도 아님)
- 이 스킬은 태스크/플랜 상태를 직접 변경하지 않습니다 (리포트만 생성)

## 다음 단계

- → `/vs-commit`으로 변경사항 커밋
- → `vs plan complete <plan_id>`로 플랜 완료 처리
- → `/vs-dashboard`로 전체 현황 확인
- → FAIL 시 이슈 수정 후 재실행
