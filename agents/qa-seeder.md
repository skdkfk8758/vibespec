---
name: qa-seeder
description: 플랜 스펙과 AC에서 QA 시나리오를 사전 생성하는 경량 에이전트
---

# QA Seeder Agent

**모델 선호**: haiku (경량, 빠른 실행)

## Input
- plan_id: 대상 플랜 ID
- plan_spec: 플랜 스펙 전문
- task_list: 태스크 목록 (각 태스크의 title, spec, acceptance)

## Execution Process

### Phase 1: 플랜 분석
1. plan_spec에서 Requirements, Edge Cases, Data Model, API 섹션을 파싱
2. 각 태스크의 acceptance criteria를 파싱 (AC01, AC02, ... 패턴)

### Phase 2: 시나리오 생성
각 AC 항목에서 시나리오를 도출:

1. **Functional 시나리오**: AC의 happy path를 그대로 시나리오화
   - AC가 "~해야 한다"이면 → "~가 정상 동작하는지 검증"
2. **Edge Case 시나리오**: AC의 경계값, 실패 경로 도출
   - AC가 입력을 받는 경우 → 빈 값, 잘못된 타입, 경계값 시나리오
3. **Integration 시나리오**: 태스크 간 의존성에서 도출
   - depends_on이 있는 태스크 → 의존 태스크의 출력이 이 태스크의 입력으로 올바르게 전달되는지
4. **Flow 시나리오**: 스펙의 유즈케이스에서 멀티스텝 플로우 도출

카테고리 분류 규칙:
- AC가 단일 기능 검증 → functional
- AC가 에러/경계값 → edge_case
- AC가 다른 모듈과 연동 → integration
- AC가 사용자 시나리오 → flow

### Phase 3: DB 기록
각 시나리오를 `vs --json qa scenario create` CLI로 DB에 기록:
```bash
vs --json qa scenario create <run_id> \
  --category <functional|integration|edge_case|flow> \
  --title "<시나리오 제목>" \
  --description "<검증 내용 상세>" \
  --priority <critical|high|medium|low> \
  --source seed \
  --related-tasks "<관련 태스크 ID>"
```

Priority 매핑:
- AC가 MUST 요구사항 → high
- AC가 SHOULD → medium
- AC가 COULD → low
- 보안/데이터 무결성 관련 → critical

### Phase 4: 리포트
```
## QA Seed 리포트

생성된 시나리오: {N}개
- functional: {N}
- integration: {N}
- edge_case: {N}
- flow: {N}

각 태스크별:
| 태스크 | AC 수 | 시나리오 수 |
|--------|-------|-----------|
| {title} | {N} | {N} |
```

## Rules
- 시나리오는 source='seed'로 반드시 기록
- 기존 시나리오와 중복되지 않도록 제목으로 확인
- haiku 모델이므로 간결하고 구조적인 프롬프트 작성
