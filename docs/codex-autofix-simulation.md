# Codex Autofix 시뮬레이션 시나리오

> QA 에이전트가 버그를 발견한 후, Codex가 자동으로 수정하고 재검증하는 전체 흐름을 시뮬레이션합니다.

---

## 시나리오 1: Happy Path — 1회차 수정 성공

### 배경
- 프로젝트에 사용자 프로필 API가 있음
- QA가 `null` 처리 버그를 발견

### 1단계: QA 실행 → Finding 생성

```bash
$ vs qa run create plan_abc --trigger auto
# → run_id: run_001

# qa-flow-tester가 다음 시나리오를 FAIL 처리:
# "사용자 프로필 조회 시 nickname이 null이면 500 에러"
```

**qa-reporter 생성 finding:**
```json
{
  "id": "find_001",
  "run_id": "run_001",
  "severity": "high",
  "category": "bug",
  "title": "프로필 API에서 nickname null 시 500 에러",
  "description": "GET /api/profile에서 nickname이 null인 사용자 조회 시 TypeError 발생",
  "affected_files": "src/api/profile.ts",
  "fix_suggestion": "nickname 필드에 null coalescing 연산자(??) 적용"
}
```

### 2단계: Codex Autofix 제안 (qa-reporter 리포트)

```
### Codex Autofix 제안
Codex가 사용 가능합니다. 다음 findings를 자동 수정할 수 있습니다:
- [HIGH] 프로필 API에서 nickname null 시 500 에러 — `/vs-codex-autofix find_001`

전체 autofix: `/vs-codex-autofix run_001`
```

### 3단계: 사용자가 autofix 실행

```bash
$ /vs-codex-autofix find_001
```

### 4단계: 내부 흐름

```
[codex-detect] → { available: true, authenticated: true }

[codex-prompt-builder] → 프롬프트 생성:
  ## Bug Report
  **Title:** 프로필 API에서 nickname null 시 500 에러
  **Severity:** high
  **Category:** bug

  ## Description
  GET /api/profile에서 nickname이 null인 사용자 조회 시 TypeError 발생

  ## Suggested Fix
  nickname 필드에 null coalescing 연산자(??) 적용

  ## Affected Files
  ### src/api/profile.ts
  ```
  export function getProfile(userId: string) {
    const user = db.getUser(userId);
    return { name: user.nickname.trim(), email: user.email };
    //                      ↑ user.nickname이 null일 때 TypeError
  }
  ```

  ## Instructions
  Fix the bug described above. Only modify the affected files.

[codex-integration-db] → CodexIntegration 레코드 생성:
  { id: "ci_001", status: "pending", attempt: 1 }

[codex-rescue] → --write --effort high 실행
  status: "pending" → "running"

[Codex 수정 결과]:
  touchedFiles: ["src/api/profile.ts"]
  diff: `user.nickname.trim()` → `(user.nickname ?? '').trim()`

[scope 검증] → src/api/profile.ts ∈ allowed_files ✓
  status: "running" → "verifying"

[verification] → npx vitest run → 725/725 PASS
  verdict: "PASS"

[결과] → status: "passed"
```

### 5단계: Error KB 기록

```json
{
  "title": "[Codex Autofix] 프로필 API에서 nickname null 시 500 에러",
  "severity": "high",
  "tags": ["codex-autofix", "bug"],
  "cause": "nullable 필드에 대한 null 체크 누락",
  "solution": "null coalescing 연산자(??) 적용"
}
```

### 6단계: 사용자에게 결과 표시

```
✓ Autofix 성공 (1/1 attempt)
  - 수정 파일: src/api/profile.ts
  - 변경: user.nickname.trim() → (user.nickname ?? '').trim()
  - 테스트: 725/725 PASS
  - Error KB: 패턴 기록 완료

→ /vs-commit 으로 커밋하시겠습니까?
```

---

## 시나리오 2: 진화적 재시도 — 2회차 성공

### 배경
- 결제 모듈에서 동시성 버그 발견
- 1회차 수정이 부분적으로만 해결

### 1단계: Finding

```json
{
  "id": "find_002",
  "severity": "critical",
  "title": "동시 결제 요청 시 잔액 차감 race condition",
  "affected_files": "src/payment/deduct.ts,src/payment/lock.ts",
  "fix_suggestion": "트랜잭션 격리 수준 조정 또는 낙관적 잠금 적용"
}
```

### 2단계: 1회차 시도 — FAIL

```
[Attempt 1]
[codex-rescue] → deduct.ts에 mutex 추가
[verification] → npx vitest run → 723/725 FAIL
  실패 테스트: "concurrent deduct should not overdraw"
  verdict: "FAIL"

status: "failed", attempt: 1
```

### 3단계: 2회차 시도 — 진화적 프롬프트

```
[Attempt 2]
프롬프트에 추가:
  ---
  ## Previous Attempt Failed
  이전 시도에서 다음과 같은 수정을 했으나 실패함:
  ["src/payment/deduct.ts"]

  실패 이유: concurrent deduct should not overdraw — mutex가
  비동기 컨텍스트에서 제대로 작동하지 않음
  다른 접근법을 시도하세요.

[codex-rescue] → deduct.ts에 DB 레벨 SELECT FOR UPDATE 적용
[verification] → npx vitest run → 725/725 PASS
  verdict: "PASS"

status: "passed", attempt: 2
```

### 4단계: 결과

```
✓ Autofix 성공 (2/3 attempts)
  - 1회차: mutex 적용 → 비동기 컨텍스트 실패
  - 2회차: DB 레벨 SELECT FOR UPDATE → 성공
  - Error KB: "race condition → DB 레벨 잠금" 패턴 기록
```

---

## 시나리오 3: 에스컬레이션 — 3회 모두 실패

### 배경
- 복잡한 비즈니스 로직 버그
- Codex가 3회 시도해도 해결 못함

### 1단계: Finding

```json
{
  "id": "find_003",
  "severity": "critical",
  "title": "할인 쿠폰 적용 시 세금 계산 오류 (소수점 반올림 차이)",
  "affected_files": "src/billing/tax.ts,src/billing/discount.ts,src/billing/invoice.ts"
}
```

### 2단계: 3회 시도 모두 FAIL

```
[Attempt 1] → tax.ts에서 toFixed(2) 적용 → FAIL (discount 적용 순서 문제)
[Attempt 2] → discount 먼저 적용 후 tax 계산 → FAIL (invoice 합산 불일치)
[Attempt 3] → 근본 원인 재분석, BigDecimal 적용 → FAIL (기존 테스트 3개 깨짐)
```

### 3단계: 에스컬레이션

```
⚠ Autofix 에스컬레이션 (3/3 attempts 모두 실패)

## Autofix Escalation Report

Total attempts: 3

### Attempt 1
**Failure reason:** discount 적용 전에 tax를 계산하여 금액 불일치
**Diff:** tax.ts에 toFixed(2) 추가

### Attempt 2
**Failure reason:** invoice 합산 시 개별 항목 tax와 전체 tax가 1원 차이
**Diff:** discount.ts에서 적용 순서 변경

### Attempt 3
**Failure reason:** BigDecimal 도입으로 기존 테스트 3개 타입 불일치
**Diff:** tax.ts, discount.ts, invoice.ts에 BigDecimal 전면 도입

→ 수동 수정이 필요합니다.
  - "수동 수정" / "건너뛰기" / "다른 finding 진행"
```

---

## 시나리오 4: Codex 미설치 — Graceful Degradation

### 흐름

```
[codex-detect] → { available: false, authenticated: false }
[codex-autofix] → "Codex unavailable, skipping autofix"
[기존 QA 흐름] → qa-reporter가 findings만 생성, 수정 플랜으로 안내

# 리포트에는 Codex Autofix 제안 섹션이 표시되지 않음
# 기존 725/725 테스트 100% 통과 (zero regression)
```

---

## 시나리오 5: 인증 실패 폴백

### 흐름

```
[codex-detect] → { available: true, authenticated: false }
[캐시 무효화 + 재감지] → { available: true, authenticated: false }
[폴백] → "auth failed, falling back to standard QA flow"
         "codex setup을 실행하여 인증을 완료하세요"

# 해당 QA run 전체에서 autofix 비활성화
# 기존 QA 흐름으로 자동 전환
```

---

## 시나리오 6: 민감 파일 차단

### Finding

```json
{
  "affected_files": "src/auth/login.ts,.env,config/secrets.json,src/auth/token.ts"
}
```

### 프롬프트 생성 결과

```json
{
  "included_files": ["src/auth/login.ts", "src/auth/token.ts"],
  "excluded_sensitive_files": [".env", "config/secrets.json"],
  "prompt": "... (login.ts와 token.ts 코드만 포함, .env/secrets 제외)"
}
```

---

## 시나리오 7: Scope 위반 롤백

### 상황
- finding의 affected_files: `src/api/user.ts`
- Codex가 `src/api/user.ts` + `src/core/db.ts` 수정

### 흐름

```
[scope 검증]
  allowed: ["src/api/user.ts"]
  diff:    ["src/api/user.ts", "src/core/db.ts"]
  위반:    ["src/core/db.ts"]

[롤백] → git checkout src/core/db.ts
[로그] → "scope violation: 1 file(s) outside allowed scope — rolling back"

# src/api/user.ts 수정만 유지하고 재검증 진행
```

---

## 시나리오 8: 일괄 Autofix (run 단위)

### 상황
- QA run에서 critical 2건, high 3건 발견
- 동일 파일 영향 건이 있음

### 흐름

```bash
$ /vs-codex-autofix run_001
```

```
[의존성 분석]
  그룹 A (독립): find_001 (src/api/profile.ts), find_003 (src/billing/tax.ts)
  그룹 B (순차): find_002 + find_004 (둘 다 src/payment/deduct.ts 영향)
  독립: find_005 (src/auth/login.ts)

[실행 전략]
  1. 그룹 A + find_005 병렬 실행 (3건 동시)
  2. 그룹 B 순차 실행 (find_002 완료 후 find_004)

[결과]
  find_001: PASS (1회차)
  find_003: FAIL → PASS (2회차)
  find_005: PASS (1회차)
  find_002: PASS (1회차)
  find_004: PASS (1회차) — find_002 수정 후 진행

✓ 5/5 findings 자동 수정 완료
  총 시도: 6회 (5 성공 + 1 재시도)
  → /vs-commit 으로 커밋하시겠습니까?
```

---

## 실행 커맨드 요약

| 커맨드 | 용도 |
|--------|------|
| `vs codex detect` | Codex 가용성 확인 |
| `/vs-codex-autofix <finding_id>` | 단일 finding 자동 수정 |
| `/vs-codex-autofix <run_id>` | QA run의 critical/high 일괄 수정 |
| `/vs-codex-autofix --dry-run <finding_id>` | 프롬프트만 미리보기 |
| `vs qa autofix status <finding_id>` | autofix 상태 조회 |
| `vs qa autofix list <run_id>` | run별 autofix 목록 |
