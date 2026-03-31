# VibeSpec 하네스 통합 개선 — SDD 스펙

## Overview

VibeSpec 플러그인의 하네스(에이전트 오케스트레이션) 아키텍처를 3가지 축으로 개선한다:
(1) 프로젝트별 QA 규칙 커스터마이징 시스템, (2) 구현-QA 유기적 통합(Continuous QA Loop),
(3) 플래너 적응성(Adaptive Planner). 대상은 VibeSpec 플러그인을 설치한 개인 개발자이며,
기존 워크플로우 위에 새 기능을 점진적으로 도입하여 QA 발견 시점을 앞당기고,
재작업 사이클을 줄이며, 프로젝트 특성에 맞는 QA 정책을 가능하게 한다.

**3개 독립 플랜으로 분할 실행**:
- Phase 1: 인프라 (DB 스키마 + CLI + 하이브리드 핸드오프 + QA 규칙 시스템)
- Phase 2: Continuous QA Loop (qa-seeder + qa-shadow + wave-gate + 델타 QA)
- Phase 3: Adaptive Planner (이벤트 기반 watcher + plan-advisor + plan_revisions)

각 Phase는 독립 사용 가능하며, 이전 Phase 없이도 동작해야 한다.

## Requirements

### MUST (Phase 1 — 인프라 + QA 규칙)

- M1: `.claude/qa-rules.yaml` 파일로 프로젝트별 QA 규칙을 정의할 수 있어야 한다
- M2: 3계층 설정 머지 (L0 플러그인 기본값 < L1 프로젝트 설정 < L2 플랜 오버라이드)
- M3: `vs qa config resolve <plan_id>` CLI가 머지된 최종 설정을 JSON으로 반환해야 한다
- M4: `vs qa config validate` CLI가 YAML 문법 + 비즈니스 규칙을 검증해야 한다
- M5: 설정 파싱 실패 시 L0 기본값으로 fallback하고 경고를 출력해야 한다
- M6: QA 에이전트가 Phase 0에서 resolved_config를 읽고 동작을 조정해야 한다
- M7: `custom_rules`의 pattern 기반 검증 엔진이 동작해야 한다
- M8: `ignore` 규칙과 `severity_adjustments`가 finding 생성 시 적용되어야 한다
- M9: DB v13 마이그레이션: qa_scenarios.category에 'acceptance','security' 추가
- M10: DB v13 마이그레이션: qa_runs.trigger에 'post_merge' 추가 + SQL 예약어 `trigger` 컬럼 이름 충돌 해결 (백로그 W39mlIt6AP4B)
- M11: DB v13 마이그레이션: 전체 스키마 SQL 예약어 감사 — trigger 외 다른 예약어 사용 여부 점검 및 수정 (백로그 IWa-EbC8l4Hp)
- M12: agent_handoffs 테이블 추가 (agent_type, attempt, verdict, summary, changed_files, input_hash)
- M13: 하이브리드 핸드오프: 상세 리포트는 `.claude/handoff/{task_id}/` 파일, 메타데이터는 DB
- M14: handoff 파일 정리: 플랜 완료 시 자동 삭제 (`vs plan complete` 시 트리거)
- M15: QA skills 통합 — vs-qa-findings, vs-qa-scenarios, vs-qa-status를 vs-qa의 서브커맨드로 통합 (백로그 wvjKECcHWFhz)
- M16: qa-rules.yaml 검증에 Zod 스키마 도입 — 런타임 타입 안전성 확보 (백로그 nTdbKlTgKr2U)

### MUST (Phase 2 — Continuous QA Loop)

- M17: qa-seeder 에이전트: 플랜 스펙+AC에서 QA 시나리오를 사전 생성 (source='seed')
- M18: qa-shadow 에이전트: 태스크별 경량 QA (CLEAN/WARNING/ALERT 판정)
- M19: qa-shadow는 qa-rules.yaml에서 `modules.shadow: true`일 때만 실행 (기본 OFF)
- M20: wave_gates 테이블 + wave-gate 통합 검증 로직
- M21: vs-qa 델타 모드: seed/shadow/gate 통과 시나리오를 제외하고 미검증 영역만 실행
- M22: qa_scenarios.source 컬럼 추가 ('seed'|'shadow'|'wave'|'final'|'manual')

### MUST (Phase 3 — Adaptive Planner)

- M23: 이벤트 기반 watcher: vs-next/vs-exec에서 태스크 완료 시 이상 감지 로직 실행
- M24: watcher가 감지하는 트리거: assumption_violation, scope_explosion, design_flaw, complexity_exceeded, dependency_shift
- M25: plan-advisor 에이전트: 스펙 분석 + 수정안 생성 (사용자 승인 전까지 미적용)
- M26: plan_revisions 테이블: 트리거 유형, 변경 내용, 승인 상태 추적
- M27: watcher 경량화: DB에서 현재 태스크 결과 + 누적 위반 카운트만 읽기 (전체 플랜 스캔 금지)

### SHOULD

- S1: `profile` 프리셋 시스템 (web-frontend, api-server, fullstack, library, cli-tool)
- S2: `vs qa config init` 인터랙티브 설정 초기화 (프로젝트 분석 → 프로파일 추천)
- S3: shadow QA 결과를 tasks 테이블에 기록 (shadow_result 컬럼)
- S4: ac_mapping.json 출력 (tdd-implementer → verifier 명시적 계약) **→ Phase 1 Task 5에 포함**
- S5: 재검증 시 focused 모드 (테스트+빌드만 재실행, Self-Challenge 스킵) **→ Phase 1 Task 5에 포함**

### COULD

- C1: `vs qa config show` — 현재 프로젝트의 resolved 설정을 보기 좋게 출력
- C2: `vs qa config diff <plan_id>` — L0 대비 오버라이드된 항목 diff 표시
- C3: plan-advisor의 태스크 분할 자동 제안 (complexity_exceeded 시)
- C4: custom_rules에 `negative_pattern` 지원 (패턴이 없어야 정상인 규칙) **→ Phase 1 Task 2에 포함**

## Data Model

### 신규 테이블

```sql
-- v13 migration

-- 에이전트 핸드오프 추적
CREATE TABLE IF NOT EXISTS agent_handoffs (
  id           TEXT PRIMARY KEY,
  task_id      TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  plan_id      TEXT REFERENCES plans(id) ON DELETE CASCADE,
  agent_type   TEXT NOT NULL,  -- 'tdd-implementer','verifier','debugger','qa-shadow','plan-advisor'
  attempt      INTEGER NOT NULL DEFAULT 1,
  input_hash   TEXT,           -- SHA256 of key input params (중복 실행 감지)
  verdict      TEXT,           -- 'PASS','WARN','FAIL','FIX_APPLIED','BLOCKED','CLEAN','WARNING','ALERT'
  summary      TEXT,           -- 구조화된 결과 요약 (< 500 chars)
  report_path  TEXT,           -- .claude/handoff/{task_id}/{agent_type}_{attempt}.json
  changed_files TEXT,          -- JSON array
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Wave Gate 판정 기록
CREATE TABLE IF NOT EXISTS wave_gates (
  id           TEXT PRIMARY KEY,
  plan_id      TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  wave_number  INTEGER NOT NULL,
  task_ids     TEXT NOT NULL,      -- JSON array: 이 Wave에 포함된 task id 목록
  verdict      TEXT NOT NULL CHECK(verdict IN ('GREEN','YELLOW','RED')),
  summary      TEXT,
  findings_count INTEGER DEFAULT 0,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 플랜 리비전 이력
CREATE TABLE IF NOT EXISTS plan_revisions (
  id             TEXT PRIMARY KEY,
  plan_id        TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  trigger_type   TEXT NOT NULL CHECK(trigger_type IN (
    'assumption_violation','scope_explosion',
    'design_flaw','complexity_exceeded','dependency_shift'
  )),
  trigger_source TEXT,            -- 트리거한 task_id 또는 finding_id
  description    TEXT NOT NULL,
  changes        TEXT NOT NULL,   -- JSON: {added_tasks:[], modified_tasks:[], removed_tasks:[], spec_diff:""}
  status         TEXT NOT NULL DEFAULT 'proposed'
    CHECK(status IN ('proposed','approved','rejected')),
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 기존 테이블 변경 (v13)

```sql
-- qa_scenarios: category 확장 + source 컬럼 추가
-- SQLite는 CHECK 변경 불가 → 테이블 재생성 패턴 사용 (v6 선례 따름)
-- category: + 'acceptance', 'security'
-- source: 'seed' | 'shadow' | 'wave' | 'final' | 'manual' DEFAULT 'final'

-- qa_runs: trigger 확장
-- trigger: + 'post_merge'

-- plans: qa_overrides 컬럼 추가
ALTER TABLE plans ADD COLUMN qa_overrides TEXT;  -- JSON: L2 오버라이드

-- tasks: shadow_result 컬럼 추가
ALTER TABLE tasks ADD COLUMN shadow_result TEXT
  CHECK(shadow_result IN ('clean','warning','alert'));
```

### qa-rules.yaml 스키마

```yaml
# 최상위 구조
profile: string?          # 프리셋: web-frontend|api-server|fullstack|library|cli-tool
risk_thresholds:
  green: number?          # default: 0.2
  yellow: number?         # default: 0.5
  orange: number?         # default: 0.8
severity_weights:
  critical: number?       # default: 0.4
  high: number?           # default: 0.3
  medium: number?         # default: 0.2
  low: number?            # default: 0.1
regression_bonus: number? # default: 0.2
modules:
  functional: boolean?    # default: true
  integration: boolean?
  flow: boolean?
  regression: boolean?
  edge_case: boolean?
  security: 'auto'|boolean?     # default: auto
  acceptance: 'auto'|boolean?   # default: auto
  design_verification: 'auto'|boolean?
  shadow: boolean?              # default: false (Phase 2)
  wave_gate: boolean?           # default: false (Phase 2)
  adaptive_planner: boolean?    # default: false (Phase 3)
security:
  scope: 'changed_files'|'all_files'|'directory'?
  scope_directories: string[]?
  owasp_skip: string[]?         # e.g., ['A06']
  severity_overrides:
    test_files: 'downgrade_one'|'ignore'|'normal'?
    acknowledged_comment: string?  # severity to force
design:
  grid_unit: number?
  ai_slop_detection: boolean?
  responsive_breakpoints: number[]?
self_challenge:
  intensity: 'light'|'standard'|'deep'?
  error_kb: boolean?
  rules_check: boolean?
  reverse_validation: boolean?
verification_depth:
  simple: 'minimal'|'standard'|'full'?
  moderate: 'minimal'|'standard'|'full'?
  complex: 'minimal'|'standard'|'full'?
custom_rules: CustomRule[]?
ignore: IgnoreRule[]?
severity_adjustments: SeverityAdjustment[]?

# CustomRule
id: string
description: string
pattern: string           # regex
negative_pattern: string? # 이 패턴이 없으면 위반 (C4)
scope: string             # glob: "src/**/*.ts"
exclude: string?          # glob: "**/*.test.*"
severity: 'critical'|'high'|'medium'|'low'
category: string          # finding category

# IgnoreRule
finding_pattern: string?  # finding title/description 매칭
file_pattern: string?     # file path glob 매칭
reason: string
expires: string?          # ISO date, 이후 재활성화

# SeverityAdjustment
match: { category?: string, scope?: string }
adjust: 'promote_one'|'demote_one'
```

## API / Interface

### CLI 신규 명령어

```
vs qa config resolve [plan_id]
  → 출력: JSON (머지된 최종 설정)
  → 동작: L0 기본값 로드 → .claude/qa-rules.yaml 읽기(L1) → plans.qa_overrides 읽기(L2) → deepMerge
  → 에러: YAML 파싱 실패 시 L0 반환 + stderr 경고

vs qa config validate
  → 출력: 검증 결과 (warnings/errors 목록)
  → 에러 케이스: 잘못된 정규식, 범위 초과 숫자, 존재하지 않는 프로파일

vs qa config init
  → 동작: 인터랙티브 (프로젝트 분석 → 프로파일 추천 → .claude/qa-rules.yaml 생성)

vs qa config show
  → 출력: 현재 resolved 설정을 사람이 읽기 좋은 형태로

vs qa config diff [plan_id]
  → 출력: L0 대비 변경된 항목만 diff 형태로

vs wave-gate create <plan_id> --wave <n> --verdict <GREEN|YELLOW|RED> --task-ids <ids> [--summary ...]
vs wave-gate list <plan_id>

vs plan revision create <plan_id> --trigger-type <type> --trigger-source <id> --description "..." --changes '{...}'
vs plan revision list <plan_id>
vs plan revision update <id> --status <approved|rejected>

vs handoff write <task_id> --agent <type> --attempt <n> --verdict <v> --summary "..." [--report-path <path>]
vs handoff read <task_id> [--agent <type>] [--attempt <n>]
vs handoff clean <plan_id>   # 플랜의 모든 handoff 파일 삭제
```

### 에이전트 인터페이스 변경

```
모든 QA 에이전트 Phase 0 (신규):
  입력: plan_id (프롬프트에 포함)
  동작: `vs --json qa config resolve <plan_id>` 실행
  출력: resolved_config JSON → 이후 Phase에서 참조

qa-shadow (신규 에이전트):
  입력: task (title, spec, AC), impl_report_path, seed_scenarios, resolved_config
  출력: { verdict: 'CLEAN'|'WARNING'|'ALERT', findings: [...], category: 'bug'|'spec_gap'|'design_flaw' }
  모델: haiku

qa-seeder (신규 에이전트):
  입력: plan_id, plan_spec, task_list_with_AC
  출력: DB에 qa_scenarios 생성 (source='seed')
  모델: haiku

plan-advisor (신규 에이전트):
  입력: plan_id, trigger_info, original_spec, affected_tasks, current_progress
  출력: { revision: {changes, description}, options: [{label, description}] }
  모델: opus

verifier 변경:
  Phase 0 추가: config 로딩
  Phase 3.5: self_challenge.intensity에 따라 depth 조정
  re_verify_mode: 'focused' | 'full' (focused 시 Phase 1만 + 실패 AC만)
  handoff 출력: `vs handoff write` + `.claude/handoff/{task_id}/verify_{attempt}.json`

tdd-implementer 변경:
  ac_mapping.json 출력 (S4)
  handoff 출력: `vs handoff write` + `.claude/handoff/{task_id}/impl_report.json`
```

### 파일 구조

```
.claude/
  qa-rules.yaml          ← L1 프로젝트 설정 (사용자 생성, git 커밋)
  handoff/
    {task_id}/
      impl_report.json   ← tdd-implementer 출력
      verify_1.json       ← verifier 1차 결과
      debug_1.json        ← debugger 1차 시도
      verify_2.json       ← verifier 재검증 결과
      ac_mapping.json     ← AC-테스트 매핑
      shadow_result.json  ← qa-shadow 결과
```

## Edge Cases

1. **qa-rules.yaml이 없는 프로젝트**: L0 기본값만 사용, 기존과 100% 동일하게 동작. 어떤 경고도 출력하지 않음.
2. **YAML 파싱 에러**: L0 fallback + `outputError("qa-rules.yaml 파싱 실패: {에러}. 기본값을 사용합니다.")`. 에이전트는 정상 실행 계속.
3. **custom_rules의 잘못된 정규식**: `vs qa config validate`에서 사전 감지. resolve 시에는 해당 rule만 skip + 경고.
4. **plan-advisor 수정안 충돌**: 사용자가 수동으로 태스크를 수정한 후 advisor가 같은 태스크 수정을 제안하면 → 사용자 선택 우선, advisor 제안에 충돌 경고 표시.
5. **handoff 파일 누적**: 플랜 완료 시 `vs handoff clean` 자동 실행. 비정상 종료 시 `.claude/handoff/` 디렉토리가 남을 수 있음 → `vs-resume` 시 stale handoff 감지 + 정리 제안.
6. **qa-shadow ALERT이지만 plan-advisor 비활성화**: ALERT 결과만 사용자에게 표시하고, plan-advisor 없이 사용자가 직접 판단. adaptive_planner 모듈이 OFF면 watcher 로직도 실행하지 않음.
7. **DB 마이그레이션 중 기존 데이터**: qa_scenarios 테이블 재생성 시 기존 데이터 보존 (INSERT INTO _new SELECT FROM old 패턴, v6 선례).
8. **ignore 규칙의 expires 만료**: resolve 시 만료된 ignore 규칙 자동 필터링. validate 시 "곧 만료되는 ignore 규칙" 경고.

## Success Criteria

### 정량적 기준

- SC1: qa-rules.yaml이 없는 프로젝트에서 기존 테스트 스위트 100% 통과 (하위 호환성)
- SC2: `vs qa config resolve`가 L0+L1+L2를 올바르게 머지 (단위 테스트 10개 이상)
- SC3: custom_rules 패턴 매칭이 정확하게 동작 (정규식 정합성 테스트 5개 이상)
- SC4: DB v13 마이그레이션이 기존 데이터를 보존하며 적용 (마이그레이션 테스트)
- SC5: agent_handoffs 레코드가 impl→verify→debug 체인에서 올바르게 생성 (통합 테스트)
- SC6: qa-shadow 에이전트가 haiku로 30초 이내 응답 (토큰 비용 < $0.02/태스크)
- SC7: watcher 로직이 태스크당 DB 쿼리 2회 이내로 실행 (경량화 검증)

### 정성적 기준

- SC8: 기존 `/vs-next`, `/vs-qa` 명령어가 사용자 경험 변화 없이 동작
- SC9: qa-rules.yaml 작성이 직관적이고, 잘못된 설정에 명확한 에러 메시지 제공
- SC10: plan-advisor 수정안이 사용자 승인 전까지 어떤 상태도 변경하지 않음
