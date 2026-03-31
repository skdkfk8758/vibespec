---
name: self-improve-review
description: "Review and clean up self-improve rules."
invocation: user
---

# Self-Improve Review

축적된 self-improve 규칙의 효과를 분석하고, 불필요한 규칙을 정리하여 규칙 품질을 유지합니다.

## When to Use

- SessionStart에서 "활성 규칙이 30개 상한을 초과했습니다" 경고가 나왔을 때
- 정기적으로 규칙 효과를 검토하고 싶을 때
- 유사한 규칙이 많아져서 통합이 필요할 때
- Trigger keywords: "self-improve-review", "규칙 정리", "규칙 리뷰", "rule cleanup"

## Steps

### Phase 1: 현재 상태 조회

1. Bash 도구로 규칙 현황을 조회하세요:
   ```bash
   vs self-improve status --json
   vs self-improve rules list --json
   ```

2. 활성 규칙이 0개이면 "정리할 규칙이 없습니다"라고 알리고 종료하세요

### Phase 2: 효과 분석

각 활성 규칙에 대해:

1. **효과성 계산**: `prevented / (prevented + occurrences)`
   - 0.6 이상: 효과적 (유지)
   - 0.2~0.6: 보통 (검토 필요)
   - 0.2 미만: 비효과적 (아카이브 후보)

2. **활동성 확인**: `last_triggered_at`과 현재 날짜 차이
   - 30일+ 미트리거: 비활성 (아카이브 후보)

3. 결과를 테이블로 정리:
   ```
   | ID | 제목 | 카테고리 | 효과성 | 마지막 트리거 | 판정 |
   |-----|------|----------|--------|--------------|------|
   | ... | ... | ... | 0.4 | 2026-03-10 | 검토 |
   ```

### Phase 3: 유사 규칙 탐지

1. `.claude/rules/` 디렉토리의 모든 활성 규칙 파일을 읽으세요
2. 같은 `category`를 가진 규칙들을 그룹핑하세요
3. 같은 카테고리 내에서 `## Applies When` 내용이 유사한 규칙을 찾으세요
4. 유사 규칙 쌍을 제시하고 통합을 제안하세요:
   ```
   ### 유사 규칙 발견
   - [logic_error-null-check-api.md] + [logic_error-null-check-db.md]
     → 통합 제안: "외부 데이터 소스(API/DB) null check 규칙"으로 병합
   ```

### Phase 4: 정리 제안

수집된 분석 결과를 바탕으로 다음을 제안하세요:

1. **아카이브 후보** (비효과적 + 비활성):
   ```
   ### 아카이브 제안
   - {id}: {제목} (효과성: 0.1, 45일 미트리거)
   ```

2. **통합 후보** (유사 규칙):
   ```
   ### 통합 제안
   - {id1} + {id2} → 새 규칙: {통합 제목}
   ```

3. **상한 초과 시 우선 아카이브 대상**:
   - 효과성이 가장 낮은 순서로 초과분만큼 아카이브 제안

### Phase 5: 사용자 확인 후 실행

`AskUserQuestion`으로 제안을 확인받으세요:
- "모두 적용": 제안된 아카이브/통합을 모두 실행
- "선택 적용": 개별 항목 선택
- "취소": 변경 없음

아카이브 실행:
```bash
vs self-improve rules archive <id>
```

통합 실행:
1. 두 규칙 파일의 내용을 합쳐 새 규칙 파일 생성
2. 기존 두 규칙을 아카이브

### Phase 6: 결과 요약

```
## Self-Improve Review 결과

### 분석
- 전체 규칙: {N}개 (active: {N}, archived: {N})
- 효과적: {N}개 / 보통: {N}개 / 비효과적: {N}개

### 실행된 작업
- 아카이브: {N}건
- 통합: {N}건
- 변경 없음: {N}건

### 현재 상태
- 활성 규칙: {N}개 / 상한: 30개
```

## 다음 단계

- → `/self-improve`로 새 pending 처리
- → `vs self-improve status`로 현황 확인
- → `/vs-dashboard`로 전체 프로젝트 현황
