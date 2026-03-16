# VibePlanner Plugin - Task Plan

## Overview
SDD 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 플러그인.
OpenViking의 3-Tier Context Loading 철학을 SQLite + MCP로 경량 구현.

## Task Overview

| # | Task | Size | Dependencies |
|---|------|------|-------------|
| 1 | 프로젝트 스캐폴딩 | S | none |
| 2 | DB 커넥션 + 스키마 + 공유 타입 | S | 1 |
| 3 | Plan 모델 CRUD | M | 2 |
| 4 | Task 모델 CRUD + 트리 | M | 2 |
| 5 | Event 기록 시스템 | S | 2 |
| 6 | Plan/Task 모델에 이벤트 통합 | S | 3, 4, 5 |
| 7 | Context Log 모델 | S | 2 |
| 8 | plan_progress SQL View + 대시보드 | S | 3, 4 |
| 9 | Lifecycle 엔진 (완료 판정) | M | 6, 8 |
| 10 | Smart Alerts 엔진 | M | 5, 8 |
| 11 | Stats 엔진 (velocity, 예상완료) | M | 5, 8 |
| 12 | MCP Server 셋업 + vp_dashboard | M | 7, 8, 10 |
| 13 | MCP Plan Tools | M | 9, 12 |
| 14 | MCP Task Tools | M | 6, 12 |
| 15 | MCP Context + Stats Tools | M | 7, 11, 12 |
| 16 | CLI 셋업 + dashboard 커맨드 | M | 8, 10 |
| 17 | CLI Plan 커맨드 | M | 9, 16 |
| 18 | CLI Task + Stats 커맨드 | M | 6, 11, 16 |
| 19 | 빌드 설정 + 패키징 | S | 12, 16 |
| 20 | Marketplace 설정 | S | 19 |

---

## Detailed Tasks

### Task 1: 프로젝트 스캐폴딩
- **Estimate**: 3분
- **Complexity**: 🟢 Routine
- **Risk**: 🟢 Safe
- **Files**: `package.json`, `tsconfig.json`, `tsup.config.ts`, `.gitignore`
- **Changes**:
  - `package.json`: name=vibeplanner, dependencies (better-sqlite3, @modelcontextprotocol/sdk, commander, nanoid), devDependencies (typescript, tsup, vitest, @types/better-sqlite3)
  - `tsconfig.json`: strict mode, ESM, outDir=dist, paths alias
  - `tsup.config.ts`: 두 entrypoint (mcp/server.ts, cli/index.ts)
  - `.gitignore`: node_modules, dist, *.db
- **TDD Steps**:
  1. Write failing test: `src/core/__tests__/smoke.test.ts` — `import { version } from '../../package.json'` → expect version to be string
  2. Implement: package.json + tsconfig 생성
  3. Refactor: none
- **Verify**: `npm install && npx vitest run --reporter=verbose` → 1 test passed
- **Dependencies**: none

---

### Task 2: DB 커넥션 + 스키마 + 공유 타입
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/core/db/connection.ts`, `src/core/db/schema.ts`, `src/core/types.ts`, `src/core/db/__tests__/schema.test.ts`
- **Changes**:
  - `connection.ts`: `getDb(dbPath?: string)` 함수 — better-sqlite3 인스턴스 반환, WAL mode, foreign_keys ON. 기본 경로는 `process.cwd() + '/vibeplanner.db'`
  - `schema.ts`: `initSchema(db)` 함수 — plans, tasks, events, context_log 테이블 + plan_progress 뷰 생성. `CREATE TABLE IF NOT EXISTS` 사용
    - plan_progress 뷰 컬럼: `id, title, status, total_tasks, done_tasks, active_tasks, blocked_tasks, progress_pct`
    - `progress_pct = ROUND(SUM(CASE WHEN t.status='done' THEN 1.0 ELSE 0 END) / MAX(COUNT(t.id),1) * 100)`
  - `types.ts`: 모든 모델에서 공유하는 타입 정의
    - Plan, Task, Event, ContextLog, PlanProgress, Alert, SmartAlerts 타입
    - PlanStatus = 'draft' | 'active' | 'completed' | 'archived'
    - TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked' | 'skipped'
- **TDD Steps**:
  1. Write failing test: `initSchema(db)` 호출 후 `db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()` → plans, tasks, events, context_log 포함 확인. plan_progress 뷰 존재 확인
  2. Implement: connection.ts에 getDb (in-memory ':memory:' 지원), schema.ts에 CREATE TABLE 문들, types.ts에 타입 정의
  3. Refactor: none
- **Verify**: `npx vitest run src/core/db/__tests__/schema.test.ts` → all pass
- **Dependencies**: Task 1

---

### Task 3: Plan 모델 CRUD
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/core/models/plan.ts`, `src/core/models/__tests__/plan.test.ts`
- **Changes**:
  - `plan.ts`: PlanModel class with methods:
    - `create(title, spec?, summary?)` → Plan (id는 nanoid)
    - `getById(id)` → Plan | null
    - `list(filter?: {status})` → Plan[]
    - `update(id, fields)` → Plan
    - `activate(id)` → Plan (status draft→active)
    - `complete(id)` → Plan (status active→completed, completed_at 기록)
    - `archive(id)` → Plan (status completed→archived)
  - Plan 타입: `{ id, title, status, summary, spec, created_at, completed_at }`
- **TDD Steps**:
  1. Write failing test: create → getById → 동일 데이터 확인, list로 필터링, status 전이 (draft→active→completed→archived)
  2. Implement: prepared statements로 CRUD
  3. Refactor: 타입 분리 (types.ts에 공유 타입 이동 필요 시)
- **Verify**: `npx vitest run src/core/models/__tests__/plan.test.ts` → all pass
- **Dependencies**: Task 2

---

### Task 4: Task 모델 CRUD + 트리
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟡 Caution — 트리 구조 쿼리 (재귀 CTE)
- **Files**: `src/core/models/task.ts`, `src/core/models/__tests__/task.test.ts`
- **Changes**:
  - `task.ts`: TaskModel class with methods:
    - `create(planId, title, opts?: {parentId, spec, acceptance, sortOrder})` → Task (depth 자동 계산)
    - `getById(id)` → Task | null
    - `getTree(planId)` → nested Task[] (재귀 CTE로 트리 빌드)
    - `getChildren(parentId)` → Task[]
    - `update(id, fields)` → Task
    - `updateStatus(id, status)` → Task (완료 시 completed_at 기록)
    - `getByPlan(planId, filter?: {status})` → Task[]
  - Task 타입: `{ id, plan_id, parent_id, title, status, depth, sort_order, spec, acceptance, created_at, completed_at }`
- **TDD Steps**:
  1. Write failing test: plan 생성 → root task 2개 + child task 생성 → getTree로 중첩 구조 확인, depth 자동 계산 검증
  2. Implement: CREATE + 재귀 CTE SELECT, depth = parent.depth + 1
  3. Refactor: none
- **Verify**: `npx vitest run src/core/models/__tests__/task.test.ts` → all pass
- **Dependencies**: Task 2

---

### Task 5: Event 기록 시스템
- **Estimate**: 4분
- **Complexity**: 🟢 Routine
- **Risk**: 🟢 Safe
- **Files**: `src/core/models/event.ts`, `src/core/models/__tests__/event.test.ts`
- **Changes**:
  - `event.ts`: EventModel class with methods:
    - `record(entityType, entityId, eventType, oldValue?, newValue?, sessionId?)` → Event
    - `getByEntity(entityType, entityId)` → Event[] (시간순)
    - `getBySession(sessionId)` → Event[]
    - `getRecent(limit?)` → Event[]
  - Event 타입: `{ id, entity_type, entity_id, event_type, old_value, new_value, session_id, created_at }`
  - old_value/new_value는 JSON string으로 저장
- **TDD Steps**:
  1. Write failing test: record 3개 이벤트 → getByEntity로 조회 → 시간순 정렬 확인
  2. Implement: prepared statements
  3. Refactor: none
- **Verify**: `npx vitest run src/core/models/__tests__/event.test.ts` → all pass
- **Dependencies**: Task 2

---

### Task 6: Plan/Task 모델에 이벤트 통합
- **Estimate**: 4분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟡 Caution — 기존 모델 수정
- **Files**: `src/core/models/plan.ts`, `src/core/models/task.ts`, `src/core/models/__tests__/plan.test.ts`, `src/core/models/__tests__/task.test.ts`
- **Changes**:
  - `plan.ts`: PlanModel 생성자에 EventModel 주입. create/update/activate/complete/archive 호출 시 자동으로 event.record() 호출
  - `task.ts`: TaskModel 생성자에 EventModel 주입. create/updateStatus 호출 시 자동으로 event.record() 호출. status 변경 시 old_value에 이전 status, new_value에 새 status JSON 저장
- **TDD Steps**:
  1. Write failing test: plan.create() 후 event.getByEntity('plan', planId) → 'created' 이벤트 존재. task.updateStatus(id, 'done') 후 이벤트에 old/new 값 확인
  2. Implement: 각 메서드에 this.events.record() 추가
  3. Refactor: none
- **Verify**: `npx vitest run src/core/models/__tests__/plan.test.ts src/core/models/__tests__/task.test.ts` → all pass (이벤트 통합 테스트 포함)
- **Dependencies**: Task 3, 4, 5

---

### Task 7: Context Log 모델
- **Estimate**: 3분
- **Complexity**: 🟢 Routine
- **Risk**: 🟢 Safe
- **Files**: `src/core/models/context.ts`, `src/core/models/__tests__/context.test.ts`
- **Changes**:
  - `context.ts`: ContextModel class with methods:
    - `save(planId?, summary, sessionId?, lastTaskId?)` → ContextLog
    - `getLatest(limit?)` → ContextLog[] (최근순)
    - `getByPlan(planId)` → ContextLog[]
    - `getBySession(sessionId)` → ContextLog | null
- **TDD Steps**:
  1. Write failing test: save 2개 → getLatest(1) → 최근 1개만 반환
  2. Implement: prepared statements
  3. Refactor: none
- **Verify**: `npx vitest run src/core/models/__tests__/context.test.ts` → all pass
- **Dependencies**: Task 2

---

### Task 8: plan_progress View + 대시보드 쿼리
- **Estimate**: 4분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/core/engine/dashboard.ts`, `src/core/engine/__tests__/dashboard.test.ts`
- **Changes**:
  - `dashboard.ts`: DashboardEngine class with methods:
    - `getOverview()` → `{ plans: PlanProgress[], active_count, total_tasks, done_tasks }` (plan_progress 뷰 조회)
    - `getPlanSummary(planId)` → PlanProgress (단일 플랜 진행률)
  - PlanProgress 타입: `{ id, title, status, total_tasks, done_tasks, active_tasks, blocked_tasks, progress_pct }`
- **TDD Steps**:
  1. Write failing test: plan + tasks (2 done, 1 in_progress, 1 blocked) 생성 → getOverview() → progress_pct=50, done=2, active=1, blocked=1
  2. Implement: plan_progress 뷰 쿼리
  3. Refactor: none
- **Verify**: `npx vitest run src/core/engine/__tests__/dashboard.test.ts` → all pass
- **Dependencies**: Task 3, 4

---

### Task 9: Lifecycle 엔진 (완료 판정)
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟡 Caution — 비즈니스 로직 핵심
- **Files**: `src/core/engine/lifecycle.ts`, `src/core/engine/__tests__/lifecycle.test.ts`
- **Changes**:
  - `lifecycle.ts`: LifecycleEngine class with methods:
    - `canComplete(planId)` → `{ completable: boolean, blockers: string[] }` — 미완료/blocked 태스크 목록 반환
    - `completePlan(planId)` → Plan — canComplete 체크 후 plan.complete() 호출 + 'completed' 이벤트 발행
    - `autoCheckCompletion(planId)` → `{ all_done: boolean, progress }` — 태스크 상태 변경 후 자동 호출용
  - 완료 기준: 모든 leaf 태스크가 done 또는 skipped
  - completePlan은 EventModel을 통해 plan 완료 이벤트를 기록함
- **TDD Steps**:
  1. Write failing test: 미완료 태스크 있으면 canComplete → false + blocker 목록. 모두 done이면 → true. completePlan 호출 시 plan.status = 'completed'
  2. Implement: tasks 조회 → status 검증 → plan.complete()
  3. Refactor: none
- **Verify**: `npx vitest run src/core/engine/__tests__/lifecycle.test.ts` → all pass
- **Dependencies**: Task 6, 8

---

### Task 10: Smart Alerts 엔진
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/core/engine/alerts.ts`, `src/core/engine/__tests__/alerts.test.ts`
- **Changes**:
  - `alerts.ts`: AlertsEngine class with methods:
    - `getAlerts()` → Alert[] — 4가지 알림 유형 통합 반환
    - `getStaleTasks(thresholdDays?)` → Task[] — N일 이상 in_progress 상태 (events 테이블의 마지막 변경 기준)
    - `getBlockedPlans()` → Plan[] — blocked 태스크가 있는 active 플랜
    - `getCompletablePlans()` → Plan[] — 모든 태스크 done인데 plan이 active
    - `getForgottenPlans(thresholdDays?)` → Plan[] — N일 이상 변경 없는 active 플랜. 판정 기준: `MAX(events.created_at) WHERE entity_id IN (plan_id 또는 해당 plan의 task_id들)`
  - Alert 타입: `{ type: 'stale'|'blocked'|'completable'|'forgotten', entity_type, entity_id, message }`
- **TDD Steps**:
  1. Write failing test: stale task 시나리오 — task를 in_progress로 변경 후, events의 created_at을 4일 전으로 수동 업데이트 → getStaleTasks(3) → 해당 태스크 반환
  2. Implement: 각 알림 유형별 SQL 쿼리
  3. Refactor: none
- **Verify**: `npx vitest run src/core/engine/__tests__/alerts.test.ts` → all pass
- **Dependencies**: Task 5, 8

---

### Task 11: Stats 엔진 (velocity, 예상완료)
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/core/engine/stats.ts`, `src/core/engine/__tests__/stats.test.ts`
- **Changes**:
  - `stats.ts`: StatsEngine class with methods:
    - `getVelocity(planId?, days?)` → `{ daily: number, total_completed: number }` — 일별 완료 태스크 수 평균
    - `getEstimatedCompletion(planId)` → `{ remaining_tasks, velocity, estimated_days, estimated_date }` — velocity 기반 예상 완료일
    - `getTimeline(planId)` → `{ date, tasks_completed, cumulative }[]` — 일별 완료 추이
  - events 테이블에서 status_changed + new_value='done' 이벤트 기반
- **TDD Steps**:
  1. Write failing test: 3일간 각각 2, 1, 3개 태스크 완료 이벤트 생성 → getVelocity() → daily=2.0. remaining 4개일 때 estimated_days=2
  2. Implement: events GROUP BY DATE 쿼리, velocity 계산
  3. Refactor: none
- **Verify**: `npx vitest run src/core/engine/__tests__/stats.test.ts` → all pass
- **Dependencies**: Task 5, 8

---

### Task 12: MCP Server 셋업 + vp_dashboard
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟡 Caution — MCP SDK 첫 사용
- **Files**: `src/mcp/server.ts`, `src/mcp/__tests__/server.test.ts`
- **Changes**:
  - `server.ts`:
    - `@modelcontextprotocol/sdk` 의 Server 클래스 사용
    - stdio transport
    - DB 초기화 (getDb + initSchema)
    - 모든 모델/엔진 인스턴스 생성
    - `vp_dashboard` tool 등록: DashboardEngine.getOverview() + AlertsEngine.getAlerts() 호출 → JSON 반환
    - `vp_context_resume` tool 등록: context.getLatest(1) + dashboard + alerts 통합 반환
- **TDD Steps**:
  1. Write failing test: MCP Server 인스턴스 생성, listTools() → 'vp_dashboard', 'vp_context_resume' 포함 확인
  2. Implement: Server 설정 + tool 핸들러
  3. Refactor: none
- **Verify**: `npx vitest run src/mcp/__tests__/server.test.ts` → all pass
- **Dependencies**: Task 7, 8, 10

---

### Task 13: MCP Plan Tools
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/mcp/server.ts`, `src/mcp/__tests__/plan-tools.test.ts`
- **Changes**:
  - `server.ts`에 tool 추가:
    - `vp_plan_create`: params(title, spec?, summary?) → plan.create() + plan.activate() → Plan JSON
    - `vp_plan_get`: params(plan_id) → plan.getById() + task.getTree() → Plan + tasks JSON
    - `vp_plan_complete`: params(plan_id) → lifecycle.completePlan() → 결과 JSON
    - `vp_plan_archive`: params(plan_id) → plan.archive() → Plan JSON
    - `vp_plan_list`: params(status?) → plan.list() → Plan[] JSON
- **TDD Steps**:
  1. Write failing test: vp_plan_create 호출 → plan 생성 확인. vp_plan_get → 태스크 트리 포함 확인. 에러 케이스: 존재하지 않는 plan_id → 적절한 에러 메시지 반환
  2. Implement: 각 tool의 inputSchema + handler + 입력 검증
  3. Refactor: none
- **Verify**: `npx vitest run src/mcp/__tests__/plan-tools.test.ts` → all pass
- **Dependencies**: Task 9, 12

---

### Task 14: MCP Task Tools
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/mcp/server.ts`, `src/mcp/__tests__/task-tools.test.ts`
- **Changes**:
  - `server.ts`에 tool 추가:
    - `vp_task_update`: params(task_id, status) → task.updateStatus() → Task JSON + autoCheckCompletion 결과
    - `vp_task_get`: params(task_id) → task.getById() → Task JSON (acceptance criteria 포함)
    - `vp_task_next`: params(plan_id) → task.getByPlan(planId, {status: 'todo'}) 중 sort_order 최소 → Task JSON
    - `vp_task_block`: params(task_id, reason?) → task.updateStatus('blocked') → Task JSON
    - `vp_task_create`: params(plan_id, title, parent_id?, spec?, acceptance?) → task.create() → Task JSON
  - 에러 핸들링: 존재하지 않는 ID, 잘못된 status 값 → 명확한 에러 메시지
- **TDD Steps**:
  1. Write failing test: vp_task_update 'done' → status 변경 확인 + 이벤트 기록 확인. vp_task_next → todo 중 첫 번째 반환. 에러: 잘못된 status 값 → 에러 반환
  2. Implement: 각 tool의 inputSchema + handler + 입력 검증
  3. Refactor: none
- **Verify**: `npx vitest run src/mcp/__tests__/task-tools.test.ts` → all pass
- **Dependencies**: Task 6, 12

---

### Task 15: MCP Context + Stats Tools
- **Estimate**: 4분
- **Complexity**: 🟢 Routine
- **Risk**: 🟢 Safe
- **Files**: `src/mcp/server.ts`, `src/mcp/__tests__/context-stats-tools.test.ts`
- **Changes**:
  - `server.ts`에 tool 추가:
    - `vp_context_save`: params(summary, plan_id?, session_id?) → context.save() → ContextLog JSON
    - `vp_stats`: params(plan_id?) → stats.getVelocity() + stats.getEstimatedCompletion() → Stats JSON
    - `vp_history`: params(entity_type, entity_id) → event.getByEntity() → Event[] JSON
- **TDD Steps**:
  1. Write failing test: vp_context_save → context 저장 확인. vp_stats → velocity/estimated 반환 확인
  2. Implement: tool handler
  3. Refactor: none
- **Verify**: `npx vitest run src/mcp/__tests__/context-stats-tools.test.ts` → all pass
- **Dependencies**: Task 7, 11, 12

---

### Task 16: CLI 셋업 + dashboard 커맨드
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/cli/index.ts`, `src/cli/formatters.ts`, `src/cli/__tests__/dashboard.test.ts`
- **Changes**:
  - `index.ts`: commander.js 기반 CLI 앱 설정. `#!/usr/bin/env node` shebang. `vp dashboard` 서브커맨드
  - `formatters.ts`: 시각적 출력 헬퍼 — `formatDashboard(overview, alerts)` → 프로그레스 바, 컬러 상태, 알림 박스 문자열 생성
  - dashboard 커맨드: getDb → DashboardEngine.getOverview() + AlertsEngine.getAlerts() → formatDashboard() 출력
- **TDD Steps**:
  1. Write failing test: formatDashboard(mockData) → 프로그레스 바 문자열 포함 ('██'), 진행률 퍼센트 포함 확인
  2. Implement: commander 설정 + formatter
  3. Refactor: none
- **Verify**: `npx vitest run src/cli/__tests__/dashboard.test.ts` → all pass
- **Dependencies**: Task 8, 10

---

### Task 17: CLI Plan 커맨드
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/cli/index.ts`, `src/cli/formatters.ts`, `src/cli/__tests__/plan-cli.test.ts`
- **Changes**:
  - `index.ts`에 커맨드 추가:
    - `vp plan list [--status <status>]` → plan.list() → 테이블 출력
    - `vp plan show <id>` → plan.getById() + task.getTree() → 트리 뷰 출력
    - `vp plan create --title <t> [--spec <file>]` → plan.create() + activate()
    - `vp plan complete <id>` → lifecycle.completePlan()
  - `formatters.ts`에 추가: `formatPlanTree(plan, tasks)` → 트리 문자열 (├─ + ASCII 상태 표시: [x] done, [>] in_progress, [!] blocked, [ ] todo, [-] skipped)
- **TDD Steps**:
  1. Write failing test: formatPlanTree(plan, nestedTasks) → 트리 문자열에 '├─', '└─' 포함, 인덴트 정확 확인
  2. Implement: commander 서브커맨드 + formatter
  3. Refactor: none
- **Verify**: `npx vitest run src/cli/__tests__/plan-cli.test.ts` → all pass
- **Dependencies**: Task 9, 16

---

### Task 18: CLI Task + Stats 커맨드
- **Estimate**: 5분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟢 Safe
- **Files**: `src/cli/index.ts`, `src/cli/formatters.ts`, `src/cli/__tests__/task-stats-cli.test.ts`
- **Changes**:
  - `index.ts`에 커맨드 추가:
    - `vp task update <id> <status>` → task.updateStatus()
    - `vp task show <id>` → task.getById() 상세 출력
    - `vp stats [plan_id]` → stats.getVelocity() + getEstimatedCompletion() + getTimeline()
    - `vp history <type> <id>` → event.getByEntity() → 이벤트 로그 출력
  - `formatters.ts`에 추가: `formatStats(velocity, estimate, timeline)` → 바 차트 + 예상일 문자열, `formatHistory(events)` → 시간순 로그
- **TDD Steps**:
  1. Write failing test: formatStats(mockData) → 'tasks/day' 문자열 포함, 예상완료일 포함. formatHistory → 날짜 + 이벤트 타입 포함
  2. Implement: commander 서브커맨드 + formatter
  3. Refactor: none
- **Verify**: `npx vitest run src/cli/__tests__/task-stats-cli.test.ts` → all pass
- **Dependencies**: Task 6, 11, 16

---

### Task 19: 빌드 설정 + 패키징
- **Estimate**: 4분
- **Complexity**: 🟡 Moderate
- **Risk**: 🟡 Caution — 번들링 + native module (better-sqlite3)
- **Files**: `tsup.config.ts`, `package.json`
- **Changes**:
  - `tsup.config.ts`: 두 entrypoint — `src/mcp/server.ts` (MCP), `src/cli/index.ts` (CLI). format: esm. external: better-sqlite3 (native addon은 번들 불가)
  - `package.json`: bin 필드 (`vp` → `dist/cli/index.js`), main 필드 (`dist/mcp/server.js`), scripts (build, dev, test), files 필드 (dist 포함)
- **TDD Steps**:
  1. Write failing test: `npm run build` 실행 → `dist/mcp/server.js`, `dist/cli/index.js` 파일 존재 확인
  2. Implement: tsup 설정 완성
  3. Refactor: none
- **Verify**: `npm run build && ls dist/mcp/server.js dist/cli/index.js` → 두 파일 존재
- **Dependencies**: Task 12, 16

---

### Task 20: Marketplace 설정
- **Estimate**: 3분
- **Complexity**: 🟢 Routine
- **Risk**: 🟢 Safe
- **Files**: `package.json`, `.github/workflows/release.yml`
- **Changes**:
  - `package.json`: keywords (claude-code, mcp-server, vibecoding, sdd), repository, license (MIT), description 추가
  - `.github/workflows/release.yml`: tag push 시 npm publish + GitHub Release 생성 워크플로우
- **TDD Steps**:
  1. Write failing test: package.json 읽어서 keywords에 'mcp-server' 포함, bin 필드 존재 확인
  2. Implement: 메타데이터 + CI 설정
  3. Refactor: none
- **Verify**: `node -e "import('fs').then(fs => { const p=JSON.parse(fs.readFileSync('./package.json','utf8')); console.log(p.keywords.includes('mcp-server')) })"` → true
- **Dependencies**: Task 19

---

## Batches

--- Batch 1 (Tasks 1-2) → checkpoint ---
프로젝트 기반 설정
Complexity: 🟢🟡  Risk: 🟢🟢  예상: ~8min

--- Batch 2 (Tasks 3, 4, 5) → checkpoint ---
Core 모델 (병렬 가능: 3, 4, 5 모두 Task 2에만 의존)
Complexity: 🟡🟡🟢  Risk: 🟢🟡🟢  예상: ~14min

--- Batch 3 (Tasks 6, 7) → checkpoint ---
모델 통합 + Context
Complexity: 🟡🟢  Risk: 🟡🟢  예상: ~7min

--- Batch 4 (Tasks 8, 9, 10, 11) → checkpoint ---
엔진 레이어 (8 먼저 → 9, 10, 11 병렬)
Complexity: 🟡🟡🟡🟡  Risk: 🟢🟡🟢🟢  예상: ~19min

--- Batch 5 (Tasks 12, 13, 14, 15) → checkpoint ---
MCP Server (12 먼저 → 13, 14, 15 병렬)
Complexity: 🟡🟡🟡🟢  Risk: 🟡🟢🟢🟢  예상: ~19min

--- Batch 6 (Tasks 16, 17, 18) → checkpoint ---
CLI (16 먼저 → 17, 18 병렬)
Complexity: 🟡🟡🟡  Risk: 🟢🟢🟢  예상: ~15min

--- Batch 7 (Tasks 19, 20) → checkpoint ---
빌드 + 배포 설정
Complexity: 🟡🟢  Risk: 🟡🟢  예상: ~7min
