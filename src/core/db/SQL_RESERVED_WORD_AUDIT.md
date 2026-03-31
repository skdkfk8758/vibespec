# SQL 예약어 감사 결과

**감사일**: 2026-03-31
**대상**: src/core/db/schema.ts (v11 마이그레이션 시점)

## 발견된 예약어 컬럼

| 테이블 | 컬럼명 | SQL 예약어 | 조치 |
|--------|--------|------------|------|
| `qa_runs` | `trigger` | YES (CREATE TRIGGER 구문) | v11에서 큰따옴표 이스케이프 `"trigger"` 적용 |
| `vs_config` | `value` | YES (VALUES 절과 혼동 가능) | 현재 문제 없이 동작. 단순 KV 테이블이므로 미조치 |

## 감사 범위

전체 테이블: plans, tasks, events, context_log, task_metrics, skill_usage, vs_config,
backlog_items, qa_runs, qa_scenarios, qa_findings, merge_reports, self_improve_rules,
agent_handoffs, wave_gates, plan_revisions

## 결론

- `trigger`: v11 마이그레이션에서 테이블 재생성하여 해결
- `value`: 리스크 낮음, 향후 필요 시 마이그레이션에서 처리
- 그 외 컬럼: 예약어 충돌 없음
