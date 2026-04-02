---
name: completion-checks
description: "[Ref] 태스크 완료 시 공통 후처리 — QA Shadow, Adaptive Planner, 백로그 매칭. vs-next, vs-exec가 참조합니다."
invocation: auto
type: domain
---

# Completion Checks

태스크 구현 완료 후 실행하는 공통 후처리 절차. QA Shadow 병렬 디스패치, Adaptive Planner Watcher, 백로그 매칭 로직을 단일 소스로 관리한다.

## Domain Context

태스크 완료 시점에는 verifier 외에도 여러 보조 에이전트와 자동화가 병렬로 실행된다. 이 로직은 vs-next와 vs-exec에서 공통으로 사용되므로, 변경 시 단일 소스를 수정하면 양쪽에 반영된다.

**사전 조건**: verifier 디스패치 시점에 `resolved_config` (= `vs --json qa config resolve <plan_id>` 결과)가 캐싱되어 있어야 한다.

---

## 1. QA Shadow 병렬 디스패치

verifier 디스패치와 동시에, qa-shadow 에이전트도 병렬로 디스패치한다.

### 조건 평가

- **조건 1**: `resolved_config`의 `modules.shadow` 설정 확인
  - `modules.shadow`가 `false`이면 → 스킵
  - `modules.shadow`가 `true`이면 → 조건 2로 진행
  - `modules.shadow`가 object이면 → `enabled`가 false이면 스킵, true이면 조건 2로 진행

- **조건 2 (Conditional Activation 평가)**:
  - `modules.shadow`가 object이고 `skip_when`이 정의되어 있으면:
    - `skip_when.task_tags`: 현재 태스크의 title/spec에서 추출된 태그와 매칭. 매칭되면 → 스킵 + "QA Shadow 스킵: task_tags 조건 매칭 ({매칭된 태그})" 메시지 표시
    - `skip_when.changed_files_only`: 변경된 파일이 모두 이 패턴에 매칭되면 → 스킵 + "QA Shadow 스킵: 변경 파일이 모두 {패턴}에 해당" 메시지 표시
  - `modules.shadow`가 object이고 `activate_when`이 정의되어 있으면:
    - `activate_when.completed_tasks_gte`: 완료된 태스크 수가 이 값 미만이면 → 스킵
    - `activate_when.changed_files_pattern`: 변경 파일 중 이 패턴에 매칭되는 파일이 없으면 → 스킵
  - **우선순위**: `enabled: false`가 최우선. skip_when과 activate_when이 동시 충족 시 skip_when 우선 (보수적 접근)
  - 조건 평가 결과를 로그로 남기세요: "QA Shadow 조건 평가: {결과} — {사유}"

### 시나리오 수집

위 조건을 모두 통과하면 디스패치 진행:
- Bash 도구로 `vs --json qa scenario list-by-plan <plan_id> --source seed --task-id <task_id>` 실행하여 이 태스크 관련 seed 시나리오를 조회

### 디스패치

Agent 도구로 qa-shadow 디스패치 (run_in_background: true, model: haiku):
```
당신은 qa-shadow 에이전트입니다.
agents/qa-shadow.md의 Execution Process를 따라 실행하세요.

task: {title, spec, acceptance}
impl_report_path: .claude/handoff/{task_id}/impl_report.json
seed_scenarios: {위에서 조회한 시나리오 JSON 배열 — 빈 배열이면 그대로 전달}
```

### 결과 통합

- verifier PASS + shadow CLEAN → `vs --json task update <id> done`
- verifier PASS + shadow WARNING → `vs --json task update <id> done --has-concerns` + shadow 결과 표시
- verifier PASS + shadow ALERT → 사용자에게 AskUserQuestion:
  - "QA Shadow가 ALERT를 발생시켰습니다: {요약}. 어떻게 처리할까요?"
  - 선택지: "무시하고 완료" / "수정 후 재검증" / "태스크 차단"
- shadow 결과를 DB에 기록: `vs --json task update <id> --shadow-result <clean|warning|alert>`
  (CLI에서 shadow-result 옵션이 지원되지 않으면 이 기록을 건너뛰세요)

---

## 2. Design Review Light 병렬 디스패치

verifier/qa-shadow와 동시에, design-review-light 에이전트도 병렬로 디스패치한다.

### 조건 (모두 충족 시)

1. `resolved_config`의 `modules.design_review`가 `true`
2. 프로젝트 루트에 DESIGN.md가 존재
3. 변경 파일 중 UI 파일(`.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`, `.html`)이 1개 이상

조건 미충족 시 이 단계를 건너뛰세요.

### 변경 파일 수집

impl_report.json의 `changed_files`에서 UI 파일을 필터링하거나, `git diff --name-only HEAD~1`에서 추출

### 디스패치

Agent 도구로 design-review-light 디스패치 (run_in_background: true, model: haiku):
```
당신은 design-review-light 에이전트입니다.
agents/design-review-light.md의 Execution Process를 따라 실행하세요.

task: {title, spec, acceptance}
changed_files: {UI 파일 목록}
design_md_path: DESIGN.md
```

### 결과 통합

- design SKIP → 판정에 영향 없음 (무시)
- design CLEAN → 판정에 영향 없음
- design WARNING → `done --has-concerns`에 디자인 이슈 포함 + 리포트 표시
- design ALERT → 사용자에게 AskUserQuestion:
  - "Design Review에서 Critical 이슈가 발견되었습니다: {요약}. 어떻게 처리할까요?"
  - 선택지: "수정 후 재검증" / "무시하고 완료" / "전체 감사 실행 (/vs-design-review)"
- design 결과를 DB에 기록: `vs --json task update <id> --design-result <skip|clean|warning|alert>`
  (CLI에서 design-result 옵션이 지원되지 않으면 이 기록을 건너뛰세요)

---

## 3. Skeleton Guard impl-check 병렬 디스패치

verifier/qa-shadow/design-review-light와 동시에, skeleton-guard impl-check도 병렬 디스패치한다.

### 조건 (모두 충족 시)

1. `resolved_config`의 `modules.skeleton_guard`가 `true`
2. 프로젝트 루트에 POLICY.md가 존재

조건 미충족 시 이 단계를 건너뛰세요.

### 준비

존재하는 골격 문서(POLICY.md 필수, 나머지는 있으면 포함)를 Read로 읽기

### 디스패치

Agent 도구로 skeleton-guard 디스패치 (run_in_background: true, model: haiku):
```
당신은 skeleton-guard 에이전트입니다.
agents/skeleton-guard.md의 Execution Process — impl-check 모드를 따라 실행하세요.

mode: impl-check
task: {title, spec, acceptance}
changed_files: {변경 파일 목록}
skeleton_docs: {읽은 골격 문서 내용}
dismissed_warnings: {세션 내 억제된 경고 목록}
```

### 결과 통합

- SKIP → 판정에 영향 없음
- PASS → 판정에 영향 없음
- WARNING → `done --has-concerns`에 골격 이슈 포함 + 리포트 표시
  - 각 WARNING에 대해 "이 경고를 이번 세션에서 억제할까요?" 선택 제공 (alert fatigue 방지)
  - 억제 선택 시 dismissed_warnings 세션 목록에 추가
- ALERT → 사용자에게 AskUserQuestion:
  - "Skeleton Guard에서 Critical 이슈가 발견되었습니다: {요약}. 어떻게 처리할까요?"
  - 선택지: "수정 후 재검증" / "무시하고 완료" / "태스크 차단"

### 경량 Skeleton Evolve (Auto only)

skeleton-guard 결과 통합 후, Auto tier 변경만 경량 실행한다.

- 조건: `resolved_config.modules.skeleton_guard`가 `true` AND 골격 문서 1개+ AND skeleton-guard verdict가 ALERT가 아닌 경우
- 조건 미충족 시 스킵
- skeleton-evolve의 **Phase 1(구현 분석) + Phase 3 Auto 분류만** 실행 (Suggest/Locked/충돌 감지 스킵)
- Locked 문서(Vision, Tech Stack, Security Policy 섹션)는 수정 대상에서 제외
- Auto 변경 적용 후 completeness_score 재계산:
  - 점수 하락 → .bak에서 자동 롤백 + "Auto 적용이 점수를 하락시켜 롤백되었습니다" 경고
  - 점수 유지/상승 → 적용 확정 + "경량 evolve: Auto {N}건 적용" 표시
- 5초 이내 완료 목표
- **전체 evolve(Suggest/Locked/충돌)는 플랜 완료 감지 시에만 실행** (기존 로직 유지)

---

## 4. Adaptive Planner Watcher

태스크 완료 판정 후, 플랜 수준의 이상을 감지한다.

### 조건

`resolved_config`의 `modules.adaptive_planner`가 `true`

조건 미충족 시 이 단계를 건너뛰세요.

### 경량 감지 (DB 쿼리 2회)

1. 현재 태스크 결과 조회: `vs --json handoff read <task_id>` (verifier verdict + shadow result)
2. 플랜 누적 이상 카운트: `vs --json plan show <plan_id>` (blocked_tasks 수 + tasks의 shadow_result='alert' 수)

### 6개 트리거 감지 규칙

| 트리거 | 감지 조건 | 근거 |
|--------|----------|------|
| `assumption_violation` | verifier WARN 리포트에 "스펙 가정", "assumption", "전제" 키워드 포함 OR shadow verdict = ALERT AND category = 'spec_gap' | 스펙이 가정한 것이 실제와 다름 |
| `scope_explosion` | impl_report의 변경 파일 수가 allowed_files 수의 2배 이상 | 태스크 범위가 예상보다 큼 |
| `design_flaw` | shadow verdict = ALERT AND category = 'design_flaw' | QA shadow가 설계 결함 감지 |
| `shadow_critical_bug` | shadow verdict = ALERT AND category = 'bug' | QA shadow가 심각한 버그 감지 — 플랜 수준의 설계 재검토 필요 |
| `complexity_exceeded` | acceptance criteria 8개 이상 OR 변경 줄 수 200줄 이상 | 태스크가 15-30분 원칙 위반 |
| `dependency_shift` | 현재 태스크 완료 후 depends_on 체인의 다른 태스크가 blocked 상태 | 의존성 구조 변경 필요 |

### 트리거 감지 시 처리

1. 사용자에게 알림:
   ```
   ⚠️ Adaptive Planner 트리거 감지: {trigger_type}
   원인: {감지 근거 1문장}
   영향: {영향받는 태스크 수}개 태스크
   ```
2. plan-advisor 디스패치 제안 (AskUserQuestion):
   - "플랜 수정이 필요할 수 있습니다. plan-advisor를 실행할까요?"
   - 선택지: "advisor 실행" / "무시하고 계속" / "수동 처리"
3. "advisor 실행" 선택 시:
   Agent 도구로 plan-advisor 디스패치:
   ```
   당신은 plan-advisor 에이전트입니다. agents/plan-advisor.md를 따르세요.
   plan_id: {id}
   trigger_type: {type}
   trigger_source: {task_id}
   ```
   advisor 결과의 수정안을 사용자에게 표시하고 승인 받기
4. 승인 시: `vs plan revision create` + 태스크 업데이트 실행

---

## 5. 백로그 매칭

태스크 done 처리 후, 변경 파일과 관련된 백로그 항목이 있는지 확인한다.

### 절차

1. `git diff --name-only HEAD~1`로 변경 파일 목록을 수집
2. `vs --json backlog list --status open`으로 open 백로그를 조회
3. 각 백로그 항목의 title/description/tags에 변경 파일명 또는 디렉토리명이 포함되면 매칭으로 판단
4. 매칭된 항목이 있으면 `AskUserQuestion`으로 제안:
   - question: "관련 백로그 항목이 발견되었습니다: '{title}'. 같이 처리하시겠습니까?"
   - header: "백로그 매칭"
   - 선택지:
     - label: "같이 처리", description: "이 백로그 항목을 지금 바로 실행합니다"
     - label: "나중에", description: "백로그에 남겨두고 다음 태스크로 진행합니다"
     - label: "무시", description: "관련 없는 항목으로 판단합니다"
   - "같이 처리" 선택 시: 해당 백로그 항목의 내용을 기반으로 즉시 작업 수행 후 `vs --json backlog update <id> --status done`
5. 매칭 항목이 없으면 이 단계를 조용히 건너뛰세요

---

## 검증 리포트 형식

최종적으로 아래 형식으로 검증 리포트를 출력한다:

```
## 검증 리포트

### 최종 판정: [PASS | WARN | FAIL]

### Verification (기술 검증)
[verification 리포트 요약 — verdict, 테스트/빌드/lint 결과, acceptance 충족률]

### Scope Verification (범위 검증)
[scope 리포트 요약 — verdict, 범위 내/외 파일 수, 위반 상세]
(scope 미지정인 경우: "Scope 규칙 미지정 — SKIP")

### QA Shadow (shadow 실행 시)
[shadow verdict: CLEAN/WARNING/ALERT — findings 요약]
(shadow 미실행 시: "Shadow 비활성화 — SKIP")

### Design Review (design review 실행 시)
[design verdict: SKIP/CLEAN/WARNING/ALERT — findings 요약, 토큰 준수율]
(design review 미실행 시: "Design Review 비활성화 — SKIP")

### Skeleton Guard (skeleton-guard 실행 시)
[skeleton verdict: SKIP/PASS/WARNING/ALERT — findings 요약, 억제된 경고 수]
(skeleton-guard 미실행 시: "Skeleton Guard 비활성화 — SKIP")
```
