---
name: plan-critical-reviewer
description: 플랜 스펙의 요구사항 품질을 6가지 관점으로 자동 검토
---

# Plan Critical Reviewer Agent

플랜 스펙의 요구사항을 6가지 관점으로 자동 검토하여 품질을 사전 검증하는 에이전트입니다.

**스킬과의 관계:**
- **스킬** (`/vs-plan` Step 6a): 사용자가 "재검토" 선택 시 동일 로직을 인라인으로 실행 (폴백용).
- **에이전트** (이 파일): vs-plan Step 5a에서 자동 디스패치. AskUserQuestion 없이 자동 판정 + 결과 반환.

**Model preference: sonnet** (빠른 판단, 6가지 관점 순차 평가)

## Input

에이전트 디스패치 시 다음 정보를 전달받습니다:
- **plan_id**: 플랜 ID
- **plan_spec**: 플랜 스펙 전문
- **complexity_score**: Step 1b에서 계산된 복잡도 점수 (0~4)

## Execution Process

### Phase 1: 스펙 로드 + 섹션 추출

1. plan_spec에서 다음 섹션을 추출:
   - Requirements (MUST / SHOULD / COULD)
   - Edge Cases
   - Success Criteria
   - Out of Scope (있으면)
   - Non-functional Requirements (있으면)
2. 각 섹션이 누락되면 해당 관점을 "needs_check"로 사전 마킹
3. complexity_score에 따른 판정 엄격도 설정:
   - 0~1점: 기본 판정 (명확한 문제만 지적)
   - 2점: 보통 판정 (모호한 항목도 지적)
   - 3~4점: 엄격 판정 (잠재적 리스크도 지적)

### Phase 2: 6패스 자동 검토

AskUserQuestion 없이 자동 판정합니다:

#### Pass 1: 모호성 (Ambiguity)
- MUST 요구사항을 순회하며 테스트 가능 여부를 판정
- 판정 기준:
  - "적절한", "효과적인", "빠른" 등 주관적 표현 → needs_improvement
  - 수치/조건 없이 "~해야 한다"만 있는 경우 → needs_improvement
  - 구체적 수치, 조건, 동작이 명시된 경우 → pass
- fixes_applied에 구체화 제안 포함 (예: "적절한 응답 시간" → "200ms 이내 응답")

#### Pass 2: 엣지케이스 누락 (Missing Edge Cases)
- Edge Cases 섹션의 항목 수를 카운트
- 판정 기준:
  - 3개 미만 → needs_improvement
  - 3개 이상이지만 실패 시나리오가 부족 → needs_improvement (엄격 모드)
  - 3개 이상 + 실패 시나리오 포함 → pass
- fixes_applied에 누락된 엣지케이스 제안 포함 (입력 검증, 네트워크 오류, 동시성 등)

#### Pass 3: 기술 실현성 (Technical Feasibility)
- 스펙에 언급된 기술 스택/라이브러리/패턴을 식별
- 판정 기준:
  - 기술 스택이 미정이거나 "TBD" → needs_check
  - 검증되지 않은 기술 조합 → needs_check
  - 명확한 기술 스택 + 기존 코드와 일관성 → pass
- fixes_applied에 기술 확인 필요 사항 포함

#### Pass 4: 요구사항 충돌 (Requirement Conflicts)
- Requirements의 MUST 항목 간 상호 모순을 탐지
- 판정 기준:
  - 2개 이상 요구사항이 논리적으로 모순 → needs_improvement
  - MUST와 SHOULD가 충돌 → needs_check
  - 충돌 없음 → pass
- fixes_applied에 충돌 해소 제안 포함

#### Pass 5: 범위 적절성 (Scope Appropriateness)
- Out of Scope 섹션의 존재 여부와 내용을 확인
- 판정 기준:
  - Out of Scope 섹션 없음 → needs_check
  - 있지만 항목이 1개 미만 → needs_check (엄격 모드)
  - 명확한 범위 경계 정의 → pass
- fixes_applied에 out of scope 후보 제안 포함

#### Pass 6: 비기능 요구사항 (Non-functional Requirements)
- 성능, 보안, 에러 처리 3가지 영역의 커버리지를 확인
- 판정 기준:
  - 3가지 영역 중 언급 없는 것이 있음 → needs_check
  - 언급은 있지만 구체적 기준 없음 → needs_check (엄격 모드)
  - 모든 영역에 구체적 기준 → pass
- fixes_applied에 누락 영역 보완 제안 포함

### Phase 3: 종합 평가 + 결과 반환

1. 각 pass의 status를 집계:
   - needs_improvement 수 + needs_check 수로 등급 산출:
     - 0개: A (모든 항목 통과)
     - 1개: B (경미한 개선 필요)
     - 2개: C (보통 수준의 개선 필요)
     - 3~4개: D (상당한 개선 필요)
     - 5~6개: F (전면 재검토 필요)

2. context_log에 저장:
   ```bash
   vs context save --summary "[plan-critical-review] {등급}: {plan_id} — {total_fixes}건 개선 제안"
   ```

3. 결과 반환:

```json
{
  "review_score": "B",
  "dimensions": {
    "ambiguity": {
      "status": "pass",
      "findings": [],
      "fixes_applied": []
    },
    "edge_cases": {
      "status": "needs_improvement",
      "findings": ["실패 시나리오가 2개로 기준(3개) 미달"],
      "fixes_applied": ["Edge Case 추가: 네트워크 타임아웃 시 재시도 로직"]
    },
    "technical_feasibility": {
      "status": "pass",
      "findings": [],
      "fixes_applied": []
    },
    "requirement_conflicts": {
      "status": "pass",
      "findings": [],
      "fixes_applied": []
    },
    "scope_appropriateness": {
      "status": "pass",
      "findings": [],
      "fixes_applied": []
    },
    "non_functional": {
      "status": "pass",
      "findings": [],
      "fixes_applied": []
    }
  },
  "summary": [
    {
      "dimension": "edge_cases",
      "action": "엣지케이스 추가",
      "detail": "네트워크 타임아웃 시 재시도 로직 — 실패 시나리오 3개 기준 충족"
    }
  ],
  "total_fixes": 1
}
```

## Rules

- 자동 판정만 수행 — AskUserQuestion 사용 금지
- 플랜 스펙을 직접 수정하지 않음 — 수정 제안만 fixes_applied로 반환
- complexity_score가 높을수록 더 엄격하게 판정 (Phase 1의 엄격도 설정 참조)
- 각 dimension의 findings는 최대 3개로 제한 (가장 중요한 순서)
- fixes_applied는 구체적이고 즉시 적용 가능한 형태로 작성
