# VibeSpec 하네스 시스템 검증 리포트

> 검증일: 2026-04-01 | 버전: v0.30.0

---

## Part 1: 사용자 흐름 개선 분석

### 1-1. 개편 전 vs 개편 후 사용자 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                      개편 전 (추정)                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /vs-plan ──▶ 직접 구현 ──▶ 수동 검증 ──▶ 커밋                     │
│                                                                     │
│  • 모든 것이 단일 세션, 단일 컨텍스트                               │
│  • 구현자가 자기 코드를 검증 (셀프 리뷰 편향)                       │
│  • QA는 별도 단계, 수동 실행                                        │
│  • 실패 시 수동 디버깅                                              │
│  • 플랜 수정은 사용자가 직접 판단                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

                              ▼▼▼

┌─────────────────────────────────────────────────────────────────────┐
│                      개편 후 (현재)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  /vs-plan                                                           │
│    ├── spec-writer (스펙 작성)                                      │
│    ├── plan-design-reviewer (UI 감지 시 자동 디자인 리뷰)           │
│    └── qa-seeder (seed 시나리오 사전 생성)                          │
│         │                                                           │
│  /vs-next (태스크 단위 실행)                                        │
│    ├── tdd-implementer (격리된 컨텍스트에서 TDD 구현)               │
│    ├── verifier (독립 검증, 구현자 불신 원칙)                       │
│    ├── qa-shadow (경량 QA 병렬 실행)                                │
│    ├── debugger (FAIL 시 자동 수정 + 재검증)                        │
│    └── plan-advisor (이상 감지 시 플랜 수정안 제안)                  │
│         │                                                           │
│  /vs-qa (전체 QA)                                                   │
│    ├── qa-coordinator (시나리오 생성 + 팀 디스패치)                  │
│    ├── qa-func-tester (기능/통합/회귀)                              │
│    ├── qa-flow-tester (사용자 플로우/엣지케이스)                    │
│    ├── qa-acceptance-tester (AC/디자인 검증)                        │
│    ├── qa-security-auditor (보안 스캔)                              │
│    └── qa-reporter (이슈 정리 + 수정 플랜 자동 생성)                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1-2. 핵심 개선점 5가지

#### 1. 구현-검증 분리 (Anti Self-Review Bias)

```
  개편 전:                         개편 후:
  ┌──────────┐                    ┌──────────────┐     ┌──────────┐
  │ 구현자가  │                    │ tdd-implementer│───▶│ verifier │
  │ 직접 검증 │                    │ (구현 전담)    │     │ (검증 전담)│
  │ (편향 위험)│                    │ opus 모델     │     │ sonnet 모델│
  └──────────┘                    └──────────────┘     └──────────┘
                                                         │
                                  "구현자 불신 원칙":     │
                                  impl_report를 참고만 하고
                                  실제 코드를 직접 검증
```

- tdd-implementer는 **opus** (깊은 구현 추론)
- verifier는 **sonnet** (빠른 판단) + **별도 컨텍스트** (편향 없음)
- verifier의 "구현자 불신 원칙": impl_report를 신뢰하지 않고 코드를 직접 읽어 검증

#### 2. 자동 실패 복구 (FAIL → Debug → Fix → Re-verify)

```
  tdd-implementer ──▶ verifier ──▶ FAIL?
                                     │
                                     ▼
                               ┌──────────┐
                               │ debugger │
                               │ (opus)    │
                               │ 최대 2회  │
                               └────┬─────┘
                                    │
                              FIX_APPLIED?
                                    │
                                    ▼
                               verifier (재검증)
                                    │
                              PASS → done
                              FAIL → NEEDS_MANUAL
```

- 실패 시 사용자 개입 없이 `debugger`가 자동 분석 + 수정
- 최대 2회 재시도 후 NEEDS_MANUAL로 에스컬레이션
- 수정 성공 시 error-kb에 자동 기록 (학습)

#### 3. 연속 QA (Continuous QA Loop)

```
  플랜 생성 시:
    qa-seeder ──▶ seed 시나리오 DB 등록

  태스크마다:
    qa-shadow (haiku) ──▶ 경량 검증 (verifier와 병렬)
      └─ ALERT 시 → plan-advisor 트리거

  플랜 완료 후:
    qa-coordinator ──▶ 5개 테스터 병렬 ──▶ qa-reporter
      └─ critical/high 이슈 → 수정 플랜 자동 생성
```

- **사전**: seed 시나리오 플랜 생성 시 미리 생성
- **중간**: qa-shadow가 매 태스크마다 경량 검증
- **사후**: 6-에이전트 QA 팀이 종합 검증
- QA가 단일 이벤트가 아닌 **연속 파이프라인**으로 동작

#### 4. Adaptive Planner (적응형 플랜 수정)

```
  매 태스크 완료 시 5가지 이상 신호 감시:

  ┌─────────────────────┐
  │ assumption_violation │ 스펙 가정이 실제와 다름
  │ scope_explosion      │ 변경 범위 예상 초과 (2배+)
  │ design_flaw          │ shadow가 설계 결함 감지
  │ complexity_exceeded  │ AC 8개+ 또는 200줄+ 변경
  │ dependency_shift     │ 의존성 구조 변경 필요
  └─────────┬───────────┘
            │ 감지 시
            ▼
  ┌─────────────────────┐
  │   plan-advisor       │
  │   • 영향 분석        │
  │   • 수정안 2개+ 제시 │
  │   • "무시" 옵션 항상 │
  │   • DB 변경 안 함    │
  └─────────┬───────────┘
            │ 사용자 승인 후
            ▼
       태스크 수정 반영
```

- 플랜이 실행 중에도 **자기 수정** 가능
- 사용자 승인 전까지 DB 변경 없음 (안전)

#### 5. 3-Tier Scope 보호

```
  우선순위:

  1. freeze (물리적 차단)
     └─ PreToolUse Hook → Edit/Write exit 2
     └─ 가장 강력, 우회 불가

  2. allowed_files / forbidden_patterns (논리적 제한)
     └─ verifier가 WARN으로 보고
     └─ 에이전트가 인지하고 준수

  3. Modification Plan (자율적 준수)
     └─ tdd-implementer가 자체 수립
     └─ 강제력 없음, 가이드라인

  결과: 에이전트가 범위를 벗어나는 변경을 3중으로 방지
```

---

## Part 2: 에이전트 간 연결 구조 비판적 검토

### 2-1. 전체 에이전트 연결 다이어그램

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                     /vs-plan (스킬)                               │
  │  ┌─────────────┐  ┌──────────────────┐  ┌──────────────┐        │
  │  │ spec-writer  │  │plan-design-      │  │  qa-seeder   │        │
  │  │ (opus)       │  │reviewer (sonnet) │  │  (haiku)     │        │
  │  └──────┬──────┘  └────────┬─────────┘  └──────┬───────┘        │
  │         │                  │                    │                │
  │     스펙 + 태스크       Design Score        seed 시나리오       │
  │     DB 저장             7차원 점수          DB 등록              │
  └─────────┼──────────────────┼────────────────────┼────────────────┘
            │                  │                    │
            ▼                  ▼                    ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                 /vs-next · /vs-exec (스킬)                       │
  │                                                                  │
  │  ┌───────────────┐   ┌──────────┐   ┌──────────┐               │
  │  │tdd-implementer│──▶│ verifier │──▶│ debugger │               │
  │  │(opus)         │   │(sonnet)  │   │(opus)    │               │
  │  │               │   │          │   │          │               │
  │  │RED→GREEN→     │   │4 Phase   │   │분석→수정 │               │
  │  │REFACTOR       │   │검증      │   │→재검증   │               │
  │  └───────────────┘   └────┬─────┘   └──────────┘               │
  │                           │                                      │
  │              ┌────────────┼───────────────┐                     │
  │              ▼            ▼               ▼                     │
  │        ┌──────────┐ ┌──────────┐  ┌──────────────┐            │
  │        │qa-shadow │ │(PASS/WARN│  │ plan-advisor │            │
  │        │(haiku)   │ │/FAIL)    │  │ (opus)       │            │
  │        │병렬 경량  │ │          │  │ 플랜 수정안  │            │
  │        │QA        │ │          │  │              │            │
  │        └──────────┘ └──────────┘  └──────────────┘            │
  └──────────────────────────────────────────────────────────────────┘
            │
            ▼
  ┌──────────────────────────────────────────────────────────────────┐
  │                     /vs-qa (스킬)                                 │
  │                                                                  │
  │  ┌────────────────┐                                              │
  │  │ qa-coordinator │ (opus)                                       │
  │  │                │                                              │
  │  │ Phase 1: 분석  │                                              │
  │  │ Phase 2: 시나리오│                                             │
  │  │ Phase 3: 디스패치│                                             │
  │  │ Phase 4: 집계   │                                              │
  │  └───────┬────────┘                                              │
  │          │ 병렬 디스패치 (2~4개)                                  │
  │          │                                                       │
  │  ┌───────┼──────────┬───────────────┬──────────────┐            │
  │  ▼       ▼          ▼               ▼              │            │
  │ ┌──────┐┌──────┐ ┌──────────┐ ┌──────────┐        │            │
  │ │func- ││flow- │ │acceptance││security- │        │            │
  │ │tester││tester│ │-tester   ││auditor   │        │            │
  │ │      ││      │ │(조건부)  ││(조건부)  │        │            │
  │ └──┬───┘└──┬───┘ └────┬─────┘└────┬─────┘        │            │
  │    │       │          │           │               │            │
  │    └───────┴──────────┴───────────┘               │            │
  │                    │                               │            │
  │                    ▼                               │            │
  │            ┌──────────────┐                        │            │
  │            │ qa-reporter  │ (sonnet)               │            │
  │            │              │                        │            │
  │            │ 이슈 정리    │                        │            │
  │            │ 중복 제거    │                        │            │
  │            │ 수정 플랜 생성│                        │            │
  │            │ Error KB 기록│                        │            │
  │            └──────────────┘                        │            │
  └──────────────────────────────────────────────────────────────────┘
```

### 2-2. 잘 된 점 (Strengths)

| # | 항목 | 상세 |
|---|------|------|
| 1 | **구현-검증 분리** | tdd-implementer(opus) → verifier(sonnet)로 모델까지 분리. "구현자 불신 원칙"은 실무적으로 매우 효과적 |
| 2 | **FAIL 자동 복구 루프** | verifier FAIL → debugger → re-verify 체인이 최대 2회로 바운드됨. 무한루프 방지 확인 |
| 3 | **QA 조건부 디스패치** | security-auditor는 보안 키워드 감지 시만, acceptance-tester는 UI 변경 시만 디스패치. 불필요한 비용 절감 |
| 4 | **AC 번호 체계** | spec-writer(AC01, AC02) → tdd-implementer(테스트 이름에 AC번호) → verifier(자동 매핑 검증). 3-에이전트 체인의 데이터 계약이 명확 |
| 5 | **plan-advisor 안전장치** | 사용자 승인 전 DB 변경 금지 + "무시" 옵션 항상 포함. 자율성과 안전성의 균형 |
| 6 | **Scope 3-Tier** | freeze(물리적) → allowed_files(논리적) → Modification Plan(자율적). 에이전트 범위 이탈 3중 방어 |
| 7 | **모델 최적화** | opus(구현, 분석) / sonnet(검증, 리포트) / haiku(경량 QA). 비용-품질 트레이드오프 적절 |

### 2-3. 비판적 발견 사항 (Critical Findings)

---

#### Finding #1: qa-shadow → plan-advisor 연결이 간접적 [Medium]

**현재 구조:**
```
  qa-shadow ALERT
       │
       ▼
  vs-next가 "design_flaw" 트리거 감지
       │
       ▼
  plan-advisor 디스패치 제안 (AskUserQuestion)
```

**문제:**
- qa-shadow의 ALERT가 plan-advisor로 전달되려면 vs-next 스킬의 "Adaptive Planner Watcher" 로직을 경유해야 함
- shadow 결과의 `category`가 `design_flaw`일 때만 트리거 → shadow가 `bug` 카테고리로 ALERT를 내면 plan-advisor에 도달하지 않음
- **shadow ALERT의 다른 카테고리(bug, spec_gap)에 대한 plan-advisor 연결이 없음**

**권장:**
- `spec_gap` 카테고리도 `assumption_violation` 트리거로 매핑 추가
- 또는 shadow ALERT 자체를 트리거 조건으로 추가 (카테고리 무관)

---

#### Finding #2: qa-reporter의 수정 플랜 → 실행 연결 끊김 [Medium]

**현재 구조:**
```
  qa-reporter
       │
       ▼
  수정 플랜 생성 (vs plan create + vs task create)
       │
       ▼
  "vs-next로 바로 실행 가능" ← 안내 메시지만 있음
```

**문제:**
- qa-reporter가 수정 플랜을 생성하지만, **자동으로 실행 흐름에 연결되지 않음**
- 사용자가 수동으로 `/vs-next`를 실행해야 수정 작업이 시작됨
- qa-coordinator의 최종 리포트에서도 "다음 단계 권장"만 텍스트로 출력

**권장:**
- qa-coordinator Phase 4 완료 후 `AskUserQuestion`으로 "수정 플랜 즉시 실행" 선택지 추가
- 또는 vs-qa 스킬에서 qa-coordinator 결과 수신 후 자동으로 "수정 플랜 실행 여부" 체크포인트 삽입

---

#### Finding #3: Error KB 활용이 편향적 [Low]

**현재 Error KB 접근 에이전트:**
| 에이전트 | Error KB 접근 | 방식 |
|---|---|---|
| qa-coordinator | ✅ 읽기 | Phase 1에서 시나리오 생성 시 참조 |
| verifier | ✅ 읽기 | Phase 3.5 Self-Challenge에서 대조 |
| qa-reporter | ✅ 쓰기 | Phase 3에서 반복 패턴 기록 |
| debugger | ❌ 없음 | 근본 원인 분석 시 참조하지 않음 |
| tdd-implementer | ❌ 없음 | 구현 시 과거 에러 참조 안 함 |
| spec-writer | ❌ 없음 | 스펙 작성 시 과거 에러 참조 안 함 |

**문제:**
- **debugger**가 Error KB를 참조하지 않음 → 과거에 동일한 문제가 해결된 기록이 있어도 처음부터 분석
- **tdd-implementer**가 Error KB를 참조하지 않음 → 이미 알려진 함정에 반복적으로 빠질 수 있음

**권장:**
- debugger Phase 1에 "Error KB 검색" 단계 추가 (변경 파일 키워드 기반)
- tdd-implementer Phase 0에 "Error KB 검색" 단계 추가 (관련 모듈의 과거 에러 사전 인지)

---

#### Finding #4: plan-design-reviewer → plan-advisor 연결 없음 [Low]

**현재 구조:**
```
  /vs-plan
       │
       ├── spec-writer (스펙 생성)
       │
       └── plan-design-reviewer (디자인 점수 반환)
               │
               ▼
           Design Score B (7.8/10)
           critical_gaps: ["State Coverage 6/10"]
               │
               ▼
           결과가 vs-plan에 표시만 됨 ← 여기서 끊김
```

**문제:**
- plan-design-reviewer가 낮은 점수(C, D, F)를 반환해도 **자동 수정 흐름이 없음**
- plan-advisor와 연결되지 않아, 디자인 결함이 플랜 수정으로 이어지지 않음
- 사용자가 점수를 보고 수동으로 스펙을 수정해야 함

**권장:**
- vs-plan 스킬에서 Design Score D 이하일 때 `AskUserQuestion`으로 "스펙 수정" / "무시하고 진행" 선택지 추가
- 또는 spec-writer를 재디스패치하여 critical_gaps 기반 스펙 보완

---

#### Finding #5: qa-seeder ↔ qa-coordinator 시나리오 중복 위험 [Low]

**현재 구조:**
```
  /vs-plan 시점:
    qa-seeder ──▶ seed 시나리오 (source='seed') DB 등록

  /vs-qa 시점:
    qa-coordinator ──▶ 신규 시나리오 생성
```

**문제:**
- qa-coordinator의 Phase 2에서 시나리오를 생성할 때, qa-seeder가 이미 등록한 seed 시나리오와 **중복될 수 있음**
- delta 모드에서는 기존 PASS 시나리오를 제외하지만, seed 시나리오는 아직 실행되지 않은 상태(status가 pending)라 제외되지 않음
- 결과: 동일한 AC에 대해 seed + coordinator 양쪽에서 시나리오가 생성될 수 있음

**권장:**
- qa-coordinator Phase 2에서 seed 시나리오 목록을 먼저 조회하고, seed가 이미 커버하는 AC는 시나리오 생성에서 제외
- 또는 seed 시나리오를 coordinator의 시나리오 생성 입력으로 활용 (보완만 생성)

---

#### Finding #6: vs-exec --inline 모드의 검증 품질 저하 [Info]

**구조 비교:**
```
  vs-next:     tdd-implementer(opus) ──▶ verifier(sonnet) + qa-shadow(haiku)
  vs-exec:     직접 구현 ──▶ verifier(sonnet) + qa-shadow(haiku)
  vs-exec --inline: 직접 구현 ──▶ 직접 검증 (verification 스킬)
```

**차이:**
| 항목 | vs-next | vs-exec | vs-exec --inline |
|------|---------|---------|-----------------|
| 구현 컨텍스트 격리 | ✅ 별도 에이전트 | ❌ 같은 세션 | ❌ 같은 세션 |
| 검증 컨텍스트 격리 | ✅ 별도 에이전트 | ✅ 별도 에이전트 | ❌ 같은 세션 |
| Phase 3 (코드 품질) | ✅ | ✅ | ❌ 없음 |
| Phase 3.5 (Self-Challenge) | ✅ | ✅ | ❌ 없음 |
| qa-shadow | ✅ | ✅ | ❌ 없음 |
| debugger 자동 재시도 | ✅ | ✅ | ❌ 없음 |

이 차이는 문서에 잘 명시되어 있어 문제는 아니지만, **inline 모드에서 품질 게이트가 대폭 약해진다**는 점을 사용자가 인지해야 함.

---

### 2-4. 에이전트 활용 매트릭스

| 에이전트 | 호출 스킬 | 호출 조건 | 출력 소비자 | 상태 |
|---|---|---|---|---|
| spec-writer | vs-plan | 항상 | vs-plan (DB 저장) | ✅ 정상 |
| plan-design-reviewer | vs-plan | UI 감지 시 | vs-plan (점수 표시) | ⚠️ 후속 조치 없음 |
| qa-seeder | vs-plan | config.seed=true | DB 직접 기록 | ✅ 정상 |
| tdd-implementer | vs-next | 사용자 선택 | verifier (impl_report) | ✅ 정상 |
| verifier | vs-next, vs-exec | 항상 | vs-next (판정 처리) | ✅ 정상 |
| debugger | vs-next, vs-exec | FAIL 시 | verifier (재검증) | ✅ 정상 |
| qa-shadow | vs-next, vs-exec | config.shadow=true | vs-next (판정 통합) | ✅ 정상 |
| plan-advisor | vs-next, vs-exec | 이상 감지 시 | 사용자 (수정안 승인) | ✅ 정상 |
| qa-coordinator | vs-qa | 항상 | qa-reporter (결과 집계) | ✅ 정상 |
| qa-func-tester | qa-coordinator | 항상 | qa-reporter (findings) | ✅ 정상 |
| qa-flow-tester | qa-coordinator | 항상 | qa-reporter (findings) | ✅ 정상 |
| qa-acceptance-tester | qa-coordinator | UI/visual 시 | qa-reporter (findings) | ✅ 정상 |
| qa-security-auditor | qa-coordinator | 보안 변경 시 | qa-reporter (findings) | ✅ 정상 |
| qa-reporter | qa-coordinator | 항상 | 사용자 (리포트 + 수정 플랜) | ⚠️ 수정 플랜 실행 끊김 |

**Dead End 에이전트: 없음** — 모든 에이전트가 최소 1개 스킬에서 호출됨
**미사용 에이전트: 없음** — 14개 전부 활용 경로 존재

---

### 2-5. 데이터 흐름 계약 검증

```
  spec-writer                    tdd-implementer                verifier
  ┌─────────┐                   ┌─────────────┐              ┌──────────┐
  │ AC01:   │                   │ test name:  │              │ AC 매핑: │
  │ AC02:   │ ──── 계약 ────▶  │ "AC01: ..." │ ── 계약 ──▶ │ AC01 →   │
  │ AC03:   │    번호 체계      │ "AC02: ..." │   자동 매핑  │ test_AC01│
  └─────────┘                   │ "AC03: ..." │              │ PASS     │
                                └─────────────┘              └──────────┘
                                       │
                                       ▼
                                ac_mapping.json
                                (.claude/handoff/)
```

**✅ 검증 통과**: AC 번호 체계가 3-에이전트 체인(spec-writer → tdd-implementer → verifier)에서 일관되게 사용됨

```
  tdd-implementer              verifier                    debugger
  ┌─────────────┐            ┌──────────┐               ┌──────────┐
  │ impl_report │ ────────▶  │ FAIL     │ ────────────▶ │ failure_ │
  │             │  리포트     │ 리포트   │  failure_     │ report   │
  │ Status:     │  전달       │          │  report 전달  │          │
  │ DONE        │            │ AC01:FAIL│               │ 근본원인 │
  │ 변경 파일   │            │ 테스트:  │               │ 분석     │
  │ 테스트 결과 │            │ FAIL     │               │          │
  └─────────────┘            └──────────┘               └──────────┘
```

**✅ 검증 통과**: impl_report → verifier failure_report → debugger 체인의 데이터 필드가 일관됨

---

## Part 3: 종합 평가

### 점수표

| 차원 | 점수 | 근거 |
|------|------|------|
| 에이전트 간 연결 완성도 | **8.5/10** | 14개 에이전트 전부 활용, 순환 의존 없음. qa-reporter 출력 → 실행 연결만 약함 |
| 데이터 계약 일관성 | **9/10** | AC 번호 체계, impl_report, failure_report 모두 명확. Error KB 접근만 편향적 |
| 실패 복구 메커니즘 | **9.5/10** | debugger 자동 재시도(2회), NEEDS_MANUAL 에스컬레이션, git stash 롤백 전략 우수 |
| 사용자 제어권 | **9/10** | 모든 주요 결정에 AskUserQuestion, plan-advisor "무시" 옵션 항상 포함 |
| 비용 효율성 | **9/10** | opus/sonnet/haiku 모델 분배, 조건부 디스패치(security, acceptance) 적절 |
| Scope 보호 | **9/10** | 3-Tier(freeze/allowed/plan) 구조 견고. 물리적 Hook 차단 + 논리적 경고 조합 |

### 전체 점수: **9.0/10**

### 주요 개선 권장 사항 (우선순위순)

| 우선순위 | Finding | 영향도 | 권장 조치 |
|---------|---------|--------|----------|
| 1 | qa-reporter 수정 플랜 → 실행 연결 | Medium | vs-qa에 "수정 플랜 즉시 실행" 체크포인트 추가 |
| 2 | shadow ALERT → plan-advisor 카테고리 제한 | Medium | shadow ALERT 자체를 트리거 조건으로 확대 |
| 3 | debugger의 Error KB 미참조 | Low | debugger Phase 1에 KB 검색 추가 |
| 4 | plan-design-reviewer 후속 조치 | Low | Design Score D 이하 시 스펙 수정 체크포인트 |
| 5 | qa-seeder ↔ coordinator 시나리오 중복 | Low | coordinator가 seed 시나리오 먼저 조회 후 보완 생성 |
