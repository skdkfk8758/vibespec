# Skeleton Guard E2E 검증 시나리오

골격 문서가 실제 플래닝/구현/QA에서 가이드라인으로 정확히 동작하는지 검증합니다.

## 시나리오 A: 플래닝 시 PRD Out of Scope 위반 감지

**카테고리**: 플래닝 (plan-check)
**우선순위**: Critical

### 전제
- PRD.md가 존재하며 Out of Scope에 "다국어 지원" 항목이 정의됨
- QA config에서 `modules.skeleton_guard: true`

### 행위
1. `/vs-plan`으로 "다국어 지원 기능 추가" 스펙 작성
2. MUST 요구사항에 "다국어 번역 시스템 구현" 포함

### 기대 결과
- skeleton-guard plan-check가 Rule P-01 (Out of Scope 위반) 발동
- Verdict: **ALERT** (Critical)
- 통합 체크포인트에 "⚠️ Critical 이슈 감지" 표시
- 스펙 수정 강력 권장

### 수동 검증 체크리스트
- [ ] skeleton-guard 디스패치가 실행됨
- [ ] Rule P-01 finding이 생성됨
- [ ] severity가 "critical"임
- [ ] 통합 체크포인트에 ALERT가 표시됨
- [ ] "스펙 수정" 선택 시 재작업 가능

---

## 시나리오 B: 플래닝 시 ARCHITECTURE 불일치 감지

**카테고리**: 플래닝 (plan-check)
**우선순위**: Warning

### 전제
- ARCHITECTURE.md가 존재하며 Module Structure에 `src/api`, `src/core`, `src/models` 정의
- `src/analytics` 모듈은 미정의

### 행위
1. `/vs-plan`으로 "사용자 행동 분석 시스템" 스펙 작성
2. Data Model에 `src/analytics/tracker.ts` 경로 포함

### 기대 결과
- skeleton-guard가 Rule A-01 (Module Structure 불일치) 발동
- Verdict: **WARNING**
- "ARCHITECTURE에 미정의 모듈: analytics. ADR을 작성하세요." 메시지

### 수동 검증 체크리스트
- [ ] Rule A-01 finding 생성
- [ ] severity가 "warning"임
- [ ] ADR 작성 안내 메시지 포함
- [ ] WARNING이지만 플래닝 진행은 차단하지 않음

---

## 시나리오 C: 구현 시 POLICY Naming Convention 위반 감지

**카테고리**: 구현 (impl-check)
**우선순위**: Warning

### 전제
- POLICY.md가 존재하며 Naming Convention에 "파일명: kebab-case" 정의
- `modules.skeleton_guard: true`

### 행위
1. `/vs-next`로 태스크 실행
2. `src/components/UserProfile.tsx` 파일 생성 (kebab-case 위반)

### 기대 결과
- skeleton-guard impl-check가 Rule I-01 발동
- Verdict: **WARNING**
- "Naming Convention 위반: 'UserProfile.tsx'가 kebab-case 규칙과 불일치" 메시지
- 경고 "억제" 옵션 제공

### 수동 검증 체크리스트
- [ ] impl-check가 vs-next Step 10에서 자동 디스패치됨
- [ ] Rule I-01 finding 생성
- [ ] 검증 리포트에 Skeleton Guard 섹션 표시
- [ ] "이 경고 억제" 옵션 제공됨

---

## 시나리오 D: 구현 시 Security Policy 위반 감지

**카테고리**: 구현 (impl-check)
**우선순위**: Critical

### 전제
- POLICY.md에 Security Policy "입력 검증 필수" 정의
- `modules.skeleton_guard: true`

### 행위
1. `/vs-next`로 API 태스크 실행
2. `req.body.userId`를 validation 없이 직접 DB 쿼리에 사용

### 기대 결과
- skeleton-guard가 Rule I-02 (Security Policy 위반) 발동
- Verdict: **ALERT** (Critical)
- 사용자에게 "수정 후 재검증 / 무시 / 차단" 선택 제공

### 수동 검증 체크리스트
- [ ] Rule I-02 finding 생성
- [ ] severity가 "critical"임
- [ ] AskUserQuestion으로 3가지 선택지 제공
- [ ] "수정 후 재검증" 선택 시 재검증 흐름 동작

---

## 시나리오 E: Alert Fatigue 방지 동작

**카테고리**: alert fatigue
**우선순위**: Medium

### 전제
- 시나리오 C에서 WARNING 발생 후 사용자가 "이 경고 억제" 선택
- 동일 세션 내에서 작업 계속

### 행위
1. 다음 태스크에서 동일한 Naming Convention 위반 재발생 (같은 rule_id + 유사 file_pattern)
2. skeleton-guard impl-check 재실행

### 기대 결과
- dismissed_warnings에 의해 동일 경고가 자동 필터링
- 리포트에 "(1건 억제됨)" 표시
- 사용자에게 해당 경고 미표시

### 수동 검증 체크리스트
- [ ] 첫 번째 경고에서 "억제" 선택 가능
- [ ] 두 번째 실행에서 동일 경고 미표시
- [ ] 리포트에 억제 건수 표시
- [ ] Critical finding은 억제되지 않음 (별도 확인 필요)

---

## 시나리오 F: 골격 문서 부재 시 Graceful Skip

**카테고리**: graceful degradation
**우선순위**: High

### 전제
- 프로젝트 루트에 골격 문서 0개
- `modules.skeleton_guard: true`

### 행위
1. `/vs-plan` 실행
2. `/vs-next` 실행

### 기대 결과
- vs-plan Step 0f: "골격 문서가 누락되었습니다. /vs-skeleton-init으로 생성하세요." 안내 표시 (차단 없음)
- skeleton-guard 디스패치 시 SKIP 반환
- 워크플로우 정상 진행 (에러 없음)

### 수동 검증 체크리스트
- [ ] vs-plan에서 누락 안내 표시
- [ ] 안내 후 플래닝 정상 진행
- [ ] skeleton-guard verdict가 SKIP
- [ ] vs-next에서도 SKIP으로 정상 진행
- [ ] 에러/예외 발생 없음

---

## 검증 실행 가이드

### 사전 준비
1. `/vs-skeleton-init`으로 골격 문서 생성 (시나리오 A-E용)
2. PRD.md Out of Scope에 "다국어 지원" 추가
3. POLICY.md Naming Convention에 "kebab-case" 설정
4. POLICY.md Security Policy에 "입력 검증 필수" 설정
5. QA config에서 `modules.skeleton_guard: true` 설정

### 실행 순서
1. 시나리오 F (골격 부재) — 골격 문서 삭제 후 테스트
2. 시나리오 A (Out of Scope) → 시나리오 B (Module 불일치)
3. 시나리오 C (Naming) → 시나리오 E (억제 동작)
4. 시나리오 D (Security)

### 전체 통과 기준
- 6개 시나리오 모두 "기대 결과"와 일치
- 각 체크리스트의 모든 항목 통과
- Critical finding 억제 불가 확인
- 워크플로우 무중단 확인
