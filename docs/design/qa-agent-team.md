# QA Agent Team 설계서

> **Version**: 0.1.0-draft
> **Date**: 2026-03-25
> **Status**: Design Review

---

## 1. Overview

VibeSpec의 SDD 워크플로우에 **QA 에이전트 팀**을 추가한다.

**What**: 프로젝트 전체 구조를 분석하여 QA 시나리오를 자동 생성하고, 시나리오 기반 검증 → 이슈 수집 → 수정 플래닝까지 일관된 파이프라인으로 운영하는 에이전트 팀.

**For Whom**: VibeSpec으로 플랜/태스크를 관리하는 개발자. 플랜 완료 후 또는 중간 마일스톤에서 체계적인 QA를 원하는 경우.

**Why**: 현재 verifier는 **개별 태스크** 단위 검증만 수행한다. 태스크가 모두 PASS해도 전체 시스템의 통합 품질, 사용자 플로우, 회귀 영향은 검증되지 않는다. QA 팀은 이 갭을 매운다.

---

## 2. 아키텍처

### 2.1 팀 구성

```
┌─────────────────────────────────────────────────────────┐
│                    QA Team                               │
│                                                          │
│   ┌─────────────────────────────┐                        │
│   │  qa-coordinator (관리자)      │  ← /vs-qa 진입점     │
│   │  - 프로젝트 구조 분석          │                       │
│   │  - QA 시나리오 생성            │                       │
│   │  - 팀원 디스패치 & 결과 집계    │                       │
│   └─────────┬───────────────────┘                        │
│             │                                            │
│     ┌───────┼───────────┬──────────────┐                 │
│     ▼       ▼           ▼              ▼                 │
│  ┌──────┐ ┌──────┐  ┌───────┐  ┌───────────┐            │
│  │  qa  │ │  qa  │  │  qa   │  │    qa     │            │
│  │ func │ │ integ│  │ flow  │  │ reporter  │            │
│  │ tester│ │ tester│ │ tester│  │           │            │
│  └──────┘ └──────┘  └───────┘  └───────────┘            │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 에이전트 역할 정의

| 에이전트 | 역할 | Model | 디스패치 조건 |
|---------|------|-------|-------------|
| **qa-coordinator** | 프로젝트 분석, QA 시나리오 생성, 팀 오케스트레이션, 최종 리포트 | opus | `/vs-qa` 스킬 호출 시 |
| **qa-func-tester** | 기능 단위 시나리오 검증 (단위/통합 테스트 기반) | sonnet | coordinator가 디스패치 |
| **qa-flow-tester** | 사용자 플로우 시나리오 검증 (E2E, 시퀀스) | sonnet | coordinator가 디스패치 |
| **qa-reporter** | 이슈 수집/정리, 수정 플랜 생성, 대시보드 데이터 기록 | sonnet | 모든 tester 완료 후 |

### 2.3 기존 시스템과의 관계

```
기존 파이프라인 (태스크 단위):
  spec-writer → tdd-implementer → verifier → debugger
                                      │
                                      ▼ (태스크 완료)

QA 파이프라인 (플랜/마일스톤 단위):
  /vs-qa ──→ qa-coordinator ──→ qa-func-tester (병렬)
                              ──→ qa-flow-tester (병렬)
                              ──→ qa-reporter (수집 후)
                                      │
                                      ▼
                              qa_findings → qa_plan (수정 플랜)
                                      │
                                      ▼
                              vs-dashboard (QA 섹션 통합)
```

---

## 3. 데이터 모델

### 3.1 새로운 테이블

```sql
-- QA 실행 단위 (1 플랜당 N회 실행 가능)
CREATE TABLE IF NOT EXISTS qa_runs (
  id          TEXT PRIMARY KEY,
  plan_id     TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  trigger     TEXT NOT NULL CHECK(trigger IN ('manual', 'auto', 'milestone')),
  status      TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed')) DEFAULT 'pending',
  summary     TEXT,                    -- coordinator 최종 요약
  total_scenarios  INTEGER DEFAULT 0,
  passed_scenarios INTEGER DEFAULT 0,
  failed_scenarios INTEGER DEFAULT 0,
  risk_score       REAL DEFAULT 0,     -- 0.0 ~ 1.0
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- QA 시나리오 (coordinator가 생성)
CREATE TABLE IF NOT EXISTS qa_scenarios (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  category    TEXT NOT NULL CHECK(category IN ('functional', 'integration', 'flow', 'regression', 'edge_case')),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,           -- 시나리오 상세 (steps, expected)
  priority    TEXT NOT NULL CHECK(priority IN ('critical', 'high', 'medium', 'low')) DEFAULT 'medium',
  related_tasks TEXT,                  -- JSON: 관련 태스크 ID 배열
  status      TEXT NOT NULL CHECK(status IN ('pending', 'running', 'pass', 'fail', 'skip', 'warn')) DEFAULT 'pending',
  agent       TEXT,                    -- 담당 에이전트 (qa-func-tester, qa-flow-tester)
  evidence    TEXT,                    -- 검증 근거 (테스트 출력, 코드 참조)
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- QA 발견 이슈
CREATE TABLE IF NOT EXISTS qa_findings (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  scenario_id TEXT REFERENCES qa_scenarios(id) ON DELETE SET NULL,
  severity    TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
  category    TEXT NOT NULL CHECK(category IN (
    'bug', 'regression', 'missing_feature', 'inconsistency',
    'performance', 'security', 'ux_issue', 'spec_gap'
  )),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_files TEXT,                 -- JSON: 영향 받는 파일 목록
  related_task_id TEXT REFERENCES tasks(id),
  fix_suggestion TEXT,                 -- 수정 제안
  status      TEXT NOT NULL CHECK(status IN ('open', 'planned', 'fixed', 'wontfix', 'duplicate')) DEFAULT 'open',
  fix_plan_id TEXT REFERENCES plans(id),  -- 수정 플랜 연결
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- QA run별 집계 VIEW
CREATE VIEW IF NOT EXISTS qa_run_summary AS
SELECT
  qr.id,
  qr.plan_id,
  qr.status,
  qr.risk_score,
  qr.created_at,
  COUNT(qs.id) AS total_scenarios,
  SUM(CASE WHEN qs.status = 'pass' THEN 1 ELSE 0 END) AS passed,
  SUM(CASE WHEN qs.status = 'fail' THEN 1 ELSE 0 END) AS failed,
  SUM(CASE WHEN qs.status = 'warn' THEN 1 ELSE 0 END) AS warned,
  COUNT(qf.id) AS total_findings,
  SUM(CASE WHEN qf.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings,
  SUM(CASE WHEN qf.severity = 'high' THEN 1 ELSE 0 END) AS high_findings
FROM qa_runs qr
LEFT JOIN qa_scenarios qs ON qs.run_id = qr.id
LEFT JOIN qa_findings qf ON qf.run_id = qr.id
GROUP BY qr.id;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_qa_runs_plan ON qa_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_qa_scenarios_run ON qa_scenarios(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_scenarios_status ON qa_scenarios(status);
CREATE INDEX IF NOT EXISTS idx_qa_findings_run ON qa_findings(run_id);
CREATE INDEX IF NOT EXISTS idx_qa_findings_severity ON qa_findings(severity);
CREATE INDEX IF NOT EXISTS idx_qa_findings_status ON qa_findings(status);
```

### 3.2 새로운 타입

```typescript
// --- QA Types ---
export type QARunTrigger = 'manual' | 'auto' | 'milestone';
export type QARunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type QAScenarioCategory = 'functional' | 'integration' | 'flow' | 'regression' | 'edge_case';
export type QAScenarioPriority = 'critical' | 'high' | 'medium' | 'low';
export type QAScenarioStatus = 'pending' | 'running' | 'pass' | 'fail' | 'skip' | 'warn';
export type QAFindingSeverity = 'critical' | 'high' | 'medium' | 'low';
export type QAFindingCategory = 'bug' | 'regression' | 'missing_feature' | 'inconsistency'
  | 'performance' | 'security' | 'ux_issue' | 'spec_gap';
export type QAFindingStatus = 'open' | 'planned' | 'fixed' | 'wontfix' | 'duplicate';

export interface QARun {
  id: string;
  plan_id: string;
  trigger: QARunTrigger;
  status: QARunStatus;
  summary: string | null;
  total_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  risk_score: number;
  created_at: string;
  completed_at: string | null;
}

export interface QAScenario {
  id: string;
  run_id: string;
  category: QAScenarioCategory;
  title: string;
  description: string;
  priority: QAScenarioPriority;
  related_tasks: string | null;   // JSON array of task IDs
  status: QAScenarioStatus;
  agent: string | null;
  evidence: string | null;
  created_at: string;
}

export interface QAFinding {
  id: string;
  run_id: string;
  scenario_id: string | null;
  severity: QAFindingSeverity;
  category: QAFindingCategory;
  title: string;
  description: string;
  affected_files: string | null;  // JSON array
  related_task_id: string | null;
  fix_suggestion: string | null;
  status: QAFindingStatus;
  fix_plan_id: string | null;
  created_at: string;
}

export interface QARunSummary {
  id: string;
  plan_id: string;
  status: QARunStatus;
  risk_score: number;
  created_at: string;
  total_scenarios: number;
  passed: number;
  failed: number;
  warned: number;
  total_findings: number;
  critical_findings: number;
  high_findings: number;
}
```

---

## 4. 에이전트 상세 설계

### 4.1 qa-coordinator (관리자 에이전트)

**역할**: QA 팀의 두뇌. 프로젝트를 분석하여 시나리오를 생성하고, 팀원을 디스패치하며, 결과를 집계한다.

**Input**:
- `plan_id`: 대상 플랜
- `mode`: `full` (전체 QA) | `incremental` (마지막 QA 이후 변경분만) | `targeted` (특정 태스크/영역)
- `target_tasks`: (targeted 모드) 대상 태스크 ID 목록
- `depth`: `quick` (핵심 시나리오만) | `standard` (표준) | `thorough` (심층)

**Execution Process**:

```
Phase 1: 프로젝트 구조 분석 (Context Gathering)
  ├─ 1.1 플랜 스펙 + 전체 태스크 목록 조회 (vs plan show)
  ├─ 1.2 완료된 태스크들의 스펙/AC/변경 파일 수집
  ├─ 1.3 프로젝트 기술 스택 감지 (package.json, tsconfig 등)
  ├─ 1.4 기존 테스트 구조 파악 (테스트 디렉토리, 프레임워크)
  ├─ 1.5 이전 QA 결과 조회 (있는 경우 — 회귀 체크 기준선)
  └─ 1.6 Error KB에서 관련 이슈 검색

Phase 2: QA 시나리오 생성
  ├─ 2.1 기능 시나리오 (Functional)
  │     각 태스크의 AC를 기반으로 기능별 검증 시나리오 생성
  │     형식: Given-When-Then + 예상 결과 + 검증 방법
  │
  ├─ 2.2 통합 시나리오 (Integration)
  │     태스크 간 의존성 그래프를 분석하여 교차 영향 시나리오
  │     - 공유 인터페이스/API 계약 검증
  │     - 데이터 흐름 일관성 검증
  │     - 임포트/디펜던시 무결성 검증
  │
  ├─ 2.3 사용자 플로우 시나리오 (Flow)
  │     플랜 스펙에서 사용자 시나리오를 추출하여 E2E 검증
  │     - Happy path 플로우
  │     - Error path 플로우
  │     - Edge case 플로우
  │
  ├─ 2.4 회귀 시나리오 (Regression)
  │     변경된 파일과 관련된 기존 기능의 영향 분석
  │     - 변경 파일의 의존 그래프 추적
  │     - 기존 테스트 중 영향받는 테스트 식별
  │
  └─ 2.5 엣지 케이스 시나리오
        스펙의 Edge Cases 섹션 + 추론 기반

Phase 3: 시나리오 DB 등록 & 팀원 디스패치
  ├─ 3.1 vs qa scenario create 로 시나리오 일괄 등록
  ├─ 3.2 카테고리별 에이전트 배정
  │     functional + integration → qa-func-tester
  │     flow + edge_case → qa-flow-tester
  │     regression → qa-func-tester (regression 모드)
  │
  ├─ 3.3 priority=critical 시나리오 우선 디스패치
  └─ 3.4 병렬 디스패치 (func-tester, flow-tester 동시)

Phase 4: 결과 집계 & 최종 판정
  ├─ 4.1 모든 tester 결과 수집
  ├─ 4.2 qa-reporter 디스패치 (이슈 정리 + 수정 플랜 생성)
  ├─ 4.3 리스크 스코어 계산
  │     risk_score = (critical×0.4 + high×0.3 + medium×0.2 + low×0.1)
  │                  / total_scenarios
  │     + regression_fail_bonus (회귀 실패 시 +0.2)
  │
  ├─ 4.4 QA Run 상태 업데이트 (completed/failed)
  └─ 4.5 최종 QA 리포트 출력
```

**리스크 스코어 해석**:
| 범위 | 등급 | 의미 |
|------|------|------|
| 0.0 ~ 0.2 | GREEN | 안전 — 릴리즈 가능 |
| 0.2 ~ 0.5 | YELLOW | 주의 — 발견 이슈 검토 필요 |
| 0.5 ~ 0.8 | ORANGE | 위험 — 수정 필요 |
| 0.8 ~ 1.0 | RED | 심각 — 수정 플랜 필수 |

### 4.2 qa-func-tester (기능 테스터)

**역할**: 기능/통합/회귀 시나리오를 실제로 검증한다.

**Input**:
- `scenarios`: 배정된 시나리오 목록 (ID, title, description, category)
- `plan_context`: 플랜 스펙 요약
- `project_info`: 기술 스택, 테스트 러너, 디렉토리 구조

**Execution Process**:

```
각 시나리오에 대해:

1. 시나리오 파싱
   - Given-When-Then 구조 추출
   - 관련 소스 파일 식별
   - 관련 테스트 파일 식별

2. 자동 검증 (가능한 경우)
   - 기존 테스트 중 시나리오에 매핑되는 테스트 실행
   - 테스트가 없으면: 코드 리딩 기반 정적 분석

3. 정적 분석 (항상)
   - 코드가 시나리오의 expected를 충족하는지 추론
   - 데이터 흐름 추적: 입력 → 처리 → 출력 경로 확인
   - 에러 핸들링 경로 확인

4. 판정 & 증거 기록
   - PASS: 테스트 통과 또는 코드가 명확히 요구사항 충족
   - FAIL: 테스트 실패 또는 코드에 누락/오류 발견
   - WARN: 확인 불충분, 수동 검증 권장
   - evidence 필드에 판정 근거 기록

5. 이슈 발견 시
   - vs qa finding create 로 이슈 등록
   - severity, category, affected_files, fix_suggestion 포함
```

### 4.3 qa-flow-tester (플로우 테스터)

**역할**: 사용자 플로우와 엣지 케이스 시나리오를 검증한다.

**Input**: qa-func-tester와 동일 구조

**Execution Process**:

```
각 플로우 시나리오에 대해:

1. 플로우 분해
   - 멀티스텝 플로우를 개별 스텝으로 분해
   - 스텝 간 상태 전이 매핑
   - 분기점(조건부 경로) 식별

2. 스텝별 검증
   - 각 스텝의 입력/출력 계약 확인
   - 상태 전이의 일관성 검증
   - 에러 발생 시 복구 경로 존재 여부

3. 크로스커팅 검증
   - 타입 일관성: 스텝 간 데이터 타입 호환
   - API 계약: 호출자-피호출자 인터페이스 일치
   - 사이드 이펙트: DB/파일/상태 변경의 정합성

4. 엣지 케이스 시뮬레이션
   - 빈 입력, null, 경계값 시나리오
   - 동시성/순서 의존 시나리오 (해당 시)
   - 실패 후 재시도 시나리오

5. 판정 & 증거 기록 (qa-func-tester와 동일)
```

### 4.4 qa-reporter (리포터)

**역할**: 모든 결과를 수집하여 이슈를 정리하고, 필요 시 수정 플랜을 생성한다.

**Input**:
- `run_id`: QA Run ID
- `plan_id`: 대상 플랜
- `coordinator_analysis`: coordinator의 분석 결과

**Execution Process**:

```
Phase 1: 이슈 수집 & 정리
  ├─ 1.1 qa_findings 전체 조회 (run_id 기준)
  ├─ 1.2 중복 이슈 탐지 & 병합 (제목/파일 유사도 기반)
  ├─ 1.3 severity 재평가 (전체 맥락에서)
  └─ 1.4 이슈 간 연관 관계 매핑

Phase 2: 수정 플랜 생성 (critical/high 이슈 존재 시)
  ├─ 2.1 이슈를 수정 태스크로 변환
  │     - 1 이슈 = 1 태스크 (또는 관련 이슈 그룹 = 1 태스크)
  │     - 태스크 spec: 이슈 description + fix_suggestion 기반
  │     - 태스크 acceptance: 해당 QA 시나리오 재통과
  │
  ├─ 2.2 수정 플랜 생성 (vs plan create)
  │     title: "QA Fix: {원본 플랜 제목} - Run #{run_number}"
  │     spec: 발견 이슈 요약 + 수정 범위
  │
  ├─ 2.3 수정 태스크 등록 (vs task create)
  │     각 이슈에 대한 수정 태스크
  │     allowed_files: 이슈의 affected_files 기반
  │
  └─ 2.4 qa_findings.fix_plan_id 업데이트

Phase 3: 대시보드 데이터 갱신
  ├─ 3.1 qa_runs 최종 상태 업데이트
  ├─ 3.2 qa_run_summary VIEW 통해 집계 확인
  └─ 3.3 Error KB에 반복 패턴 기록 (해당 시)
```

---

## 5. 스킬 설계

### 5.1 /vs-qa (메인 QA 스킬)

```
---
name: vs-qa
description: QA 에이전트 팀을 실행합니다. 프로젝트 구조 분석 → 시나리오 생성 → 검증 → 이슈 수집 → 수정 플래닝까지 일괄 수행합니다.
invocation: user
---

Steps:
1. 활성 플랜 확인 (vs --json dashboard)
2. QA 모드 선택 (full/incremental/targeted)
3. QA Run 생성 (vs qa run create)
4. qa-coordinator 에이전트 디스패치
5. 결과 대기 & 리포트 표시
6. 수정 플랜 생성 여부 확인 (critical/high 이슈 시)
```

### 5.2 /vs-qa-status (QA 상태 조회)

```
---
name: vs-qa-status
description: QA 실행 결과 및 발견 이슈 현황을 조회합니다.
invocation: user
---

Steps:
1. vs qa run list --plan <plan_id> --json
2. 최근 QA Run 결과 렌더링
3. 미해결 이슈 목록 표시
4. 리스크 스코어 트렌드
```

### 5.3 /vs-qa-findings (이슈 관리)

```
---
name: vs-qa-findings
description: QA 발견 이슈를 조회하고 상태를 관리합니다.
invocation: user
---

Steps:
1. vs qa finding list --run <run_id> --json
2. 이슈 필터링 (severity, category, status)
3. 이슈 상태 업데이트 (planned, fixed, wontfix, duplicate)
```

---

## 6. CLI 확장

```
vs qa                              # QA 서브커맨드 루트
vs qa run create <plan_id>         # QA Run 생성
vs qa run list [--plan <id>]       # QA Run 목록
vs qa run show <run_id>            # QA Run 상세 + 시나리오 + 이슈
vs qa scenario create <run_id>     # 시나리오 등록 (에이전트용)
vs qa scenario update <id>         # 시나리오 상태/결과 업데이트
vs qa scenario list <run_id>       # 시나리오 목록
vs qa finding create <run_id>      # 이슈 등록
vs qa finding update <id>          # 이슈 상태 업데이트
vs qa finding list [--run <id>] [--severity <s>] [--status <s>]
vs qa stats [--plan <id>]          # QA 통계 (리스크 트렌드, 이슈 분포)
```

모든 명령은 `--json` 플래그를 지원한다.

---

## 7. 대시보드 통합

### 7.1 vs-dashboard 확장

기존 대시보드에 **QA 섹션**을 추가한다:

```
📋 Plan Title (8/10 — 80%)
[████████████████░░░░] 80%
├─ ✅ done: 8  🔄 in_progress: 1  📝 todo: 1
├─ 속도: 2.3 tasks/day · 예상 완료: 2026-03-28
│
├─ 🔬 QA Status: YELLOW (risk: 0.35)          ← 새로운 섹션
│  ├─ 최근 QA Run: #3 (2026-03-25) — 12/15 시나리오 통과
│  ├─ 미해결 이슈: 🔴 critical: 0  🟠 high: 2  🟡 medium: 3
│  └─ 수정 플랜: "QA Fix: Plan Title - Run #3" (3 tasks, 33% done)
```

### 7.2 QA 알림 추가

AlertsEngine에 새 알림 유형 추가:

| 타입 | 조건 | 메시지 |
|------|------|--------|
| `qa_risk_high` | risk_score >= 0.5 | "Plan X의 QA 리스크가 높습니다 (risk: 0.65)" |
| `qa_findings_open` | open critical/high findings > 0 | "Plan X에 미해결 critical/high QA 이슈가 N건 있습니다" |
| `qa_stale` | 최근 QA Run이 7일 이전 | "Plan X의 마지막 QA가 N일 전입니다" |
| `qa_fix_blocked` | QA fix plan에 blocked 태스크 | "QA 수정 플랜에 차단된 태스크가 있습니다" |

### 7.3 대시보드 다음 단계 확장

기존 조건부 선택지에 QA 관련 항목 추가:

| 조건 | 선택지 | 설명 |
|------|--------|------|
| open critical/high QA findings | "QA 이슈 수정" | QA fix plan의 태스크 실행 → `/vs-next` |
| QA 미실행 + 플랜 50%+ 완료 | "QA 실행" | `/vs-qa`로 QA 수행 |
| completable + QA 미통과 | "QA 먼저 실행" | 플랜 완료 전 QA 권장 |

---

## 8. 사용자 플로우

### 8.1 전체 QA 플로우

```
사용자: /vs-qa

[시스템]:
  1. 활성 플랜 목록 표시
  2. "어떤 플랜의 QA를 실행할까요?" (선택)
  3. "QA 모드를 선택하세요" (full / incremental / targeted)
  4. "QA 깊이를 선택하세요" (quick / standard / thorough)

[qa-coordinator]:
  5. "프로젝트 구조를 분석하고 있습니다..."
  6. "15개 QA 시나리오를 생성했습니다"
     - functional: 6개
     - integration: 3개
     - flow: 4개
     - regression: 2개
  7. "QA 팀을 디스패치합니다..."

[qa-func-tester] (병렬):
  8. functional 6개 + integration 3개 + regression 2개 검증

[qa-flow-tester] (병렬):
  9. flow 4개 검증

[qa-reporter]:
  10. 결과 집계
  11. "3건의 이슈를 발견했습니다"
  12. "수정 플랜을 생성할까요?" (high 이슈 존재 시)

[최종 리포트]:
  ┌──────────────────────────────────────┐
  │ 🔬 QA 리포트 — Plan: Feature X       │
  │ Run #3 | 2026-03-25 | Mode: full     │
  ├──────────────────────────────────────┤
  │ 결과: 12/15 PASS | 2 FAIL | 1 WARN  │
  │ 리스크: 🟡 YELLOW (0.35)             │
  ├──────────────────────────────────────┤
  │ 📊 카테고리별:                        │
  │ ├─ functional:  5/6  PASS            │
  │ ├─ integration: 3/3  PASS            │
  │ ├─ flow:        3/4  PASS            │
  │ ├─ regression:  1/2  PASS            │
  │ └─ edge_case:   0/0  -              │
  ├──────────────────────────────────────┤
  │ 🐛 발견 이슈:                         │
  │ #1 [HIGH] API 응답 타입 불일치        │
  │    → src/api/handler.ts:45           │
  │ #2 [HIGH] 빈 입력 시 에러 미처리      │
  │    → src/core/parser.ts:12           │
  │ #3 [MEDIUM] 레거시 함수 미제거        │
  │    → src/utils/old.ts                │
  ├──────────────────────────────────────┤
  │ 📋 수정 플랜 생성됨:                   │
  │ "QA Fix: Feature X - Run #3"         │
  │ 태스크 2개 (high 이슈 기반)            │
  └──────────────────────────────────────┘
```

### 8.2 대시보드 통합 플로우

```
사용자: /vs-dashboard

[기존 대시보드 + QA 섹션 추가]:
  ... (기존 프로그레스 바, 태스크 분포, 알림)

  🔬 QA 현황:
  ├─ Plan "Feature X": 🟡 YELLOW (0.35) — 미해결 이슈 3건
  │  └─ 수정 플랜 진행: 1/2 tasks done
  └─ Plan "Feature Y": 🟢 GREEN (0.10) — 이슈 없음

  ⚠️ 알림:
  ... (기존 알림)
  🔬 Plan "Feature X"에 미해결 high QA 이슈 2건이 있습니다

  다음 액션:
  1. QA 이슈 수정 (Feature X)    ← QA 관련 최우선
  2. 진행 중 태스크 이어서 작업
  3. 새 QA 실행 (Feature Y — 마지막 QA 10일 전)
```

### 8.3 증분 QA 플로우

```
사용자: /vs-qa --incremental

[qa-coordinator]:
  1. 마지막 QA Run 이후 완료된 태스크 식별
  2. 변경 영향 범위 분석
  3. 영향받는 시나리오만 재생성/재검증
  4. 기존 PASS 시나리오는 유지 (변경 영향 없으면)
```

---

## 9. 구현 태스크 분해

### Phase 1: 데이터 레이어 (2 tasks)
1. **DB 스키마 마이그레이션** — qa_runs, qa_scenarios, qa_findings 테이블 + 인덱스 + VIEW 추가 (migration 8)
2. **TypeScript 타입 + 모델** — QA 관련 타입 정의 + QARunModel, QAScenarioModel, QAFindingModel CRUD

### Phase 2: CLI 확장 (2 tasks)
3. **CLI qa 서브커맨드** — `vs qa run/scenario/finding` CRUD 명령 + `--json` 지원
4. **CLI qa stats** — QA 통계 명령 (리스크 트렌드, 이슈 분포)

### Phase 3: 에이전트 정의 (4 tasks)
5. **qa-coordinator.md** — 관리자 에이전트 정의 (Phase 1~4 실행 프로세스)
6. **qa-func-tester.md** — 기능 테스터 에이전트 정의
7. **qa-flow-tester.md** — 플로우 테스터 에이전트 정의
8. **qa-reporter.md** — 리포터 에이전트 정의 (이슈 정리 + 수정 플랜 생성)

### Phase 4: 스킬 정의 (3 tasks)
9. **vs-qa SKILL.md** — 메인 QA 실행 스킬 (coordinator 디스패치)
10. **vs-qa-status SKILL.md** — QA 결과 조회 스킬
11. **vs-qa-findings SKILL.md** — 이슈 관리 스킬

### Phase 5: 대시보드 통합 (2 tasks)
12. **DashboardEngine 확장** — QA 섹션 데이터 조회 (qa_run_summary, open findings)
13. **AlertsEngine 확장** — QA 알림 유형 4종 추가
14. **vs-dashboard SKILL.md 업데이트** — QA 섹션 렌더링 + 다음 단계 선택지

### Phase 6: 훅 & 자동화 (1 task)
15. **QA 자동 트리거 훅** — 플랜 완료 시 자동 QA 실행 권장 알림

---

## 10. 기존 시스템 영향 분석

### 변경이 필요한 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/core/types.ts` | QA 관련 타입 추가 |
| `src/core/db/schema.ts` | migration 8 추가 (qa_runs, qa_scenarios, qa_findings) |
| `src/core/engine/dashboard.ts` | QA 요약 조회 메서드 추가 |
| `src/core/engine/alerts.ts` | QA 알림 타입 4종 추가 |
| `src/cli/index.ts` | `qa` 서브커맨드 트리 추가 |
| `skills/vs-dashboard/SKILL.md` | QA 섹션 렌더링 규칙 추가 |
| `.claude-plugin/plugin.json` | 새 에이전트/스킬 등록 |

### 새로 생성할 파일

| 파일 | 설명 |
|------|------|
| `agents/qa-coordinator.md` | QA 관리자 에이전트 |
| `agents/qa-func-tester.md` | 기능 테스터 에이전트 |
| `agents/qa-flow-tester.md` | 플로우 테스터 에이전트 |
| `agents/qa-reporter.md` | 리포터 에이전트 |
| `src/core/models/qa-run.ts` | QARun 모델 |
| `src/core/models/qa-scenario.ts` | QAScenario 모델 |
| `src/core/models/qa-finding.ts` | QAFinding 모델 |
| `skills/vs-qa/SKILL.md` | QA 실행 스킬 |
| `skills/vs-qa-status/SKILL.md` | QA 상태 조회 스킬 |
| `skills/vs-qa-findings/SKILL.md` | 이슈 관리 스킬 |

### 영향 없는 시스템

- 기존 4개 에이전트 (verifier, debugger, tdd-implementer, spec-writer) — 변경 없음
- 기존 워크플로우 스킬 (vs-next, vs-exec 등) — 변경 없음
- self-improve / error-kb — 변경 없음 (QA reporter가 기존 API 사용)

---

## 11. 성공 기준

1. `/vs-qa` 실행 시 qa-coordinator가 자동으로 시나리오를 생성하고 팀원을 디스패치한다
2. QA 결과가 `qa_runs`, `qa_scenarios`, `qa_findings` 테이블에 영속된다
3. `/vs-dashboard`에서 QA 현황 (리스크 스코어, 미해결 이슈)이 표시된다
4. critical/high 이슈 발견 시 자동으로 수정 플랜이 생성된다
5. 수정 플랜의 태스크는 기존 `/vs-next` 워크플로우로 실행 가능하다
6. incremental 모드에서 변경분만 재검증하여 불필요한 중복 검증을 방지한다
