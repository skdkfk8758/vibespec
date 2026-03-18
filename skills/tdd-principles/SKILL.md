---
name: tdd-principles
description: "TDD 원칙 참조 스킬. RED-GREEN-REFACTOR 사이클, 테스트 작성 패턴(AAA), 테스트 네이밍 컨벤션, TDD 적합성 판단 기준을 제공합니다. vs-next, tdd-implementer가 참조합니다."
type: domain
---

# Test-Driven Development (TDD)

테스트를 먼저 작성하고, 테스트를 통과하는 최소 코드를 구현한 뒤, 코드를 정리하는 개발 사이클. 구현의 정확성을 테스트가 보장하고, 리팩토링의 안전망 역할을 한다.

## Domain Context

**Test-Driven Development**(Kent Beck, *Test-Driven Development: By Example*, 2002)는 소프트웨어 개발의 피드백 루프를 극단적으로 짧게 만드는 방법론이다. "동작하는 깔끔한 코드(clean code that works)"를 목표로 하되, 두 가지를 분리한다:

1. **동작하게 만들기** (GREEN) — 어떤 수단이든 테스트를 통과시킨다
2. **깔끔하게 만들기** (REFACTOR) — 통과한 테스트를 유지하며 코드를 정리한다

SDD가 "무엇을 만들지"를 정의하면, TDD는 "제대로 만들어졌는지"를 검증한다. SDD의 Acceptance Criteria가 TDD의 테스트 케이스로 직접 변환된다.

### Key Principles

1. **테스트가 코드에 선행한다.** 구현 코드를 한 줄도 작성하기 전에 실패하는 테스트를 먼저 쓴다. 테스트 없이 코드를 쓰면 "무엇이 동작하는지"의 정의가 없다.

2. **한 번에 하나만 실패시킨다.** 여러 테스트를 한꺼번에 작성하지 않는다. 하나의 실패 → 하나의 구현 → 통과 → 다음 실패로 진행한다.

3. **최소한으로 구현한다.** GREEN 단계에서는 "좋은 코드"가 아니라 "통과하는 코드"를 목표로 한다. 과잉 설계를 방지한다.

4. **테스트를 수정하지 않는다.** GREEN에서 테스트가 실패하면 구현 코드를 고친다. 테스트를 고치는 것은 요구사항을 바꾸는 것이다.

5. **리팩토링은 별도 단계다.** 동작을 변경하지 않고 구조만 개선한다. 리팩토링 중 테스트가 깨지면 동작이 변경된 것이다.

## RED-GREEN-REFACTOR 사이클

### RED — 실패하는 테스트 작성

목적: 구현할 동작을 테스트로 정의한다.

1. Acceptance Criteria에서 하나의 검증 대상을 선택한다
2. 해당 동작을 검증하는 테스트를 작성한다
3. 테스트를 실행하여 **반드시 실패**함을 확인한다
4. 실패 메시지가 "누락된 기능"을 명확히 설명하는지 확인한다

### GREEN — 최소 구현

목적: 테스트를 통과하는 가장 단순한 코드를 작성한다.

1. 테스트를 통과하기 위한 **최소한의** 코드를 작성한다
2. 모든 테스트(기존 + 신규)를 실행하여 통과를 확인한다
3. 기존 테스트가 깨졌다면 구현 코드를 수정한다 (기존 테스트를 삭제하지 않는다)

### REFACTOR — 코드 정리

목적: 동작을 유지하며 코드 품질을 개선한다.

1. 중복 제거, 네이밍 개선, 적절한 추상화 추출
2. **매 수정마다** 테스트를 실행하여 통과를 확인한다
3. 새로운 기능을 추가하지 않는다 — 기능 추가는 다음 RED에서

## 테스트 작성 패턴

### AAA 패턴 (Arrange / Act / Assert)

모든 테스트는 세 부분으로 구성한다:

- **Arrange**: 테스트 데이터, mock, fixture 준비
- **Act**: 테스트 대상 함수/메서드를 **한 번만** 호출
- **Assert**: 기대 결과를 검증. 하나의 테스트에 하나의 논리적 assert

### 테스트 네이밍 컨벤션

test_<무엇을>_<언제/조건>_<기대결과>

예시:
- test_createPlan_withValidSpec_returnsPlanWithActiveStatus
- test_taskUpdate_whenAlreadyDone_throwsInvalidTransitionError

## TDD 적합성 판단 기준

### TDD 적합 (vs-next → tdd-implementer 에이전트 디스패치)

| 태스크 유형 | 이유 |
|------------|------|
| 함수/유틸리티 구현 | 입출력이 명확, 단위 테스트 용이 |
| API 엔드포인트/MCP 도구 | 요청-응답 패턴으로 테스트 가능 |
| 서비스/비즈니스 로직 | 규칙 기반 동작, 엣지 케이스 검증 필요 |
| 데이터 처리/변환 | 입력 데이터 → 출력 데이터 검증 |
| 모델/CRUD 연산 | DB 상호작용 검증 가능 |

### TDD 부적합 (vs-next → 직접 구현)

| 태스크 유형 | 이유 |
|------------|------|
| 환경 설정/CI 구성 | 테스트 인프라 자체를 만드는 작업 |
| DB 마이그레이션/스키마 변경 | DDL은 테스트보다 실행 후 확인이 적합 |
| UI 스타일링/레이아웃 | 시각적 결과물, 자동 테스트 어려움 |
| 문서 작성 | 텍스트 품질은 테스트 대상 아님 |
| 의존성 업데이트 | 기존 테스트 통과 확인만으로 충분 |

## 참고자료

- Kent Beck — *Test-Driven Development: By Example*
- Martin Fowler — *Refactoring: Improving the Design of Existing Code*
- Robert C. Martin — *Clean Code*
- Gerard Meszaros — *xUnit Test Patterns*
