# 프로젝트 골격(Skeleton) 통합 관리 시스템 — 사용 가이드

## 1. 골격 문서란?

프로젝트의 핵심 결정을 담는 4종 문서입니다. 한번 설정하면 플래닝/구현/QA 전 과정에서 **자동으로 정합성을 체크**합니다.

| 문서 | 한줄 역할 | 핵심 질문 |
|------|----------|----------|
| **PRD.md** | 뭘 만드는가 | 비전, 사용자, 기능 우선순위, 범위 밖 |
| **POLICY.md** | 어떤 규칙으로 | 기술 스택, 보안, 네이밍, 의존성 |
| **ARCHITECTURE.md** | 어떤 구조로 | 모듈, 데이터 흐름, 기술 결정(ADR) |
| **DESIGN.md** | 어떻게 보이는가 | 색상, 폰트, 간격, 컴포넌트 |

**문서 계층** (충돌 시 상위 우선):
```
PRD (비즈니스) > POLICY (제약) > ARCHITECTURE (구현) > DESIGN (표현)
```

---

## 2. 빠른 시작 (5분)

### 신규 프로젝트

```
/vs-skeleton-init
```

1. 입력 소스 선택 → **"직접 인터뷰"**
2. 문서별 3~4개 질문에 답변 (비전, 사용자, 기능, 정책...)
3. 초안 확인 → "생성"
4. 완료! 4종 문서가 프로젝트 루트에 생성됨

### 기존 프로젝트 (마이그레이션)

```
/vs-skeleton-init
```

1. 시스템이 **자동으로 기존 프로젝트 감지** (package.json + src/ + git history)
2. **모노레포 자동 감지** (packages/ + pnpm-workspace.yaml 등)
3. 입력 소스 → **"마이그레이션 (추천)"** 선택
4. package.json, 디렉토리 구조, README에서 **자동 역추론**
5. 모노레포면 **환경 관리 정책** 추가 질문 (루트 통합 / 패키지별 분리)
6. 추론 결과를 확인/수정만 하면 완료

### 멀티소스 하이브리드 입력

인터뷰 중 **어떤 질문에서든** 다양한 소스를 자유롭게 혼합할 수 있습니다:

```
시스템: "프로젝트의 핵심 비전은?"
사용자: "docs/planning.md 읽어봐"              ← 파일 자동 감지

시스템: "보안 정책은?"
사용자: "#security 채널 최근 스레드 참고"        ← Slack 자동 감지

시스템: "디자인 방향은?"
사용자: "https://figma.com/file/abc123 이거"    ← Figma 자동 감지

시스템: "기술 스택은?"
사용자: "TypeScript + Next.js + Supabase"       ← 직접 텍스트
```

지원 소스:

| 소스 | 감지 방식 | 예시 |
|------|----------|------|
| 로컬 파일 | 경로 또는 확장자 | `docs/prd.md`, `spec.yaml` |
| PDF | `*.pdf` | `docs/planning.pdf` |
| 이미지 | `*.png`, `*.jpg` | `mockup.png` (디자인 추출) |
| 웹 URL | `http://...` | 아무 웹페이지 |
| Slack | `#채널`, Slack URL | `#dev-planning` |
| GitHub | `#번호`, GitHub URL | `#45` (이슈) |
| Figma | `figma.com/` URL | 디자인 토큰 추출 |
| Pencil | `*.pen` | 디자인 변수 추출 |

MCP/도구 미연결 시 "직접 입력해주세요"로 fallback합니다.

### 모노레포 환경 관리

모노레포 프로젝트가 감지되면 POLICY.md에 **Environment Management** 섹션이 자동 포함됩니다:

```
## Environment Management

### 환경변수 관리 전략
- 관리 위치: 루트 .env에서 통합 관리
- .env — 공통 기본값
- .env.local — 로컬 오버라이드 (git 제외)
- packages/*/ 에는 .env 금지

### 금지 사항
- 패키지 내부 독립 .env 생성 금지
- 하드코딩 환경변수 금지
- 루트 .env에 시크릿 직접 기록 금지
```

**skeleton-guard가 자동으로 감시하는 환경 관리 규칙:**

| 규칙 | 감지 | Severity |
|------|------|----------|
| I-04 | 패키지 내부 `.env` 생성 | Warning |
| I-05 | 하드코딩 환경변수 (포트, URL 등) | Warning |
| P-04 | 플랜에서 패키지별 독립 환경 제안 (POLICY 위반) | Warning |

### 건강도 확인

```
/vs-skeleton-status
```

```
| 문서 | 상태 | 완성도 | 필수 | 선택 |
|------|------|--------|------|------|
| PRD.md | ✅ | 85/100 | 5/5 | 1/3 |
| POLICY.md | ✅ | 80/100 | 5/5 | 0/3 |
| ARCHITECTURE.md | ✅ | 60/100 | 3/4 | 0/3 |
| DESIGN.md | ❌ | - | - | - |

전체 건강도: 56/100
⚠️ DESIGN.md가 누락되었습니다.
```

---

## 3. 일상 워크플로우

골격 문서를 한번 설정하면, 이후 평소 작업에서 **자동으로 동작**합니다.

### 플래닝 시 (`/vs-plan`)

```
사용자: /vs-plan "결제 시스템 추가"

시스템 자동 동작:
  ├─ Step 0f: 골격 문서 4종 존재 확인 ✅
  │
  ├─ 스펙 작성 후 skeleton-guard plan-check 자동 실행
  │   ├─ PRD 체크: Out of Scope에 "결제" 없음 → PASS
  │   ├─ PRD 체크: Feature Priority에 미등록 → ⚠️ WARNING
  │   └─ ARCH 체크: payment 모듈 미정의 → ⚠️ WARNING
  │
  └─ 통합 체크포인트에 골격 정합성 표시:
      ### 골격 정합성 (Skeleton Guard)
      - Verdict: ⚠️ WARNING
      - P-02: Feature Priority에 '결제 시스템' 미등록
      - A-01: ARCHITECTURE에 payment 모듈 미정의
```

**Critical 발생 시** (Out of Scope 위반):
```
시스템: ⚠️ ALERT: PRD Out of Scope 위반
        "다국어 지원"이 Out of Scope에 정의되어 있으나
        스펙 MUST에 포함됨
        → 스펙 수정을 강력 권장합니다
```

### 구현 시 (`/vs-next`)

```
사용자: /vs-next (태스크 실행 + 구현 완료)

시스템 자동 동작 (Step 10, 4개 병렬):
  ├─ verifier: 테스트/빌드 검증
  ├─ qa-shadow: 경량 코드 분석
  ├─ design-review-light: DESIGN.md 토큰 체크
  └─ skeleton-guard impl-check: POLICY 정합성
      ├─ I-01: Naming Convention 체크
      │   "UserProfile.tsx" → kebab-case 규칙 위반 ⚠️
      ├─ I-02: Security Policy 체크
      │   하드코딩 시크릿 없음 → PASS
      └─ I-03: Dependencies Policy 체크
          금지 의존성 없음 → PASS

검증 리포트:
  ### Skeleton Guard: ⚠️ WARNING
  - I-01: Naming 위반 'UserProfile.tsx'
    [이 경고 억제] ← 선택 가능
```

**경고를 5회 이상 억제하면**:
```
⚠️ ALERT (ESCALATION-01)
동일 플랜에서 경고가 5건 이상 무시되었습니다.
골격 문서를 업데이트하세요.
→ 이 경고는 억제할 수 없습니다
```

### 태스크 완료 시 — 경량 Evolve

```
매 태스크 완료 후 자동:
  경량 evolve (Auto tier only, 5초 이내):
  ├─ src/analytics/ 새 디렉토리 감지
  │   → ARCHITECTURE.md Module Structure 자동 업데이트
  ├─ package.json에 chart.js 추가 감지
  │   → POLICY.md Dependencies 자동 업데이트
  └─ "경량 evolve: Auto 2건 적용"

  ※ Suggest/Locked/충돌 감지는 플랜 완료 시에만
```

### 커밋 시 (`/vs-commit`)

```
사용자: /vs-commit

시스템 자동 동작 (Phase 6.5):
  ├─ package.json 변경 감지
  │   → POLICY.md Dependencies 자동 업데이트
  └─ "골격 문서 자동 업데이트: 1건 적용됨"
```

### 플랜 완료 시 — 전체 Evolve

```
모든 태스크 done → 플랜 완료 감지

skeleton-evolve 자동 실행:
  ├─ 구현 결과 분석 (새 모듈, 새 기능, 새 의존성)
  ├─ 골격 차이 분석
  ├─ cross-reference 충돌 감지
  │
  └─ 3-tier Autonomy 분류:

  ┌────────────────────────────────────────────────┐
  │ Auto 변경 (자동 적용됨) ✅                       │
  │ 1. ARCHITECTURE.md: ADR-003 번호 부여           │
  │ 2. ARCHITECTURE.md: src/analytics 경로 추가     │
  │                                                │
  │ Suggest 변경 (승인 필요) ❓                      │
  │ 1. PRD.md Feature에 '분석 대시보드'             │
  │    추가 — [승인] [거부]                         │
  │ 2. POLICY.md Dependencies에 chart.js            │
  │    추가 — [승인] [거부]                         │
  │                                                │
  │ Locked 변경 (사유 필요) 🔒                       │
  │ (해당 없음)                                     │
  └────────────────────────────────────────────────┘
```

### 플랜 검증 시 (`/vs-plan-verify`)

```
시스템 자동 동작 (Step 2a):
  ├─ 골격 정합성 최종 게이트
  │   ├─ Auto 적용: 1건
  │   ├─ Suggest 대기: 2건 (승인 필요)
  │   └─ 충돌: 0건
  │
  └─ 리포트:
      ### 골격 정합성: ⚠️ WARN
      Suggest 2건이 미승인 상태입니다.
      /vs-skeleton-status를 확인하세요.
```

---

## 4. 3-tier 경고 체계

### 경고 등급

| 등급 | 언제 | 어떻게 | 억제 |
|------|------|--------|------|
| **Critical** | Out of Scope 위반, Security 위반, 5회 누적 | 중단 제안 + AskUserQuestion | ❌ 불가 |
| **Warning** | Naming 위반, 모듈 이탈, Feature 미등록 | 리포트 표시 | ✅ 세션 단위 |
| **Info** | 선택 섹션 미준수, 스타일 차이 | 로그만 | - |

### Alert Fatigue 방지
- 같은 경고는 세션 내 **1회만** 표시
- "이 경고 억제" 선택 → 같은 세션에서 재발생 안 함
- 단, **5회 이상 억제** → Critical로 자동 승격 (억제 불가)
- 새 세션 시작 시 억제 목록 초기화

---

## 5. 자동 개선 — 3-tier Autonomy

| Tier | 뭘 바꾸는가 | 승인 | 예시 |
|------|------------|------|------|
| **Auto** | 포맷, 경로, ADR 번호, 오타 | 불필요 | 파일 리네이밍 반영 |
| **Suggest** | 기능/모듈/의존성 추가 | 사용자 승인 | 새 모듈을 Module Structure에 |
| **Locked** | Vision, Tech Stack, Security | 카테고리 + 사유 50자 | Security Policy 완화 |

**Locked 사유 입력 예시**:
```
카테고리: 비즈니스 변경
사유: "시리즈A 투자 유치를 위해 B2B SaaS 모델에서 B2C 마켓플레이스로
       전환하면서 결제 관련 보안 정책을 PG사 요구사항에 맞게 수정합니다.
       PCI DSS 레벨3 → 레벨1 상향." (92자)
```

---

## 6. 완성도 점수 (completeness_score)

### 계산 공식
```
점수 = (필수섹션 충족 수 / 전체 필수섹션 수) × 80
     + (선택섹션 충족 수 / 전체 선택섹션 수) × 20
```

### 품질 기준
섹션이 "존재"하려면:
1. 해당 `##` 제목이 문서에 있고
2. 플레이스홀더(`{값}`, `TODO`, `TBD`, `(미정)` 등)를 **제거한 후**
3. 실제 내용이 **50자 이상**

→ 미달 시 "⚠️ 미완성" 표시, 점수 0

### 문서별 섹션 수

| 문서 | 필수 | 선택 | 만점 구성 |
|------|------|------|----------|
| PRD.md | 5 | 3 | 80 + 20 = 100 |
| DESIGN.md | 4 | 4 | 80 + 20 = 100 |
| POLICY.md | 5 | 3 | 80 + 20 = 100 |
| ARCHITECTURE.md | 4 | 3 | 80 + 20 = 100 |

---

## 7. 스킬/명령어 총정리

### 수동 실행 스킬

| 명령 | 용도 | 빈도 |
|------|------|------|
| `/vs-skeleton-init` | 골격 문서 4종 생성 | 프로젝트 최초 1회 |
| `/vs-skeleton-status` | 건강도 대시보드 | 수시 확인 |
| `/vs-setup` | VibeSpec 초기 설정 (골격 안내 포함) | 최초 1회 |

### 자동 트리거 (설정만 하면 알아서 동작)

| 시점 | 무엇이 | 조건 |
|------|--------|------|
| `/vs-plan` 시 | skeleton-guard **plan-check** | skeleton_guard=true + 골격 1개+ |
| `/vs-next` 태스크 완료 시 | skeleton-guard **impl-check** | skeleton_guard=true + POLICY 존재 |
| `/vs-next` 태스크 완료 시 | design-review-light | design_review=true + UI 파일 변경 |
| `/vs-next` 태스크 완료 시 | 경량 evolve (Auto only) | skeleton_guard=true + guard PASS |
| `/vs-commit` 시 | Auto tier 트리거 | 골격 관련 파일 변경 |
| 플랜 완료 시 | skeleton-evolve (전체) | skeleton_guard=true + 골격 1개+ |
| `/vs-plan-verify` 시 | 골격 정합성 게이트 | 골격 1개+ |
| `/vs-dashboard` 시 | 골격 건강도 표시 | 골격 1개+ |

### QA Config 설정

```yaml
# .claude/qa-rules.yaml
modules:
  skeleton_guard: true    # 골격 감시 (기본: true)
  design_review: true     # DESIGN.md 토큰 체크 (프론트엔드만)
```

사용자가 `skeleton_guard: false`로 오버라이드하면 모든 골격 감시가 비활성화됩니다.

---

## 8. Cross-Reference 충돌 감지

4종 문서 간 모순을 자동 탐지합니다.

### 감지 예시

```
⚠️ Cross-Reference 충돌 감지

PRD.md (Feature Priority)     ↔  POLICY.md (Dependencies)
"결제 기능 Must Have"              "외부 PG 연동 금지"

→ PRD가 상위 문서이므로 POLICY 수정을 권장합니다.
  [POLICY 수정] [PRD 수정] [양쪽 수정] [무시]
```

### 감지 대상 조합

| 문서 A | 문서 B | 대표 충돌 |
|--------|--------|----------|
| PRD Feature | POLICY Security | 기능 vs 보안 제약 |
| PRD Out of Scope | ARCHITECTURE Module | 범위 밖 vs 구현 존재 |
| ARCHITECTURE Data Flow | POLICY Tech Stack | 기술 선택 불일치 |

---

## 9. 안전 장치

| 장치 | 동작 |
|------|------|
| **.bak 백업** | Auto 수정 전 항상 백업. 롤백 가능 |
| **점수 하락 롤백** | Auto 적용 후 completeness 하락 → 자동 롤백 |
| **Locked 차단** | Vision/Tech Stack/Security 변경은 사유 없이 불가 |
| **5회 경고 승격** | Warning 5회 무시 → Critical로 자동 승격 |
| **민감 파일 제외** | .env, *.key, credentials.* 등 20+ 패턴 자동 제외 |
| **마스킹** | 역추론 시 API 키/토큰 자동 [MASKED] 처리 |
| **동시 실행 방지** | .skeleton.lock으로 중복 실행 차단 |
| **세션 복원** | 인터뷰 중단 → .skeleton.tmp에 보존, 재시작 시 이어쓰기 |
