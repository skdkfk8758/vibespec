# SDD 스펙 예시: 플랜 아카이브 기능

---
artifact: sdd-spec
version: "1.0"
created: 2026-03-10
status: approved
---

## Overview

완료된 플랜을 아카이브하여 활성 대시보드에서 숨기는 기능. VibeSpec CLI 및 MCP 사용자를 위해, 완료된 플랜이 쌓여 대시보드가 혼잡해지는 문제를 해결한다. 아카이브된 플랜은 삭제되지 않으며 언제든 조회 가능하다.

## Requirements

### 기능 요구사항

**MUST** — 반드시 구현
- [ ] 완료 상태 플랜을 아카이브할 수 있다: `vp_plan_archive` 호출 시 status가 archived로 변경
- [ ] 대시보드에서 아카이브된 플랜이 제외된다: `vp_dashboard` 결과에 archived 플랜 미포함
- [ ] 아카이브된 플랜을 조회할 수 있다: `vp_plan_list --status=archived`로 필터링

**SHOULD** — 구현하면 좋음
- [ ] CLI에서 `vp plan archive <id>` 명령어 지원

**COULD** — 시간이 되면 추가
- [ ] 아카이브 해제(unarchive) 기능

### 비기능 요구사항

| 항목 | 기준 | 측정 방법 |
|------|------|-----------|
| 성능 | 아카이브 처리 < 50ms | 단위 테스트 내 실행 시간 |
| 데이터 무결성 | 아카이브 시 태스크 데이터 보존 | 아카이브 후 task 조회 테스트 |

## Data Model

### 엔티티 변경

**Plan** — 기존 엔티티에 status 값 추가

| 필드 | 타입 | 변경 | 설명 |
|------|------|------|------|
| status | PlanStatus | enum에 'archived' 추가 | draft → active → completed → archived |

### DB 스키마 변경

```sql
-- 변경 없음: status는 TEXT 컬럼이므로 enum 값만 애플리케이션 레벨에서 추가
-- CHECK 제약이 있다면 수정 필요:
-- ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_status_check;
-- ALTER TABLE plans ADD CONSTRAINT plans_status_check
--   CHECK (status IN ('draft', 'active', 'completed', 'archived'));
```

## API / Interface Design

### vp_plan_archive

```typescript
function archivePlan(planId: string): Plan
```

**파라미터:**

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| planId | string | Y | 아카이브할 플랜 ID |

**에러 케이스:**

| 조건 | 처리 | 반환 |
|------|------|------|
| 플랜이 존재하지 않음 | 에러 반환 | `Plan not found: {id}` |
| 플랜이 completed가 아님 | 에러 반환 | `Only completed plans can be archived` |

**입출력 예시:**

```typescript
// Input
archivePlan("abc123def456")

// Output — 성공
{ id: "abc123def456", title: "플랜 아카이브 기능", status: "archived", ... }

// Output — 실패 (미완료 플랜)
Error: "Only completed plans can be archived"
```

### vp_dashboard 변경

```typescript
// 기존: plans WHERE status IN ('draft', 'active', 'completed')
// 변경: plans WHERE status IN ('draft', 'active', 'completed')  -- archived 제외 (이미 제외됨)
// 확인: plan_progress 뷰가 archived를 자연스럽게 제외하는지 검증
```

### vp_plan_list 변경

```typescript
// 기존: status 필터 지원
// 변경: status=archived 필터 값 추가 지원
listPlans({ status: "archived" })  // → archived 플랜만 반환
```

## Task Breakdown

| # | 태스크 | Spec | Acceptance Criteria | Size |
|---|--------|------|---------------------|------|
| 1 | PlanStatus에 archived 추가 | `src/core/types.ts`의 PlanStatus union에 'archived' 추가. schema.ts의 CHECK 제약이 있다면 수정. | `'archived'`가 유효한 PlanStatus 값이다 | S |
| 2 | archivePlan 엔진 함수 구현 | `src/core/engine/lifecycle.ts`에 `archivePlan(planId)` 추가. completed → archived 전환만 허용. 이벤트 기록. | completed 플랜 아카이브 성공, 비-completed 플랜 시 에러, 이벤트 기록 확인 | M |
| 3 | MCP 도구 등록 | `src/mcp/server.ts`에 `vp_plan_archive` 도구 추가. archivePlan 호출 및 결과 반환. | MCP 호출로 아카이브 동작 확인 | S |
| 4 | 대시보드 필터 검증 | `src/core/engine/dashboard.ts`의 getOverview가 archived를 제외하는지 확인. 필요시 수정. | 아카이브된 플랜이 대시보드에 나타나지 않음 | S |

- 의존성 순서: 1 → 2 → 3, 4 (3과 4는 병렬 가능)
- 각 태스크 15~30분 크기

## Edge Cases

| # | 케이스 | 발생 조건 | 처리 방법 |
|---|--------|-----------|-----------|
| 1 | 이미 아카이브된 플랜 재아카이브 | archived 상태에서 archive 호출 | 에러: "Plan is already archived" |
| 2 | active 플랜 아카이브 시도 | completed가 아닌 플랜 | 에러: "Only completed plans can be archived" |
| 3 | 아카이브된 플랜의 태스크 수정 | task_update 호출 시 | 허용 (태스크는 독립적으로 관리) |

## Testing Strategy

### 테스트 케이스

| # | 테스트 | 검증 대상 | 타입 |
|---|--------|-----------|------|
| 1 | test_archivePlan_completedPlan_statusChangesToArchived | completed → archived 전환 | unit |
| 2 | test_archivePlan_activePlan_throwsError | 비-completed 플랜 거부 | unit |
| 3 | test_archivePlan_alreadyArchived_throwsError | 중복 아카이브 방지 | unit |
| 4 | test_dashboard_excludesArchivedPlans | 대시보드 필터링 | integration |
| 5 | test_planList_filterByArchived_returnsOnlyArchived | status 필터 | integration |

### 테스트 데이터

- completed 상태 플랜 1개 (태스크 3개 포함)
- active 상태 플랜 1개
- archived 상태 플랜 1개 (대시보드 제외 검증용)

## Success Criteria

### 정량적

| 지표 | 기준 | 현재값 | 목표값 |
|------|------|--------|--------|
| 테스트 커버리지 | archivePlan 관련 | 0% | 100% |
| 기존 테스트 | 회귀 없음 | all pass | all pass |

### 정성적

- 기존 lifecycle 함수(completePlan, canComplete)와 일관된 에러 처리 패턴
- 아카이브 후에도 플랜/태스크 데이터가 완전히 보존됨
