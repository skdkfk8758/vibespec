# VibeSpec 사용자 시뮬레이션

> 실제 사용 흐름을 시나리오별로 시뮬레이션합니다.
> 사용자 입력은 `>` 블록, 시스템 응답은 일반 텍스트, 내부 동작은 `[내부]`로 표기합니다.

---

## 시나리오 A: 처음 설치한 사용자의 첫 기능 개발 (Full Course)

### Act 1: 초기 설정

```
> /vs-setup
```

```
✓ CLI 연결 확인 — vs dashboard 정상 동작
✓ Node.js v20.11.0, Git 저장소 확인됨
✓ 기존 플랜 없음

VibeSpec은 Spec → Plan → Tasks → Implementation 사이클을 따릅니다.

핵심 명령어:
  /vs-plan      스펙 작성 → 플랜 생성
  /vs-next      다음 태스크 실행
  /vs-exec      전체 태스크 일괄 실행
  /vs-dashboard 진행 현황 확인
  /vs-worktree  격리 환경 생성

첫 플랜을 만들어볼까요?
  ● 플랜 생성 (/vs-plan)
  ○ 아이디어부터 정리 (/vs-ideate)
  ○ 나중에
```

---

### Act 2: 아이디어 구체화 (선택)

```
> /vs-ideate 사용자 프로필 페이지를 만들고 싶어
```

```
좋은 아이디어입니다! 6가지 질문으로 구체화해보겠습니다.

Q1. 이 문제를 겪는 사용자는 누구인가요?
```

```
> 우리 서비스의 일반 사용자들
```

```
→ Follow-up: 로그인한 사용자만인가요? 비회원도 프로필을 볼 수 있나요?
```

```
> 로그인한 사용자만 자기 프로필을 보고 수정할 수 있어
```

```
Q2. 현재 어떻게 해결하고 있나요?
```

```
> 프로필 기능이 아직 없어. 가입할 때 입력한 정보가 전부야
```

```
Q3. 왜 지금 해결해야 하나요?
```

```
> 다음 주에 베타 출시인데, 사용자들이 프로필을 수정할 수 있어야 해
```

```
Q4. 성공을 어떻게 측정할 수 있나요?
```

```
> 프로필 수정 완료율이 80% 이상이면 성공이야
```

```
Q5. 가장 작은 MVP는 뭔가요?
```

```
> 이름, 이메일, 프로필 사진만 수정할 수 있으면 돼
```

```
→ Follow-up: 프로필 사진은 업로드? 아니면 URL 입력?
```

```
> 이미지 파일 업로드. 5MB 이하로 제한하고 싶어
```

```
Q6. 가장 큰 리스크는?
```

```
> 이미지 업로드가 서버 부하를 줄까 걱정돼
```

```
[내부: 6개 질문 완료 → 스펙 초안 자동 생성]

## Go/No-Go 판정: ✅ GO

| 항목 | 결과 |
|------|------|
| 문제 명확성 | ✅ 명확 — 프로필 조회/수정 기능 부재 |
| 대상 사용자 | ✅ 명확 — 로그인한 일반 사용자 |
| MVP 범위 | ✅ 적절 — 이름/이메일/사진 3가지 |
| 성공 지표 | ✅ 정량적 — 수정 완료율 80% |
| 기술 리스크 | ⚠️ 중간 — 이미지 업로드 서버 부하 |
| 일정 | ⚠️ 타이트 — 다음 주 베타 출시 |

스펙 초안이 생성되었습니다. /vs-plan으로 바로 진행할까요?
  ● vs-plan으로 플랜 생성
  ○ 스펙 초안 수정
  ○ 보류
```

---

### Act 3: 플랜 생성

```
> /vs-plan
```

```
[내부: ideation 기록 발견 → 스펙 초안을 기반으로 빠른 확인 모드]
[내부: 코드베이스 탐색 → Next.js 14 + Prisma + S3 감지]
[내부: src/app/ 구조, 기존 User 모델 확인]

기존 ideation 스펙을 기반으로 진행합니다.
자동 감지 결과:
  - 기술 스택: Next.js 14, Prisma ORM, AWS S3 [자동감지]
  - 기존 코드: src/app/(auth)/, prisma/schema.prisma의 User 모델 [자동감지]

몇 가지만 추가로 확인하겠습니다.

성능, 보안, 에러 처리에서 특별히 신경 써야 할 부분이 있나요?
```

```
> 이미지는 S3에 올리고, 프로필 수정 시 CSRF 토큰 검증 필수
```

```
이번 작업에서 의도적으로 제외할 것이 있나요?
```

```
> 비밀번호 변경, 계정 삭제는 나중에. 다른 사용자 프로필 보기도 제외
```

```
[내부: 요구사항 정리 → 스펙 작성 → 태스크 분해 → 비판적 검토 자동 반영]
[내부: UI 파일 감지(.tsx) → 디자인 리뷰 자동 포함]
[내부: 보안 키워드 감지(CSRF, auth) → 보안 감사 태스크 자동 추가]

## 요구사항 요약
- **목적**: 로그인 사용자가 자신의 프로필(이름, 이메일, 사진)을 조회/수정
- **기술 스택**: Next.js 14 + Prisma + S3 [자동감지]
- **기존 코드**: User 모델, (auth) 라우트 그룹 [자동감지]
- [자동 포함] UI/UX Design — 근거: .tsx 파일 변경 (제거하려면 '스펙 수정')
- [자동 포함] Security — 근거: CSRF, auth 키워드 감지 (제거하려면 '스펙 수정')

## 스펙 요약
### Requirements
- MUST: 프로필 조회 API, 프로필 수정 API, 이미지 업로드 (5MB 제한), CSRF 검증
- SHOULD: 이미지 리사이즈 (400x400), 수정 성공 토스트
- COULD: 이미지 크롭 UI

### Edge Cases
- 5MB 초과 이미지 업로드 시 명확한 에러 메시지
- S3 업로드 실패 시 기존 프로필 사진 유지
- 동시 수정 시 낙관적 잠금 (updatedAt 비교)

### Success Criteria
- 프로필 수정 완료율 ≥ 80% (AC01)
- 이미지 업로드 응답 시간 < 3초 (5MB 기준) (AC02)
- CSRF 검증 실패 시 403 반환 (AC03)

## 태스크 분해 (5개)
| # | 태스크 | 복잡도 | 의존성 |
|---|--------|--------|--------|
| 1 | Prisma User 모델에 profileImage 필드 추가 + 마이그레이션 | S | - |
| 2 | 프로필 조회/수정 API (GET/PATCH /api/profile) | M | T1 |
| 3 | S3 이미지 업로드 API (POST /api/profile/avatar) | M | T1 |
| 4 | 프로필 페이지 UI (조회 + 수정 폼 + 이미지 업로드) | L | T2, T3 |
| 5 | 보안 감사 — OWASP Top 10 점검 | S | T2, T3, T4 |

스펙과 태스크를 검토해주세요. 어떻게 진행할까요?
  ● 승인
  ○ 스펙 수정
  ○ 태스크 수정
  ○ 비판적 검토
```

```
> 승인
```

```
[내부: 플랜 생성 → 5개 태스크 DB 등록]
[내부: UI 관련 플랜 → plan-design-reviewer 에이전트 디스패치]

✓ 플랜 생성 완료 (ID: plan_a1b2c3)
✓ 태스크 5개 등록 완료

✓ Design Score: B (7.5/10) — 1개 개선 제안
  - State Coverage 6/10: Empty state(프로필 미설정 시) 정의 필요

[내부: B등급 → 요약 표시만, 후속 조치 없이 진행]
[내부: qa-seeder 디스패치 → seed 시나리오 8개 사전 생성]

✓ QA Seed 시나리오 8개 사전 생성됨

이 플랜은 5개 태스크, 3개 디렉토리에 걸친 변경입니다.
격리된 워크트리에서 작업하시겠습니까?
  ● 워크트리에서 작업
  ○ 현재 브랜치에서 작업
```

---

### Act 4: 워크트리 생성

```
> 워크트리에서 작업
```

```
[내부: /vs-worktree 실행]

워크트리 이름을 확인해주세요:
  ● user-profile-page (플랜 제목에서 자동 생성)
  ○ 직접 입력

→ 워크트리 생성 중...

✓ 워크트리 생성: .claude/worktrees/user-profile-page
✓ 브랜치: worktree-user-profile-page
✓ .gitignore 검증 통과
✓ 기술 스택 감지: Node.js (Next.js)
✓ npm ci 완료 (의존성 설치)
✓ npm test 베이스라인: 42/42 통과

⚡ freeze 보호를 활성화하시겠습니까? (워크트리 외부 편집 차단)
  ● 활성화 (권장)
  ○ 비활성화
```

```
> 활성화
```

```
✓ freeze 보호 활성화됨 — 워크트리 외부 파일 편집이 차단됩니다
✓ careful 모드 활성화됨 — 파괴적 명령이 차단됩니다

준비 완료! /vs-next로 첫 태스크를 시작하세요.
```

---

### Act 5: 태스크 실행 (핵심 루프)

```
> /vs-next
```

```
## 다음 태스크: T1 — Prisma User 모델에 profileImage 필드 추가

**Spec:**
User 모델에 profileImage(String?, nullable) 필드를 추가하고
Prisma 마이그레이션을 실행합니다.

**Acceptance Criteria:**
- AC01: User 모델에 profileImage 필드가 nullable String으로 존재
- AC02: 마이그레이션이 성공적으로 적용되고 기존 데이터에 영향 없음
- AC03: Prisma Client가 재생성되어 타입에 profileImage가 포함됨

**Scope:** prisma/schema.prisma, prisma/migrations/

이 태스크를 어떻게 구현할까요?
  ● TDD 에이전트 디스패치 (RED-GREEN-REFACTOR 자율 구현)
  ○ 직접 구현 (DB 마이그레이션에 적합)
  ○ 건너뛰기

💡 추천: DB 마이그레이션은 직접 구현이 적합합니다
```

```
> 직접 구현
```

```
[내부: 태스크 상태 → in_progress]
[내부: 직접 구현 모드 — prisma/schema.prisma 수정, 마이그레이션 실행]

구현 완료:
- prisma/schema.prisma: User 모델에 profileImage String? 추가
- prisma/migrations/20260401_add_profile_image: 마이그레이션 생성
- Prisma Client 재생성 완료

[내부: verifier 에이전트 디스패치 (sonnet) + qa-shadow 병렬 디스패치 (haiku)]

## 검증 리포트

### 최종 판정: PASS

### Verification (기술 검증)
- 테스트: PASS (42/42 passed)
- 빌드: PASS
- Lint: PASS

### Acceptance Criteria 검증
| # | 기준 | 매핑 | 판정 | 근거 |
|---|------|------|------|------|
| AC01 | profileImage nullable String | fallback | PASS | schema.prisma에 String? 확인 |
| AC02 | 마이그레이션 성공 | fallback | PASS | migration 적용 확인, 기존 데이터 무관 |
| AC03 | Prisma Client 재생성 | fallback | PASS | import { User } 타입에 profileImage 포함 |

### QA Shadow
- Verdict: CLEAN — 이슈 없음

✓ 태스크 T1 완료 (done)

다음으로 무엇을 하시겠습니까?
  ● 다음 태스크
  ○ 배치 실행 (남은 태스크를 자동으로 연속 실행)
  ○ 커밋 정리
  ○ 대시보드
```

---

### Act 5-1: 다음 태스크 (TDD 에이전트)

```
> 다음 태스크
```

```
## 다음 태스크: T2 — 프로필 조회/수정 API

**Spec:**
GET /api/profile → 현재 사용자 프로필 반환
PATCH /api/profile → 이름, 이메일 수정 (CSRF 검증 필수)

**Acceptance Criteria:**
- AC01: GET /api/profile이 인증된 사용자의 프로필을 반환
- AC02: PATCH /api/profile이 이름과 이메일을 수정
- AC03: 미인증 요청 시 401 반환
- AC04: CSRF 토큰 미전송 시 403 반환
- AC05: 유효하지 않은 이메일 형식 시 400 반환

**Scope:** src/app/api/profile/

이 태스크를 어떻게 구현할까요?
  ● TDD 에이전트 디스패치 (API 구현에 적합)
  ○ 직접 구현
  ○ 건너뛰기
```

```
> TDD 에이전트 디스패치
```

```
[내부: tdd-implementer 에이전트 디스패치 (opus)]
[내부: tdd-implementer Phase 0 → Error KB 사전 검색 → "auth middleware" 관련 1건 발견]
[내부: → "기존 auth middleware는 session.user를 사용" 주의사항 기록]
[내부: Phase 1 (RED) → 5개 AC에 대해 테스트 작성]
[내부: Phase 2 (GREEN) → API 구현]
[내부: Phase 3 (REFACTOR) → 중복 제거]
[내부: Phase 4 → 자기 리뷰]

## 구현 리포트

### Status: DONE

### Error KB 참조
- 검색 키워드: auth, profile, API
- 관련 패턴: 1건 — "auth middleware는 session.user로 접근" 주의
- 방어 테스트 추가: 1개 (AC03 미인증 테스트에 session 없는 경우 추가)

### RED Phase
- 작성한 테스트: 7개 (AC01~AC05 + 엣지케이스 2개)
- 실패 확인: ✅

### GREEN Phase
- 구현 파일: src/app/api/profile/route.ts
- 전체 테스트 통과: ✅ (49/49 passed)

### REFACTOR Phase
- 리팩토링: 에러 응답 헬퍼 함수 추출

[내부: verifier 에이전트 디스패치 (sonnet) + qa-shadow 병렬 디스패치 (haiku)]

## 검증 리포트

### 최종 판정: PASS

### Verification
- 테스트: PASS (49/49 passed)
- 빌드: PASS
- Lint: PASS

### Acceptance Criteria 검증
| # | 기준 | 매핑 | 판정 | 근거 |
|---|------|------|------|------|
| AC01 | GET 프로필 반환 | 테스트 매핑 | PASS | "AC01: 인증된 사용자..." 통과 |
| AC02 | PATCH 이름/이메일 수정 | 테스트 매핑 | PASS | "AC02: PATCH 요청..." 통과 |
| AC03 | 미인증 401 | 테스트 매핑 | PASS | "AC03: 미인증 요청..." 통과 |
| AC04 | CSRF 미전송 403 | 테스트 매핑 | PASS | "AC04: CSRF 미전송..." 통과 |
| AC05 | 잘못된 이메일 400 | 테스트 매핑 | PASS | "AC05: 유효하지 않은..." 통과 |

AC 매핑 커버리지: 5/5 (100%)

### Self-Challenge
- Error KB 대조: "auth middleware session" 패턴 — 현재 구현에 반영됨 ✅
- Rules 대조: 위반 없음
- 역방향 검증: AC04 반박 시도 — CSRF 토큰 재사용 시나리오 → 현재 구현에서 요청별 검증 확인됨
- 판정 조정: PASS 유지 (confidence: high)

### QA Shadow
- Verdict: CLEAN

✓ 태스크 T2 완료 (done)

다음으로 무엇을 하시겠습니까?
  ● 다음 태스크
  ● 배치 실행
  ○ 커밋 정리
  ○ 대시보드
```

---

### Act 5-2: 배치 실행으로 나머지 태스크 처리

```
> 배치 실행
```

```
남은 태스크 3개를 서브에이전트 기반으로 연속 실행합니다.

[Wave 1] T3: S3 이미지 업로드 API
  [내부: tdd-implementer 디스패치 → 구현 → verifier → PASS]
  ✅ T3 완료 — 테스트 56/56, AC 4/4 매핑

[Wave 2] T4: 프로필 페이지 UI
  [내부: tdd-implementer 디스패치 → 구현 → verifier → FAIL]

  ⚠️ T4 검증 실패:
  - AC02 (이미지 업로드 프리뷰): FAIL — FileReader API 호출은 있으나 프리뷰 렌더링 누락
  - 기술 검증: 테스트 2개 실패

  [내부: debugger 에이전트 자동 디스패치 (1차 시도)]
  [내부: debugger → Error KB 검색 → "FileReader onload 비동기 처리" 1건 발견]
  [내부: debugger → KB solution 참고하여 수정 → setState를 onload 콜백 안으로 이동]
  [내부: verifier 재검증 → PASS]

  ✅ T4 완료 (1회 자동 수정 후 PASS) — 테스트 63/63, AC 6/6 매핑
  ✓ Error KB 자동 기록: "React에서 FileReader 비동기 처리 시 setState 위치"

  [내부: Adaptive Planner Watcher → 이상 신호 없음]

[Wave 3] T5: 보안 감사
  [내부: 직접 구현 → vs-security 실행 → PASS]
  ✅ T5 완료 — critical/high 취약점 0건

## 배치 실행 완료

| # | 태스크 | 판정 | 재시도 |
|---|--------|------|--------|
| T3 | S3 이미지 업로드 API | PASS | 0회 |
| T4 | 프로필 페이지 UI | PASS | 1회 (debugger 자동 수정) |
| T5 | 보안 감사 | PASS | 0회 |

전체 태스크 5/5 완료!

다음으로 무엇을 하시겠습니까?
  ● 플랜 검증 (권장) — vs-qa → vs-plan-verify
  ○ 커밋 정리
  ○ 대시보드
```

---

### Act 6: QA 검증

```
> 플랜 검증
```

```
[내부: /vs-qa 실행]

QA 모드를 선택하세요:
  ● 전체 (Full) — 모든 완료 태스크 종합 검증
  ○ 증분 (Incremental)
  ○ 타겟 (Targeted)
  ○ Visual
  ○ 디자인 검증
  ○ 델타 (Delta)
```

```
> 전체
```

```
QA 깊이를 선택하세요:
  ○ Quick
  ● Standard (권장)
  ○ Thorough
```

```
> Standard
```

```
시나리오를 실행 전에 리뷰하시겠습니까?
  ○ 리뷰 후 실행 (권장)
  ● 바로 실행
```

```
> 바로 실행
```

```
[내부: QA Run 생성 → qa-coordinator 디스패치 (opus)]
[내부: Phase 1 → 프로젝트 분석 + Error KB 검색]
[내부: Phase 2 → 시나리오 생성 (seed 중복 방지: 8개 seed 시나리오 중 5개 AC 이미 커버)]
[내부: Seed 중복 방지: 8개 seed 시나리오 발견, 5개 AC 이미 커버됨, 12개 신규 시나리오 생성]
[내부: Phase 3 → qa-func-tester + qa-flow-tester + qa-acceptance-tester 병렬 디스패치]
[내부: (보안 키워드 감지 → qa-security-auditor도 디스패치)]
[내부: Phase 4 → qa-reporter 집계]

## QA 리포트

### Run: #1 | Mode: full | Depth: standard
### Plan: 사용자 프로필 페이지
### 판정: 🟢 GREEN (risk: 0.05)

### 시나리오 결과
| 카테고리 | 전체 | PASS | FAIL | WARN | SKIP |
|---------|------|------|------|------|------|
| functional | 8 | 8 | 0 | 0 | 0 |
| integration | 3 | 3 | 0 | 0 | 0 |
| flow | 3 | 3 | 0 | 0 | 0 |
| regression | 2 | 2 | 0 | 0 | 0 |
| edge_case | 4 | 3 | 0 | 1 | 0 |

### 발견 이슈 요약
| # | Severity | Category | Title |
|---|----------|----------|-------|
| 1 | 🟡 medium | edge_case | 5MB 이미지 업로드 시 타임아웃 경고 미표시 |

### 수정 플랜
- critical/high 이슈가 없어 수정 플랜을 생성하지 않았습니다.
- medium 이슈 1건은 다음 개발 사이클에서 처리를 권장합니다.

📄 QA 리포트: docs/qa/user-profile-page-run-1.md

다음으로 무엇을 하시겠습니까?
  ○ 이슈 상세 확인
  ● 대시보드 확인
  ○ QA 재실행
```

---

### Act 7: 대시보드 확인

```
> /vs-dashboard
```

```
📋 사용자 프로필 페이지 (5/5 — 100%)
[████████████████████] 100%
├─ ✅ done: 5  🔄 in_progress: 0  📝 todo: 0  🚫 blocked: 0  ⏭️ skipped: 0
└─ 속도: 2.5 tasks/day · 완료!

📦 백로그: 0개 미처리

🔬 최근 QA: Run #1 — 🟢 GREEN (risk: 0.05)
├─ 시나리오: 19/20 PASS, 1 WARN
└─ 이슈: 0 critical, 0 high, 1 medium

다음 단계 제안:
  ● 머지 (/vs-merge)
  ○ QA 재실행
  ○ 릴리즈 (/vs-release)
```

---

### Act 8: 머지

```
> /vs-merge
```

```
[내부: 워크트리 확인 ✓, 현재 브랜치: worktree-user-profile-page]

머지 타겟 브랜치를 선택하세요:
  ● main
  ○ develop
  ○ 직접 입력
```

```
> main
```

```
[내부: Phase 2 Research → 커밋 히스토리 분석, 전체 diff 읽기]
[내부: Phase 3 → squash-merge 실행]

## 머지 완료

### 커밋 메시지:
feat(profile): 사용자 프로필 조회/수정 페이지 구현

- Prisma User 모델에 profileImage 필드 추가 및 마이그레이션
- GET/PATCH /api/profile API (CSRF 검증 포함)
- S3 이미지 업로드 API (5MB 제한, 리사이즈)
- 프로필 페이지 UI (조회, 수정 폼, 이미지 업로드 프리뷰)
- OWASP Top 10 보안 감사 통과

Plan: user-profile-page (5/5 tasks)
QA: Run #1 GREEN (risk: 0.05)

### 변경 요약:
- 12 files changed, +487 insertions, +23 deletions
- 신규 테스트: 21개 추가 (63/63 통과)

✓ 워크트리 정리 완료
✓ main 브랜치로 복귀

/vs-recap으로 머지 결과를 확인하거나, /vs-release로 릴리즈할 수 있습니다.
```

---

## 시나리오 B: 다음 날 세션 복원

```
> (Claude Code 시작)
```

```
[SessionStart Hook 자동 실행]
session-restore-check.sh → 복원할 stash 없음
self-improve-status.sh → 대기 중인 개선 규칙: 1건
  "React FileReader 비동기 처리 시 setState는 onload 콜백 안에서 호출"
guardrail-status.sh → 안전장치 비활성 (워크트리 외부)
```

```
> /vs-resume
```

```
## 이전 세션 요약

마지막 작업:
- 플랜 "사용자 프로필 페이지" — 5/5 완료
- main에 머지됨 (커밋: feat(profile): 사용자 프로필 조회/수정...)
- QA: GREEN (risk: 0.05), medium 이슈 1건 미처리

📌 Self-Improve 대기: 1건
  "FileReader 비동기 처리" → .claude/rules/로 승격할까요?
  ● 승격 (향후 자동 적용)
  ○ 무시

다음 작업 제안:
  ○ 새 플랜 생성 (/vs-plan)
  ○ 백로그 확인 (/vs-backlog)
  ○ medium 이슈 처리 (/adhoc)
```

---

## 시나리오 C: 간단한 버그 수정

```
> /adhoc 로그인 버튼이 모바일에서 안 보여
```

```
[내부: 스펙/플랜 없이 즉시 처리 모드]
[내부: 코드 탐색 → src/components/LoginButton.tsx 발견]
[내부: CSS media query 확인 → max-width: 768px에서 display: none 발견]

문제를 찾았습니다:

src/components/LoginButton.tsx:23
  @media (max-width: 768px) { display: none; }

모바일에서 로그인 버튼이 숨겨지고 있습니다.
display: none을 제거하고 모바일용 레이아웃으로 변경하겠습니다.

[수정 적용 → 테스트 실행 → PASS]

✓ 수정 완료
- LoginButton: 모바일에서 flex 레이아웃으로 변경
- 기존 테스트 전부 통과 (63/63)

커밋할까요?
  ● 커밋
  ○ 추가 수정
```

---

## 시나리오 D: 검증 실패 시 자동 복구 흐름 상세

```
[내부: verifier → FAIL 판정]

## 검증 리포트
### 최종 판정: FAIL

- AC02 (이미지 프리뷰): FAIL — 프리뷰가 렌더링되지 않음
- 테스트: 2개 실패 (test_AC02_preview_render, test_AC02_preview_size)

[내부: debugger 에이전트 자동 디스패치 (opus)]
[내부: debugger Phase 1 → 실패 분석]
[내부: debugger Phase 1-2 → Error KB 검색 → "FileReader onload" 1건 발견]
[내부: → KB solution: "setState를 onload 콜백 안에서 호출해야 함"]
[내부: debugger Phase 2 → KB solution 기반으로 수정 적용]
[내부: debugger Phase 3 → FIX_APPLIED]

## 디버깅 리포트
### Status: FIX_APPLIED

### Error KB 참조
- 검색 키워드: FileReader, preview, image
- 유사 패턴: 1건 — "FileReader onload 비동기 처리 시 setState 위치"
- 활용 여부: KB solution 적용

### 수정 내용
- src/components/ProfileImageUpload.tsx:
  setState(preview)를 reader.onload 콜백 안으로 이동

### 수정 후 검증
- 테스트: PASS (63/63)
- 빌드: PASS

[내부: verifier 재검증 → PASS]
[내부: Error KB에 자동 기록]

✅ 자동 수정 성공 (1회 시도)
✓ Error KB 기록: "React FileReader 비동기 처리 — setState는 onload 안에서"
```

---

## 시나리오 E: QA에서 critical 이슈 발견 시

```
[내부: qa-reporter → critical 이슈 1건 발견]
[내부: 수정 플랜 자동 생성]

## QA 리포트
### 판정: 🟠 ORANGE (risk: 0.6)

### 발견 이슈
| # | Severity | Title |
|---|----------|-------|
| 1 | 🔴 critical | SQL Injection in profile search API |

### 수정 플랜
- 플랜: "QA Fix: 사용자 프로필 — Run #2" (ID: plan_fix_xyz)
- 태스크: 1개
- /vs-next로 바로 실행 가능

QA에서 1건의 critical 이슈가 발견되어 수정 플랜이 생성되었습니다.
바로 수정을 시작할까요?
  ● 즉시 실행 (권장)
  ○ 이슈 먼저 확인
  ○ 나중에 실행
```

```
> 즉시 실행
```

```
[내부: fix_plan_id로 vs-next 워크플로우 실행]
[내부: 수정 태스크 → TDD 에이전트 → verifier → PASS]

✅ QA Fix 태스크 완료
- Parameterized query로 SQL injection 방지
- 회귀 테스트 추가: tests/regression/qa-run-2-finding-1.test.ts

QA를 재실행하여 수정을 확인할까요?
  ● Delta 모드로 재검증 (빠름)
  ○ Full 모드로 재검증
  ○ 나중에
```

---

## 흐름 요약 치트시트

```
┌─────────────────────────────────────────────────────────┐
│                  일반적인 하루 작업                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  (Claude Code 시작 → SessionStart hooks 자동 실행)      │
│                                                         │
│  /vs-resume          ← 어제 작업 복원                   │
│       │                                                 │
│  /vs-plan            ← 새 기능이면 스펙부터             │
│       │                 (/vs-ideate로 아이디어 정리 가능)│
│       │                                                 │
│  /vs-worktree        ← 격리 환경 생성 (권장)            │
│       │                                                 │
│  /vs-next            ← 태스크 하나씩 실행               │
│       │                 (또는 /vs-exec로 일괄 실행)      │
│       │                                                 │
│  ┌────┤ 내부 자동 동작:                                 │
│  │    │ • tdd-implementer → 자율 TDD 구현               │
│  │    │ • verifier → 독립 검증                          │
│  │    │ • qa-shadow → 경량 병렬 QA                      │
│  │    │ • debugger → 실패 시 자동 수정                   │
│  │    │ • plan-advisor → 이상 감지 시 수정안             │
│  └────┤                                                 │
│       │                                                 │
│  /vs-dashboard       ← 진행 상황 확인                   │
│       │                                                 │
│  /vs-qa              ← 전체 QA (플랜 완료 후)           │
│       │                 → 수정 플랜 즉시 실행 가능       │
│       │                                                 │
│  /vs-merge           ← 워크트리 → main 머지             │
│       │                                                 │
│  /vs-release         ← 릴리즈 (선택)                    │
│                                                         │
│  ──────────────────────────────────────────────────      │
│  간단 작업: /adhoc   ← 스펙 없이 즉시 수정              │
│  버그 기록: /vs-backlog ← 나중에 처리할 항목 관리       │
│  에러 검색: /error-kb ← 과거 에러 해결책 조회           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```
