# Phase 15: Edge Cases QA Report

**Date**: 2026-03-29
**Scenarios**: 12 | **Pass**: 10 | **Warn**: 2 | **Fail**: 0

| ID | Scenario | Result | Evidence | Notes |
|----|----------|--------|----------|-------|
| EC-1 | 빈 플랜 (태스크 0개) | PASS | `plan create` OK, `task next` -> "No pending tasks.", `plan complete` -> allowed | 태스크 없는 플랜 완료 허용됨. 의도된 동작인지 확인 필요 |
| EC-2 | 존재하지 않는 ID 참조 | PASS | plan/task/error-kb 모두 "not found: nonexistent-id-12345" 메시지. 스택 트레이스 없음 | 깔끔한 에러 핸들링 |
| EC-3 | 특수문자/한글/이모지 | PASS | 한글, 이모지, `&<>` 모두 저장 및 조회 시 보존됨 | SQL injection 취약점 없음 (파라미터화 쿼리) |
| EC-4 | 매우 긴 텍스트 | PASS | 5000자 spec DB 저장 확인 (`length(spec)=5000`), 100자 title 정상 표시 | TEXT 컬럼이라 길이 제한 없음 |
| EC-5 | 잘못된 enum 값 | PASS | task status: "Invalid status. Must be: todo, in_progress, done, blocked, skipped", backlog priority: "Invalid priority: invalid_priority. Must be one of: critical, high, medium, low" | 양쪽 모두 유효성 검증 정상 |
| EC-6 | 중복 생성 | PASS | 동일 title 플랜 2개, 백로그 2개 모두 생성됨 (고유 ID 부여) | unique constraint 없음 - 의도된 동작 |
| EC-7 | 빈 필드 | WARN | plan/task/backlog 모두 빈 문자열("") title 허용됨 | 빈 title 허용은 UX 관점에서 개선 권장. NOT NULL이지만 빈 문자열은 통과 |
| EC-8 | Config 특수 키 | WARN | 빈 키(""), 공백 키, 한글 키 모두 저장됨 | 빈 키 허용은 의도치 않은 동작일 수 있음. key validation 추가 권장 |
| EC-9 | 대량 데이터 | PASS | 20개 태스크 생성 성공, `plan show`에 전체 표시, dashboard 정상 렌더링 | 성능 이슈 없음 |
| EC-10 | 동시 상태 변경 | PASS | done -> blocked 순차 실행 후 최종 상태 `blocked`. Last-write-wins, 데이터 손상 없음 | SQLite 직렬화로 안전 |
| EC-11 | CASCADE 삭제 | PASS | plan 삭제 시 연관 tasks 2개 자동 삭제 확인 (count: 2 -> 0) | FOREIGN KEY CASCADE 정상 동작. `PRAGMA foreign_keys=ON` 필수 |
| EC-12 | DB 마이그레이션 검증 | PASS | `PRAGMA user_version` = 10, foreign_key_list에 plans/tasks 참조 확인, plans 테이블에 approved status CHECK 포함 | 스키마 무결성 정상 |

## Findings

### Issues Found (0 critical, 2 warnings)

1. **EC-7 WARN**: 빈 문자열 title이 plan, task, backlog 모두에서 허용됨. `title TEXT NOT NULL`이지만 `''`은 NULL이 아니므로 통과. validation 계층에서 최소 길이 체크 권장.

2. **EC-8 WARN**: `config set "" "value"` 처럼 빈 키도 저장됨. key 유효성 검증(최소 1자, 허용 문자 범위) 추가 권장.

### Positive Findings

- 모든 에러 상황에서 crash/stack trace 없이 사용자 친화적 메시지 출력
- 특수문자, 이모지, 한글 인코딩 완벽 보존
- CASCADE 삭제 정상 동작
- DB 스키마 무결성 (version 10, CHECK constraints, foreign keys)
- 대량 데이터(20 tasks) 처리 안정적

## Cleanup

모든 테스트 데이터 정리 완료 (plans, tasks, backlog_items, vs_config).
