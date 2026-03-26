# Self-Improving Pipeline 설계서

> "AI가 실수할 때마다 자동으로 규칙을 만들어, 같은 실수를 두 번 안 하는 시스템"
> Inspired by Karpathy's autoresearch

## 1. 현재 상태 진단

### 있는 것
| 구성요소 | 상태 | 한계 |
|----------|------|------|
| Error KB 인프라 | 구조만 존재 (0건) | 수동 기록 의존, 자동 생성 없음 |
| error-kb-suggest hook | 에러 감지 → 검색 제안 | "제안"만 함, 규칙 생성 없음 |
| Verifier → Debugger 파이프라인 | FAIL → fix → re-verify | fix 후 학습 없음 (같은 실수 반복 가능) |
| on-commit-sync hook | fix: 커밋 감지 | 태스크 상태만 업데이트, 원인 분석 없음 |

### 없는 것 (= 구축 대상)
1. **자동 규칙 생성**: fix 후 "왜 틀렸는가?" → 규칙 scaffold
2. **규칙 자동 적용**: 축적된 규칙이 다음 작업에 자동 주입
3. **Self-Challenge**: "이게 최선인가?" 재검증 게이트
4. **패턴 승격**: 3회+ 반복 에러 → CLAUDE.md 승격
5. **규칙 수명 관리**: 폭발 방지, 효과 측정, 정리

---

## 2. 핵심 설계 원칙

### 2.1 Hook ≠ 자동화

> "hook이 존재한다 ≠ 자동화가 완성되었다"

Claude Code hook의 물리적 한계:
- Hook = **셸 스크립트** (bash). Claude를 호출할 수 없음
- Hook이 할 수 있는 것: **감지(detect)**, **차단(block)**, **맥락 주입(additionalContext)**
- Hook이 할 수 없는 것: **분석(analyze)**, **생성(generate)**, **판단(judge)**

따라서 아키텍처는 반드시 **2-tier**:

```
[Hook Layer]  감지/차단/주입  →  셸 스크립트, 빠르고 확정적
     ↓ additionalContext
[Skill Layer]  분석/생성/판단  →  Claude가 실행, 느리지만 지능적
```

### 2.2 규칙은 3-tier 저장

| Tier | 위치 | 자동 로딩 | 용도 | 수명 |
|------|------|-----------|------|------|
| **T1: Active Rules** | `.claude/rules/*.md` | 매 세션 자동 | 검증된 반복 패턴 (3회+) | 영구 (수동 정리) |
| **T2: Error KB** | `.claude/error-kb/errors/*.md` | 검색 시 | 모든 에러 기록 + 해결책 | 영구 (상태 관리) |
| **T3: Session Context** | hook additionalContext | 해당 세션 | 방금 발생한 에러의 즉시 주입 | 세션 한정 |

**승격 경로**: T3 (발생) → T2 (기록) → T1 (3회+ 반복 시 승격)

### 2.3 Bash 한계 우회: 중간 파일 패턴

Hook에서 복잡한 분석이 필요할 때:
```
Hook(bash) → 중간 파일(.claude/self-improve/pending/*.json) 생성
          → additionalContext로 "pending self-improve 있음" 알림
          → Claude가 Skill로 처리
```

---

## 3. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    SESSION START                         │
│  [session-rules-load hook]                              │
│  - .claude/rules/*.md 로딩 (Claude Code 네이티브)       │
│  - pending self-improve 파일 감지 → 처리 제안           │
│  - 쿨다운 체크 → self-improve 시점이면 제안             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│                 IMPLEMENTATION                           │
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │ TDD-Impl │ →  │ Verifier │ →  │ Debugger │          │
│  └──────────┘    └────┬─────┘    └────┬─────┘          │
│                       │               │                 │
│               PASS/WARN/FAIL    FIX_APPLIED/            │
│                       │         NEEDS_MANUAL            │
│                       ↓               ↓                 │
│            ┌──────────────────────────────┐             │
│            │    SELF-CHALLENGE GATE       │ ← NEW       │
│            │  "이게 정말 최선인가?"        │             │
│            └──────────┬──────────────────┘             │
│                       ↓                                 │
│            ┌──────────────────────────────┐             │
│            │    ERROR KB PATTERN CHECK    │ ← NEW       │
│            │  과거 에러 패턴과 대조        │             │
│            └──────────┬──────────────────┘             │
└───────────────────────┼─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   COMMIT                                 │
│                                                         │
│  [pre-commit-rule-check hook] ← NEW                     │
│  - .claude/rules/ 위반 체크                             │
│  - 위반 시 additionalContext로 경고                      │
│                                                         │
│  [on-commit-sync hook] (기존)                           │
│  - fix:/hotfix: 감지                                    │
│                                                         │
│  [self-improve-trigger hook] ← NEW                      │
│  - fix 커밋 감지 → diff 추출 → pending 파일 생성        │
│  - additionalContext: "자동 규칙 생성 대기 중"           │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│              SELF-IMPROVE CYCLE                          │
│                                                         │
│  [self-improve skill] ← NEW                             │
│  1. pending 파일 읽기                                   │
│  2. diff 분석 → 근본 원인 추출                          │
│  3. Error KB 기록 (T2)                                  │
│  4. 규칙 scaffold 생성                                   │
│  5. occurrences >= 3 이면 .claude/rules/ 승격 (T1)      │
│  6. pending 파일 정리                                   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│            CONTINUOUS IMPROVEMENT                        │
│                                                         │
│  [session-start 쿨다운 체크]                            │
│  - 마지막 self-improve로부터 1시간+ 경과                │
│  - 누적 에러 5건+ 미처리                                │
│  → "self-improve 실행 권장" additionalContext 주입       │
│                                                         │
│  [self-improve-review skill] ← NEW                      │
│  - 규칙 효과성 검토 (생성 후 재발 여부)                 │
│  - 유사 규칙 통합                                       │
│  - 비활성 규칙 아카이브                                 │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 상세 컴포넌트 설계

### 4.1 Self-Improve Trigger Hook

**파일**: `hooks/self-improve-trigger.sh`
**Hook 포인트**: PostToolUse (Bash)
**트리거 조건**: git commit 명령 + fix:/hotfix:/debug: 타입

```bash
# 핵심 로직 (의사코드)
1. commit 메시지에서 fix:/hotfix:/debug: 감지
2. git diff HEAD~1 → 변경 내용 추출 (첫 100줄)
3. pending 파일 생성:
   .claude/self-improve/pending/{timestamp}.json
   {
     "type": "fix_commit",
     "commit_hash": "abc1234",
     "commit_message": "fix(auth): null check 누락 수정",
     "diff_summary": "src/auth/login.ts +5/-1",
     "diff_content": "... (첫 100줄)",
     "task_id": "TASK-123" (있으면),
     "timestamp": "2026-03-25T10:30:00Z"
   }
4. additionalContext 출력:
   "fix 커밋이 감지되었습니다. `/self-improve`로 자동 규칙을 생성하세요."
```

**설계 결정: 왜 즉시 규칙을 만들지 않는가?**

즉시 생성의 문제:
- Hook은 bash만 가능 → 규칙 품질이 낮음 (grep 수준의 패턴 매칭)
- 잘못된 규칙이 자동으로 rules/에 들어가면 오히려 해로움
- "규칙 생성" 자체가 AI 판단이 필요한 작업

따라서 **2-phase**: hook이 신호를 수집 → skill이 지능적으로 처리

### 4.2 Self-Improve Skill

**파일**: `skills/self-improve/SKILL.md`
**호출**: `/self-improve` (수동) 또는 session-start에서 자동 제안

```markdown
## Steps

### Phase 1: Pending 수집
- .claude/self-improve/pending/*.json 읽기
- 이미 처리된 항목 필터링 (.claude/self-improve/processed/ 존재 여부)

### Phase 2: 근본 원인 분석
각 pending 항목에 대해:
1. diff 내용 분석 → "무엇이 틀렸는가?"
2. 커밋 메시지 + 태스크 컨텍스트 → "왜 틀렸는가?"
3. 카테고리 분류:
   - LOGIC_ERROR: 로직 오류 (null check, 경계값, 조건 반전)
   - TYPE_ERROR: 타입 불일치, 잘못된 타입 사용
   - API_MISUSE: API/라이브러리 잘못된 사용법
   - MISSING_EDGE: 엣지 케이스 누락
   - PATTERN_VIOLATION: 프로젝트 패턴 위반
   - CONFIG_ERROR: 설정/환경 관련 실수
   - TEST_GAP: 테스트 커버리지 부족

### Phase 3: Error KB 기록 (T2)
- `vs error-kb search "<관련 키워드>"` → 기존 항목 확인
- 기존 항목 있음 → `vs error-kb update <id> --occurrence "..."`
- 기존 항목 없음 → `vs error-kb add --title "..." --cause "..." --solution "..." --tags "..." --severity <level>`

### Phase 4: 규칙 Scaffold 생성
Error KB 항목의 occurrences >= 3 이면:

규칙 파일 생성: `.claude/rules/{category}-{slug}.md`

규칙 템플릿:
---
title: {규칙 제목}
source: self-improve
error_kb_id: {KB ID}
occurrences: {횟수}
created: {날짜}
last_triggered: {날짜}
---

## Rule
{한 문장으로 된 규칙}

## Why
{이 규칙이 필요한 이유 - 과거 에러 사례 요약}

## Examples
### Bad
{잘못된 코드 패턴}

### Good
{올바른 코드 패턴}

## Applies When
{이 규칙이 적용되는 상황 조건}

### Phase 5: Pending 정리
- 처리 완료된 항목을 .claude/self-improve/processed/로 이동
- 처리 결과 요약 출력
```

### 4.3 Self-Challenge Gate

**위치**: Verifier Agent에 Phase 3.5로 추가
**트리거**: Verifier가 PASS 판정을 내릴 때 (WARN/FAIL은 이미 문제가 있으므로 불필요)

```markdown
### Phase 3.5: Self-Challenge (PASS 판정 시에만)

"PASS라고 판단했지만, 정말 맞는가?"

1. **역방향 검증**: PASS 근거를 하나씩 반박해보기
   - "테스트가 통과했지만, 테스트 자체가 불충분하지 않은가?"
   - "AC를 충족했지만, AC에 빠진 케이스가 없는가?"
   - "빌드가 통과했지만, 런타임에 문제가 될 수 있지 않은가?"

2. **Error KB 대조**: 현재 변경과 유사한 과거 에러가 있는가?
   - 변경된 파일/모듈에 대한 KB 검색
   - 동일 카테고리의 과거 에러 패턴 확인
   - 유사 패턴 발견 시 해당 해결책이 적용되었는지 확인

3. **Rules 대조**: .claude/rules/에서 관련 규칙 위반 여부
   - 변경 내용이 기존 규칙을 위반하지 않는지 확인

4. **판정 조정**:
   - Challenge에서 실제 문제 발견 → PASS를 WARN으로 하향
   - Challenge에서 문제 없음 → PASS 유지 (confidence: high)
```

**설계 결정: 왜 모든 판정에 Self-Challenge를 하지 않는가?**

- FAIL은 이미 문제를 알고 있음 → challenge 불필요
- WARN은 이미 불확실성이 있음 → challenge보다 fix가 우선
- PASS만 "확신의 함정"이 있음 → "3번 완료 선언 → 3번 틀림" 방지

### 4.4 Pre-Commit Rule Check Hook

**파일**: `hooks/pre-commit-rule-check.sh`
**Hook 포인트**: PreToolUse (Bash)
**트리거**: git commit 명령 감지

```bash
# 핵심 로직
1. git diff --cached 에서 변경 파일 목록 추출
2. .claude/rules/*.md에서 "Applies When" 섹션 파싱
3. 각 규칙의 적용 조건과 변경 파일/내용 매칭
4. 매칭되는 규칙이 있으면 additionalContext로 경고:
   "⚠️ 다음 규칙을 확인하세요:
    - [null-check-required] src/auth/ 관련 변경 시 null check 필수
    - [api-version-check] API 호출 시 버전 파라미터 확인"
```

**한계와 현실적 접근**:
- Bash로 "코드가 규칙을 위반하는가?"를 정확히 판단하는 것은 불가능
- 따라서 "관련될 수 있는 규칙을 리마인드"하는 수준으로 설계
- 실제 위반 판단은 Claude(Verifier)에게 위임

### 4.5 Session Rules Load (SessionStart 확장)

**기존** `session-restore-check.sh` 확장 또는 별도 hook

```bash
# 추가 로직
1. .claude/self-improve/pending/ 에 미처리 파일이 있는지 확인
   → "미처리 self-improve 항목 N건 있습니다. `/self-improve`로 처리하세요."

2. .claude/self-improve/last_run 타임스탬프 확인
   → 1시간+ 경과 + 누적 pending 3건+ → "self-improve 실행 권장"

3. .claude/rules/ 파일 수 확인
   → 30개 초과 시 "규칙 정리 필요. `/self-improve-review`로 검토하세요."
```

### 4.6 Enhanced Error Pattern Detection

**기존** `error-kb-suggest.sh` 강화

현재: exit code != 0 일 때만 감지
추가할 감지 패턴:

```bash
# 추가 감지 대상
1. Verifier FAIL 판정 출력 감지
   - "### Verdict: FAIL" 패턴
   - → pending 파일 자동 생성 (commit 없이도)

2. Debugger FIX_APPLIED 감지
   - "### Status: FIX_APPLIED" 패턴
   - → pending 파일 생성 + 디버거 리포트 첨부

3. 반복 에러 감지 강화
   - 같은 세션에서 동일 파일의 에러가 2회+ 발생
   - → "반복 에러 감지. 근본 원인 분석이 필요합니다."
```

---

## 5. QA Gate 체계 (10개)

기존 5개 + 신규 5개 = 10개 QA Gate

| # | Gate | 위치 | 유형 | HARD/SOFT |
|---|------|------|------|-----------|
| 1 | **Test** | Verifier Phase 1 | 기존 | HARD — 실패 시 FAIL |
| 2 | **Build** | Verifier Phase 1 | 기존 | HARD — 실패 시 FAIL |
| 3 | **Lint** | Verifier Phase 1 | 기존 | SOFT — 실패 시 WARN |
| 4 | **AC Cross-check** | Verifier Phase 2 | 기존 | HARD — FAIL 항목 있으면 FAIL |
| 5 | **Scope Verification** | Verifier Phase 2.5 | 기존 | SOFT — 위반 시 WARN |
| 6 | **Error KB Pattern** | Verifier Phase 3.5 | **신규** | SOFT — 유사 패턴 발견 시 WARN |
| 7 | **Rule Compliance** | Verifier Phase 3.5 | **신규** | SOFT — 위반 시 WARN (첫 발생), HARD (2회+) |
| 8 | **Self-Challenge** | Verifier Phase 3.5 | **신규** | SOFT — 문제 발견 시 PASS→WARN |
| 9 | **Regression** | Post-Debugger | **신규** | HARD — fix가 다른 것을 깨뜨리면 FAIL |
| 10 | **Rule Generation** | Post-Fix | **신규** | SOFT — fix 후 규칙 미생성 시 WARN |

**HARD Gate**: 미통과 시 커밋/완료 불가
**SOFT Gate**: 미통과 시 경고, `--force`로 우회 가능

---

## 6. Hook 전체 맵 (기존 5 + 신규 7 = 12개)

### SessionStart (2)
| Hook | 기능 | 상태 |
|------|------|------|
| session-restore-check | 세션 복구 컨텍스트 | 기존 |
| **self-improve-status** | pending 체크 + 쿨다운 + 규칙 수 경고 | **신규** |

### PreToolUse (3)
| Hook | Matcher | 기능 | 상태 |
|------|---------|------|------|
| worktree-guard | Bash | 워크트리 안전장치 | 기존 |
| **pre-commit-rule-check** | Bash | 커밋 전 규칙 리마인드 | **신규** |
| **edit-rule-check** | Edit | 수정 전 관련 규칙 리마인드 | **신규** |

### PostToolUse (7)
| Hook | Matcher | 기능 | 상태 |
|------|---------|------|------|
| on-commit-sync | Bash | 커밋-태스크 동기화 | 기존 |
| error-kb-suggest | Bash | 에러 감지 → KB 검색 제안 | 기존 (강화) |
| worktree-exit-guide | ExitWorktree | 워크트리 종료 안내 | 기존 |
| **self-improve-trigger** | Bash | fix 커밋 → pending 파일 생성 | **신규** |
| **verifier-fail-capture** | Agent | Verifier FAIL → pending 생성 | **신규** |
| **debugger-fix-capture** | Agent | Debugger FIX → pending 생성 | **신규** |
| **rule-generation-remind** | Bash | pending 누적 시 리마인드 | **신규** |

---

## 7. 규칙 수명 관리

### 7.1 규칙 폭발 방지

```
최대 활성 규칙: 30개 (.claude/rules/)
초과 시: 가장 오래 미트리거된 규칙부터 아카이브
아카이브 위치: .claude/rules/archive/
```

### 7.2 규칙 효과 측정

각 규칙 파일의 frontmatter에 추적 필드:
```yaml
occurrences: 5        # 에러 발생 횟수 (생성 전)
prevented: 2          # 규칙으로 방지한 횟수 (생성 후)
last_triggered: 2026-03-20  # 마지막으로 관련된 날짜
effectiveness: 0.4    # prevented / (prevented + post_occurrences)
```

### 7.3 규칙 정리 주기 (self-improve-review)

**트리거**: 수동 (`/self-improve-review`) 또는 규칙 수 > 25일 때 자동 제안

```
1. 효과 없는 규칙 (prevented=0, 30일+ 미트리거) → 아카이브 제안
2. 유사 규칙 (같은 카테고리, 같은 파일 패턴) → 통합 제안
3. 상충 규칙 → 경고 + 해결 제안
4. 잘못된 규칙 (post_occurrences > prevented * 2) → 수정/삭제 제안
```

---

## 8. 데이터 흐름 예시

### 시나리오: null check 누락 버그

```
[작업] auth 모듈에 소셜 로그인 추가
   ↓
[TDD-Impl] 구현 완료, 테스트 통과
   ↓
[Verifier] Phase 1: 테스트 PASS, 빌드 PASS
           Phase 2: AC 전항목 PASS
           Phase 3.5: Self-Challenge
           → "user.profile이 null일 때 처리가 없다"
           → PASS → WARN 하향
   ↓
[개발자] WARN 무시하고 커밋
   ↓
[프로덕션] NullPointerError 발생
   ↓
[디버깅] fix(auth): user.profile null check 추가
   ↓
[self-improve-trigger hook]
   → pending 파일 생성: null-check-auth.json
   → "fix 커밋 감지. /self-improve 실행 권장"
   ↓
[/self-improve skill]
   → diff 분석: user.profile?.name 추가
   → 근본 원인: 옵셔널 체이닝 누락
   → 카테고리: LOGIC_ERROR
   → Error KB 기록: "소셜 로그인 시 profile null 가능"
   ↓
[3번째 발생 시]
   → occurrences >= 3 감지
   → .claude/rules/logic-null-check-external-data.md 생성:

     ## Rule
     외부 API/OAuth 응답 데이터는 모든 필드가 optional이라고 가정하라.

     ## Why
     소셜 로그인 provider마다 응답 형식이 다르고,
     특정 필드가 누락될 수 있다. (3회 반복 발생)

     ## Applies When
     OAuth, 소셜 로그인, 외부 API 응답 처리 시
   ↓
[다음 작업] Twitter 로그인 추가
   → [edit-rule-check hook] "외부 API 응답 처리 시 null check 규칙 확인"
   → [Verifier Phase 3.5] Rule Compliance 체크: null check 있는지 확인
   → 같은 실수 방지 ✓
```

---

## 9. 구현 우선순위

### Phase 1: 기초 인프라 (1-2일)

> 최소한의 학습 루프를 만드는 것이 목표

1. **디렉토리 구조 생성**
   ```
   .claude/
   ├── rules/              # T1: 자동 로딩 규칙
   │   └── archive/        # 아카이브된 규칙
   ├── error-kb/           # T2: 에러 지식 베이스 (기존)
   │   └── errors/
   └── self-improve/       # 중간 파일
       ├── pending/        # 처리 대기
       ├── processed/      # 처리 완료
       └── last_run        # 마지막 실행 타임스탬프
   ```

2. **self-improve-trigger hook** 구현
   - fix:/hotfix: 커밋 감지 → pending JSON 생성

3. **self-improve skill** 기본 구현
   - pending 읽기 → diff 분석 → Error KB 기록

### Phase 2: 자동 규칙 생성 (2-3일)

4. **규칙 scaffold 생성** (self-improve skill 확장)
   - Error KB occurrences >= 3 → .claude/rules/ 생성

5. **pre-commit-rule-check hook** 구현
   - 커밋 전 관련 규칙 리마인드

6. **self-improve-status hook** (SessionStart)
   - pending 상태 + 쿨다운 체크

### Phase 3: Self-Challenge (3-4일)

7. **Verifier Phase 3.5** 추가
   - Error KB 대조
   - Rule Compliance 체크
   - 역방향 검증

8. **verifier-fail-capture hook** 구현
   - FAIL → pending 자동 생성 (커밋 없이도 학습)

9. **debugger-fix-capture hook** 구현
   - FIX_APPLIED → pending + 디버거 리포트

### Phase 4: 연속 개선 (4-5일)

10. **self-improve-review skill** 구현
    - 규칙 효과 측정, 정리, 통합

11. **edit-rule-check hook** 구현
    - 코드 수정 전 관련 규칙 주입

12. **규칙 수명 관리** 자동화
    - 30개 상한, 아카이브, 효과 추적

---

## 10. 근본 한계와 대응

### 10.1 AI 판단의 한계 (나머지 10%)

| 한계 | 발생 조건 | 대응 |
|------|----------|------|
| **잘못된 규칙 생성** | AI가 근본 원인을 오판 | 규칙에 effectiveness 추적, 낮으면 자동 제안으로 삭제 |
| **과도한 규칙** | 모든 에러에 규칙 생성 | 3회+ 반복만 승격, 상한 30개 |
| **Self-Challenge 맹점** | AI가 못 찾는 문제 유형 | 외부 검증 유지 (simplify-loop, vs-qa) |
| **규칙 충돌** | 두 규칙이 상반된 지시 | self-improve-review에서 충돌 감지 |
| **Context pollution** | 규칙이 너무 많아 성능 저하 | T1(rules/) 30개 상한, 나머지는 T2(KB) |

### 10.2 "3번 완료 선언 → 3번 틀림" 방지

이것이 Self-Challenge의 핵심 동기. 대응:

```
1차 방어: Self-Challenge가 PASS를 의심
2차 방어: Error KB에서 유사 패턴 발견 시 WARN
3차 방어: 규칙 위반 감지 시 WARN
4차 방어: --force 없이는 WARN 상태로 커밋 불가 (QA Gate)
```

### 10.3 "Bash 한계 핑계 금지"

중간 파일 패턴으로 우회:
- Hook(bash)은 **신호 수집**(JSON 생성)만 담당
- 분석/판단은 **Skill(Claude)**이 담당
- 이 분리가 Hook = 자동화의 핵심

---

## 11. 성공 지표

| 지표 | 측정 방법 | 목표 |
|------|----------|------|
| **동일 에러 재발율** | (post_occurrences / total_occurrences) | < 20% |
| **규칙 효과성** | (prevented / (prevented + post_occurrences)) | > 60% |
| **Self-Challenge 적중률** | (실제 문제 발견 / challenge 실행 수) | > 15% |
| **평균 디버깅 시간** | Debugger 실행 시간 추적 | 30% 단축 |
| **Error KB 활용률** | 검색 후 해결책 적용 비율 | > 50% |

---

## 부록: .claude/rules/ 예시

### `.claude/rules/logic-null-check-external-data.md`
```markdown
---
title: 외부 데이터 null 안전성
source: self-improve
error_kb_id: ERR-007
category: LOGIC_ERROR
occurrences: 4
prevented: 1
created: 2026-03-20
last_triggered: 2026-03-25
effectiveness: 0.25
---

## Rule
외부 API/OAuth/DB 쿼리 결과의 모든 필드는 optional로 취급하라.
옵셔널 체이닝(?.) 또는 명시적 null check를 반드시 사용할 것.

## Why
소셜 로그인 provider 응답에서 profile.name이 null인 경우가 3회 발생.
각각 다른 provider에서 발생하여 패턴으로 승격됨.

## Examples
### Bad
const name = user.profile.name;

### Good
const name = user.profile?.name ?? 'Unknown';

## Applies When
- OAuth 응답 처리
- 외부 API 응답 파싱
- DB 쿼리 결과에서 JOIN된 테이블의 필드 접근
```
