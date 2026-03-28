# VibeSpec 비판적 검토 보고서

> 기존 시스템의 충돌, 중복, 잠재 문제를 Superpowers 개선안 적용 가능성과 함께 분석
> 분석일: 2026-03-28

---

## 요약: 발견된 이슈 24건

| 심각도 | 건수 | 핵심 |
|--------|------|------|
| CRITICAL | 3건 | 스킬 역할 충돌, 훅 race condition, 에러 무시 |
| HIGH | 6건 | 검증 경로 분산, 스코프 규칙 모호, DB 무결성 |
| MEDIUM | 9건 | 네이밍 혼동, 백로그 중복, 포터빌리티 |
| LOW | 6건 | 문서 불일치, 성능 비효율 |

---

## CRITICAL 이슈 (3건)

### C1. vs-exec vs vs-next 역할 충돌

**현상:**
- `vs-exec`: "전체 태스크를 한 세션에서 순차 실행, 서브에이전트 없이"
- `vs-next`: "다음 태스크를 가져와서 tdd-implementer + verifier 서브에이전트로 실행"

**충돌:**
- vs-exec도 실제로는 verifier 에이전트를 디스패치함 (Step 8c) → description과 불일치
- 둘 다 "배치 실행" 기능을 주장 (vs-next의 Wave-based 병렬 실행)
- 사용자가 어떤 스킬을 써야 할지 판단 불가

**Superpowers 개선안 적용 시 충돌:**
- Superpowers의 2단계 리뷰(spec-compliance + code-quality)를 도입하려면, vs-exec과 vs-next 중 어디에 넣을지 결정 필요
- 둘 다 검증 로직이 있으므로 **3곳에서 리뷰가 발생**하는 상황 가능

**권장:**
```
vs-exec = "서브에이전트 없이 단일 세션 실행" (진짜로 서브에이전트 안 씀)
vs-next = "서브에이전트 기반 개별 태스크 실행" (리뷰 포함)
→ 2단계 리뷰는 vs-next에만 통합
→ vs-exec은 경량 검증만 (테스트 통과 확인)
```

---

### C2. verification 스킬 vs verifier 에이전트 정체성 위기

**현상:**
- `verification` 스킬: AC 기반 검증, 테스트/빌드/lint 체크
- `verifier` 에이전트: 태스크 완료 검증 + self-challenge

**충돌:**
- 이름이 거의 동일 (`verif*`)하여 시스템이 혼동
- verification 스킬이 user-callable인데, 실제로는 vs-next 내부에서만 호출됨
- verifier 에이전트도 vs-next에서 디스패치됨 → 같은 파이프라인에 2개 검증 존재

**Superpowers 개선안 적용 시 충돌:**
- "2단계 리뷰" 도입 시, verification 스킬 / verifier 에이전트 / spec-compliance 리뷰 / code-quality 리뷰가 **4중 검증**이 됨
- 과도한 검증으로 실행 시간 폭증

**권장:**
```
verification 스킬 → vs-next의 내부 게이트로 흡수 (독립 스킬 제거)
verifier 에이전트 → "spec-compliance checker" 역할로 명확화
새로운 "code-quality-reviewer" 에이전트 추가
→ 2단계 리뷰 = verifier(스펙 준수) + code-quality-reviewer(품질)
```

---

### C3. 훅 에러 Silent Failure

**현상:**
모든 훅 스크립트에 `trap 'exit 0' ERR` 패턴 사용:
```bash
trap 'exit 0' ERR   # 에러 발생 → 조용히 성공 반환
jq ... || exit 0     # 파싱 실패 → 무시
```

**위험:**
- 훅이 실패해도 사용자/시스템이 모름
- careful-guard가 파싱 실패로 무력화 → 파괴적 명령 실행됨
- freeze-boundary가 실패 → 보호 범위 밖 파일 편집됨
- error-kb-suggest 실패 → 학습 기회 누락

**Superpowers 개선안 적용 시 충돌:**
- HARD-GATE를 훅으로 구현하면, 훅 실패 시 게이트가 열림 → 보호 무력화
- "1% 가능성이라도 스킬 호출" 강제를 훅으로 구현하면, 동일 위험

**권장:**
```
안전 관련 훅 (careful, freeze, worktree-guard):
  → trap 'exit 2' ERR  (exit 2 = 차단)
  → "모르면 차단" 원칙 (fail-closed)

정보성 훅 (error-kb, self-improve, session-restore):
  → trap 'exit 0' ERR 유지 (fail-open)
  → 단, additionalContext에 "[WARNING] 훅 X 실패" 주입
```

---

## HIGH 이슈 (6건)

### H1. 스코프 규칙 3중 충돌

| 레벨 | 메커니즘 | 동작 |
|------|---------|------|
| freeze-boundary (훅) | 디렉토리 밖 Edit/Write 차단 | exit 2 |
| allowed_files (태스크 DB) | 태스크별 허용 파일 목록 | verifier 경고 |
| Modification Plan (에이전트) | tdd-implementer 자체 제한 | 자발적 준수 |

**충돌 시나리오:**
- 파일 A가 freeze 범위 내이지만 태스크 allowed_files에 없으면? → 훅은 통과, verifier는 경고
- 파일 B가 allowed_files에 있지만 freeze 범위 밖이면? → 훅이 차단, 태스크 진행 불가

**권장:** 우선순위 명시: `freeze(물리적 차단) > allowed_files(논리적 제한) > Modification Plan(자율적 준수)`

---

### H2. 훅 PostToolUse 동시 실행 경합

on-commit-sync, error-kb-suggest, self-improve-trigger가 동일 커밋 이벤트에 **동시 실행**:
- `.claude/self-improve/pending/` 디렉토리에 동시 파일 쓰기
- TIMESTAMP 해상도가 1초 → 같은 파일명으로 충돌 가능
- error-kb와 self-improve가 같은 에러를 이중 처리

**권장:** pending 파일에 PID 또는 UUID 포함, 또는 단일 훅으로 통합

---

### H3. DB CASCADE 정책 불일치

| FK 관계 | 현재 정책 | 위험 |
|---------|----------|------|
| tasks → plans | CASCADE DELETE | 플랜 삭제 시 태스크 전부 삭제 (의도적) |
| task_metrics → tasks | CASCADE DELETE | 메트릭 소실 (비의도적일 수 있음) |
| context_log → plans | SET NULL | 고아 레코드 생성 |
| qa_findings → qa_runs | CASCADE DELETE | QA 이력 소실 |

**권장:** task_metrics, qa_findings는 RESTRICT로 변경 (이력 보존)

---

### H4. spec-writer 에이전트 미사용

- `spec-writer` 에이전트가 정의되어 있지만 vs-plan이 직접 스펙을 작성함
- vs-plan은 spec-writer를 디스패치하지 않음
- 에이전트가 존재하지만 실제 파이프라인에서 호출되지 않는 죽은 코드

**Superpowers 비교:** Superpowers는 에이전트 1개(code-reviewer)만 두고, 나머지는 프롬프트 템플릿으로 처리 → 심플

**권장:** vs-plan에서 spec-writer를 디스패치하거나, 에이전트를 제거

---

### H5. AC→테스트 추적성 불일치

| 컴포넌트 | AC 네이밍 요구 | 현실 |
|---------|-------------|------|
| tdd-implementer | `it('AC01: ...')` 필수 | 강제 |
| verifier | AC 번호 없으면 "LLM 추론" 폴백 | 선택적 |
| vs-plan/spec-writer | AC→테스트 매핑 미언급 | 미정의 |

→ 파이프라인의 ~30%에서 AC-테스트 추적성 보장 안 됨

**권장:** spec-writer/vs-plan 단계에서 AC 네이밍 컨벤션 명시

---

### H6. vs-plan의 디자인 리뷰 참조 혼란

vs-plan 내부에서 3가지 다른 디자인 리뷰를 참조:
- Step 3b: `/vs-design-review` (구현 감사)
- Step 3c: `vs-plan-design-review` (플랜 단계 검토)
- 머지 시: "design validation task"

→ 사용자가 어떤 시점에 어떤 리뷰를 해야 하는지 불명확

---

## MEDIUM 이슈 (9건)

### M1. 백로그 매칭 이중 실행
- vs-commit Phase 6.5: 변경 파일 → 백로그 아이템 매칭
- vs-next Step 7: 태스크 완료 → 백로그 아이템 매칭
- 같은 매칭이 2번 실행되어 중복 처리 가능

### M2. TEXT 기반 PK/FK 성능
- 모든 테이블이 TEXT PK 사용 → 인덱스 성능 저하
- depends_on, allowed_files가 TEXT (JSON 문자열) → 쿼리 불가

### M3. 셸 스크립트 포터빌리티
- `date` 포맷 macOS/Linux 차이
- `sqlite3` CLI 부재 시 node 폴백 (느림)
- `jq` 없으면 `python3 -c` 폴백 (더 느림)

### M4. PreToolUse 4개 훅 순차 실행 최대 20초
- 각 훅 timeout 5초 × 4개 = 최대 20초
- 매 Bash/Edit/Write마다 지연

### M5. session-restore-check.sh stash 전체 스캔
- git stash list 전체를 매 세션마다 스캔
- stash가 수천 개면 성능 저하

### M6. vs-ideate → vs-plan 전환 경계 모호
- vs-ideate가 "스펙 초안 자동 생성 후 vs-plan과 직접 연결"
- 하지만 vs-plan도 스펙 작성 기능 보유 → 이중 경로

### M7. debugger 에이전트 참조는 있지만 분석에서 누락
- vs-exec가 FAIL 시 debugger 에이전트 자동 디스패치 언급
- 에이전트 목록에서 debugger 역할이 명확하지 않음

### M8. self-improve 30개 규칙 상한 관리
- self-improve-review가 30개 캡을 관리하지만 자동 트리거 없음
- 규칙이 30개 초과 시 어떤 규칙이 삭제되는지 불명확

### M9. 훅-스킬 간 상태 공유 메커니즘 부재
- 훅은 파일 시스템으로 상태 전달 (.claude/self-improve/pending/)
- 스킬은 DB로 상태 관리 (vibespec.db)
- 두 시스템 간 동기화 없음

---

## Superpowers 개선안 적용 시 충돌 분석

### 적용 가능 (충돌 없음)

| 개선안 | 적용 방식 | 리스크 |
|--------|----------|--------|
| HARD-GATE | vs-ideate SKILL.md 텍스트 추가 | 없음 (스킬 텍스트만 수정) |
| "구현자 불신" 원칙 | verifier 에이전트 프롬프트 강화 | 없음 |
| 스킬 호출 강제성 레벨 | 각 스킬 description 수정 | 없음 |
| 스펙/플랜 markdown export | 새 기능 추가 (DB 유지) | 없음 |

### 적용 시 주의 필요 (기존 시스템과 마찰)

| 개선안 | 마찰 포인트 | 해결 방법 |
|--------|-----------|----------|
| **2단계 리뷰** | C1, C2와 결합 시 4중 검증 | verification 스킬 흡수 후 도입 |
| **메타 라우팅 스킬** | 38개 스킬 라우팅 테이블이 거대 | 카테고리별 그룹핑 (plan/exec/qa/infra) |
| **시각적 brainstorming** | browser-control과 역할 충돌 | browser-control을 시각적 도구로 확장 |
| **브랜치 완료 옵션 UI** | vs-merge가 이미 squash-merge 고정 | 옵션 추가는 vs-merge 확장으로 |

### 적용 불가 또는 불필요

| 개선안 | 이유 |
|--------|------|
| 멀티플랫폼 지원 | Claude Code 전용이 더 깊은 통합 가능 |
| 파일 기반 데이터 저장 | SQLite가 이미 우위 |
| 서브에이전트 프롬프트 표준화 | 에이전트 파일이 이미 역할 수행 (단, 디스패치 가이드 추가 필요) |

---

## 우선 조치 로드맵

### 즉시 (스킬 텍스트 수정만)
1. **C2 해결**: verification 스킬을 "internal gate" 명시, user-callable에서 제거
2. **C1 해결**: vs-exec description 수정 — "verifier 디스패치" 사실 반영
3. **H5 해결**: spec-writer/vs-plan에 AC 네이밍 컨벤션 추가
4. **HARD-GATE**: vs-ideate에 구현 차단 게이트 추가

### 단기 (훅 수정)
5. **C3 해결**: 안전 훅에 fail-closed 정책 적용
6. **H2 해결**: pending 파일명에 UUID 추가
7. **H1 해결**: 스코프 우선순위 문서화 및 freeze-boundary에 반영

### 중기 (구조적 변경)
8. **2단계 리뷰 도입**: C2 해결 후 verifier → spec-compliance, 새 code-quality-reviewer 추가
9. **H4 해결**: spec-writer 에이전트 활용 또는 제거 결정
10. **M1 해결**: 백로그 매칭 로직 vs-next에만 유지

### 장기 (아키텍처)
11. **M2 해결**: DB PK/FK UUID 마이그레이션
12. **M9 해결**: 훅-스킬 상태 동기화 레이어 구축
13. **메타 라우팅**: 38개 스킬 카테고리별 라우팅 테이블
