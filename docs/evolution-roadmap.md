# VibeSpec 자가진화 시스템 도입 로드맵

> Memory Bank 프로젝트 분석 + 5개월 하네스 운영 경험 기반
> 작성일: 2026-03-31

---

## 현황 진단: VibeSpec Self-Improve 파이프라인

```
현재 구현된 흐름:
fix: 커밋 → [hook] self-improve-trigger.sh → pending JSON 생성
                                                    ↓
SessionStart → [hook] self-improve-status.sh → "대기 N건" 알림
                                                    ↓
사용자가 /self-improve 수동 실행 → LLM이 pending 분석 → 규칙 생성
                                                    ↓
커밋 시 → [hook] pre-commit-rule-check.sh → "이런 규칙 있어요" 리마인드 (exit 0)

빠진 것:
1. pending → 규칙 생성이 수동 (/self-improve 호출 필요)
2. 규칙 위반 시 차단 없음 (exit 0 = 정보성, exit 2 아님)
3. 규칙 효과 측정 없음 → SOFT/HARD 에스컬레이션 없음
4. 사용자 불만 캡처 없음 ("왜이래", "또 이래" 감지 없음)
5. Error KB → Rule 자동 승격 없음 (error_kb_id 필드 존재하나 미활용)
```

---

## Phase 0: 자가진화 루프 완성 (Self-Improve 강화)

> **목표:** "fix: 커밋 → 자동 규칙 생성 → 위반 시 차단"까지 무인 동작

### P0-1. Pending → 규칙 자동 생성 (현재 수동 → 자동)

**현재:** pending JSON이 쌓이지만 `/self-improve` 수동 호출 필요
**개선:** SessionStart에서 pending 3건 이상이면 자동 처리

```
변경 대상: hooks/self-improve-status.sh
현재: "대기 N건, /self-improve로 규칙을 생성하세요" (알림만)
개선: pending ≥ 3건이면 자동으로 vibespec self-improve process 실행
      또는 additionalContext에 "자동 처리 시작" 플래그 전달

대안: PostToolUse(Bash) hook에서 fix: 커밋 직후 즉시 처리
      → pending 쌓이는 단계 자체를 건너뜀
```

- 난이도: 중
- 영향도: **최상** — 이게 없으면 나머지가 전부 수동

### P0-2. 규칙 SOFT/HARD 등급 체계 + exit 2 강제 집행

**현재:** pre-commit-rule-check.sh는 `exit 0` (정보성 리마인드만)
**개선:** 규칙에 enforcement level 추가

```markdown
# 규칙 파일 (.claude/rules/fix-missing-await.md) 포맷 확장

---
Applies When: **/*.ts
Enforcement: SOFT          # SOFT = additionalContext 경고, HARD = exit 2 차단
Violations: 3              # 위반 횟수 추적
Escalation: 30d            # 30일 경과 + violations ≥ 3이면 HARD로 자동 승격
Created: 2026-03-15
---

NEVER DO: async 함수에서 await 없이 Promise 반환
WHY: 3번의 fix 커밋에서 동일 패턴 반복
```

```
변경 대상: hooks/pre-commit-rule-check.sh
현재: 매칭 규칙 → additionalContext로 리마인드 → exit 0
개선: Enforcement 파싱 추가
      SOFT → 기존대로 additionalContext (exit 0)
      HARD → exit 2 (하네스 레벨 차단, AI 우회 불가)
```

- 난이도: 중
- 영향도: **최상** — "알아서 강해지는" 핵심. 하네스 레벨 차단은 AI가 우회할 방법 없음

### P0-3. 규칙 효과 측정 + 자동 에스컬레이션

**현재:** SelfImproveRule에 `occurrences`(위반), `prevented`(방지) 필드 존재하나 업데이트 로직 없음
**개선:**

```
위반 감지 시: occurrences += 1, last_triggered_at 업데이트
차단 성공 시: prevented += 1

에스컬레이션 로직 (SessionStart 또는 별도 cron):
  IF rule.enforcement == SOFT
     AND age(rule.created_at) >= 30d
     AND rule.occurrences >= 3
     AND rule.prevented == 0  # 경고만으로 효과 없음
  THEN → HARD로 자동 승격, 규칙 파일 Enforcement 라인 업데이트
```

- 난이도: 중
- 영향도: 높음 — 30일 관찰 후 자동 강화. "경고 무시하면 차단"

### P0-4. 사용자 불만 자동 캡처

**현재:** 없음
**개선:** PostToolUse(Bash) 또는 UserPromptSubmit hook에서 불만 패턴 감지

```
감지 패턴:
  "왜이래", "또 이래", "이거 또야", "아 또", "왜 또",
  "이미 말했잖아", "몇 번째야", "같은 실수"

감지 시:
  → .claude/self-improve/frustrations/ 디렉토리에 기록
  → 직전 AI 응답 + 컨텍스트 포함
  → /self-improve 실행 시 frustrations도 함께 분석
```

- 난이도: 낮
- 영향도: 중간 — fix 커밋 이전에 불만이 먼저 나오므로 선행 지표로 활용

---

## Phase 1: 지식 검색 고도화 (Memory Bank에서 차용)

> **목표:** "있는데 못 찾는" 문제 해결

### P1-1. Error KB 벡터 시맨틱 검색

**현재:** ErrorKBEngine.search()가 텍스트 매칭 (toLowerCase includes)
**문제:** "배포 실패"로 검색 → "deploy failure"로 기록된 에러 미검출

```
도입 기술 (Memory Bank 동일 스택):
  - sqlite-vec 0.1.x (SQLite 벡터 확장)
  - @xenova/transformers (all-MiniLM-L6-v2, 384차원, 로컬)

변경 대상: src/core/engine/error-kb.ts
  - add() 시 title + cause + solution 텍스트를 임베딩 → DB 저장
  - search() 시 query 임베딩 → 벡터 유사도 검색 + 기존 텍스트 검색 하이브리드

스키마 추가 (schema.ts):
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_errors USING vec0(
    embedding float[384]
  );
  ALTER TABLE error_entries ADD COLUMN embedding_id INTEGER;
```

- 난이도: 중
- 영향도: 높음 — Error KB가 100건 이상 쌓이면 텍스트 검색만으론 한계
- 의존성: 없음 (독립 도입 가능)

### P1-2. QA Findings → Self-Improve 자동 연계

**현재:** QA findings (qa_findings 테이블)와 self-improve가 분리됨
**개선:** 반복 findings 패턴 감지 → pending 자동 생성

```
트리거: QA run 완료 시 (qa_runs.status = 'completed')
로직:
  1. 최근 3개 run에서 동일 category + 유사 description의 finding 검색
  2. 3회 이상 반복 → self-improve pending JSON 자동 생성
  3. type: "recurring_qa_finding"으로 구분

변경 대상: 새 hook 또는 vs-qa 스킬 후처리
```

- 난이도: 낮
- 영향도: 중간 — QA에서 발견된 패턴이 규칙으로 자동 전환

### P1-3. Error KB 중복 감지 (Consolidation)

**현재:** 같은 에러를 다른 표현으로 중복 등록 가능
**개선:** Memory Bank의 consolidation 패턴 적용

```
add() 호출 시:
  1. 새 엔트리의 임베딩과 기존 전체 비교
  2. 유사도 ≥ 0.85 → "이미 유사한 에러가 있습니다" 경고 + 기존 엔트리 표시
  3. 사용자가 병합 선택 시 → occurrence 증가 + solution 보강
  4. 자동 모드 (hook에서 호출 시) → 자동 병합

의존성: P1-1 (벡터 검색) 선행 필요
```

- 난이도: 중
- 영향도: 중간 — KB 크기가 커질수록 가치 증가

---

## Phase 2: 자동 학습 확장

> **목표:** fix 커밋 외에도 성공/실패 모든 신호에서 학습

### P2-1. 태스크 완료 시 패턴 자동 추출

**현재:** task_metrics에 duration, status, files_changed 등 수치만 기록
**개선:** 완료된 태스크의 diff에서 "이 프로젝트에서 반복되는 구현 패턴" 추출

```
트리거: 태스크 status → done 전환 시
처리:
  1. git diff로 변경 내용 수집
  2. LLM (Haiku)으로 패턴 추출:
     - "이 변경에서 반복되는 코딩 패턴은?"
     - "향후 유사 태스크에서 재사용할 수 있는 결정은?"
  3. 추출된 패턴 → Error KB가 아닌 별도 "Pattern KB"에 저장
     (또는 Error KB의 category 확장: pattern, decision 추가)

비용 고려: Haiku 호출이 태스크당 1회 → 월 비용 추정 필요
```

- 난이도: 중
- 영향도: 중간 — "에러에서만 배운다 → 성공에서도 배운다"로 전환

### P2-2. Error KB 카테고리 확장 (Fact System 방식)

**현재:** Error KB 카테고리가 암묵적 (tags로만 분류)
**개선:** Memory Bank의 fact category 체계 차용

```
현재 Error KB:  title, cause, solution, tags, severity
확장:
  category: error | decision | preference | pattern | constraint
  scope: project | global

이점:
  - "이 프로젝트에서는 Zustand 사용" (decision, project scope)
  - "절대 any 타입 쓰지 마" (constraint, global scope)
  - Error와 Knowledge를 하나의 KB에서 통합 관리
```

- 난이도: 낮 (스키마 변경 + UI 확장)
- 영향도: 중간

---

## Phase 3: 고급 지식 시스템 (선택적)

> **목표:** 축적된 지식의 활용도 극대화. 데이터가 충분히 쌓인 후 검토

### P3-1. `vs-ask` — 프로젝트 전문가 질문 스킬

**Memory Bank의 ask_avatar 패턴 차용:**

```
사용자: "이 프로젝트에서 상태관리 어떻게 하나?"

처리:
  1. 질문 임베딩 → Error KB + Pattern KB 벡터 검색
  2. QA findings + task_metrics에서 관련 히스토리 수집
  3. LLM으로 grounded answer 생성 (source citation 포함)
  4. confidence score 반환

의존성: P1-1 (벡터 검색) + P2-1 (패턴 추출) 선행 필요
```

- 난이도: 높
- 영향도: 중간 — "축적된 지식에 질문하는" 인터페이스

### P3-2. Cross-Plan Insights

**현재:** InsightsEngine이 단일 프로젝트 내 태스크 통계만 분석
**개선:** 완료된 플랜 간 비교 분석

```
"이전 플랜에서 비슷한 태스크가 blocked된 이유는?"
"유사 스펙의 플랜이 평균 몇 개 태스크로 분해되었나?"

구현: plan_metrics 뷰 + 벡터 검색 (spec 텍스트 임베딩 비교)
```

- 난이도: 높
- 영향도: 낮~중간

### P3-3. 온톨로지 분류 (Domain → Category → Fact)

**판단:** Error KB가 500건 이상 축적되기 전에는 과잉 설계.
현재 tags 시스템으로 충분. 데이터 규모가 커지면 재검토.

---

## 도입하지 않는 것 (명확한 이유 포함)

| 항목 | 이유 |
|------|------|
| 대화 아카이빙 파이프라인 | VibeSpec은 이미 구조화된 데이터(plans, tasks, QA) 보유. 비정형 대화 파싱은 불필요 |
| 3D Knowledge Graph 시각화 | CLI 워크플로우와 불일치. vs-dashboard 터미널 UI로 충분 |
| JSONL 파서 / 세션 동기화 | Memory Bank 고유 기능. VibeSpec의 데이터 소스와 무관 |
| Cross-Project DB | 프로젝트별 vibespec.db 격리가 더 안전. 글로벌 DB는 복잡도만 증가 |

---

## 전체 로드맵 요약

```
Phase 0 — 자가진화 루프 완성 (최우선)
  ├── P0-1. Pending → 규칙 자동 생성          [수동→자동]
  ├── P0-2. SOFT/HARD 등급 + exit 2 강제 집행  [경고→차단]
  ├── P0-3. 효과 측정 + 자동 에스컬레이션       [30일 무효→HARD]
  └── P0-4. 사용자 불만 자동 캡처              [선행 지표]

Phase 1 — 지식 검색 고도화
  ├── P1-1. Error KB 벡터 시맨틱 검색          [있는데 못찾는 해결]
  ├── P1-2. QA Findings → Self-Improve 연계    [반복 이슈 자동 규칙화]
  └── P1-3. Error KB 중복 감지                 [P1-1 의존]

Phase 2 — 자동 학습 확장
  ├── P2-1. 태스크 완료 시 패턴 자동 추출       [성공에서도 학습]
  └── P2-2. Error KB 카테고리 확장             [error→knowledge 통합]

Phase 3 — 고급 지식 시스템 (선택적)
  ├── P3-1. vs-ask 프로젝트 전문가 스킬        [P1-1 + P2-1 의존]
  ├── P3-2. Cross-Plan Insights               [플랜 간 비교]
  └── P3-3. 온톨로지 분류                     [500건 이상 시 검토]
```

### 핵심 원칙

1. **규칙은 미리 쓰지 않는다** — 실수에서 자동으로 배운다
2. **경고는 임시, 차단이 최종** — SOFT → HARD 에스컬레이션
3. **하네스 레벨 집행** — exit 2는 AI가 우회할 수 없다
4. **실패뿐 아니라 성공에서도 학습** — fix 커밋 + 완료 태스크 모두 분석
5. **구조화된 데이터 우선** — 비정형 대화 아카이빙보다 plans/tasks/QA가 낫다
