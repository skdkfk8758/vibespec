# VibeSpec v0.28.0 — 전체 기능 테스트 결과 리포트

> 실행일: 2026-03-29
> 대상: 91개 시나리오, 15개 카테고리
> 방법: CLI 실행 + 코드 정적 분석 + DB 직접 검증

---

## 1. 전체 결과 요약

### 종합 점수

| Phase | 카테고리 | PASS | WARN | FAIL | 합계 |
|-------|---------|------|------|------|------|
| 1 | 초기 설정 및 환경 | 5 | 0 | 0 | 5 |
| 2 | 플랜 라이프사이클 | 5 | 3 | 2 | 10 |
| 3 | 태스크 관리 | 6 | 2 | 0 | 8 |
| 4 | 워크플로우 실행 | 4 | 1 | 0 | 5 |
| 5 | 워크트리 & 브랜치 | 3 | 0 | 0 | 3 |
| 6 | 백로그 관리 | 4 | 2 | 0 | 6 |
| 7 | QA 파이프라인 | 7 | 0 | 0 | 7 |
| 8 | Error KB & Self-Improve | 5 | 0 | 1 | 6 |
| 9 | 가드레일 (Safety) | 4 | 2 | 0 | 6 |
| 10 | 대시보드 & 모니터링 | 4 | 0 | 1 | 5 |
| 11 | 설정 & 컨텍스트 | 5 | 0 | 0 | 5 |
| 12 | 디자인 시스템 + 릴리즈 | 3 | 0 | 0 | 3 |
| 13 | 통합 E2E | 7 | 0 | 0 | 7 |
| 14 | 엣지 케이스 | 10 | 2 | 0 | 12 |
| **합계** | | **76** | **12** | **4** | **87** |

### 전체 통과율

```
PASS: 76/87 (87.4%)
WARN: 12/87 (13.8%)
FAIL:  4/87  (4.6%)
```

---

## 2. FAIL 항목 총정리

| ID | Phase | 시나리오 | 원인 | 심각도 |
|----|-------|---------|------|--------|
| S2.4 | 2 | 플랜 활성화 | `plan activate` CLI 서브커맨드 미존재 | MEDIUM |
| S2.10 | 2 | 잘못된 상태 전환 | activate 없어 테스트 불가 + 상태 가드 부재 | HIGH |
| S8.5 | 8 | Error KB 업데이트 | `--solution`/`--cause` 플래그 미노출 → 본문 수정 불가 | MEDIUM |
| S10.3 | 10 | History bare 모드 | `<type> <id>` 필수 → 전체 이벤트 조회 불가 | LOW |
| ~~S13.1~3~~ | - | ~~배포 스킬 3종~~ | 의도적 제거 확인 — 잔존 참조 정리 완료 | RESOLVED |

---

## 3. 비판적 종합 분석

### 3.1 구조적 약점 (Systemic Issues)

#### A. 상태 머신 부재 — 프로젝트 전반
**영향 범위**: Plan, Task, QA Run, QA Scenario, QA Finding, Backlog (6개 모델)

모든 엔티티의 상태 전환이 가드되지 않음. `updateStatus()`나 `update()`가 어떤 소스 상태에서든 어떤 타겟 상태로든 변경 허용.
- `done` → `todo` 역전환 가능
- `archived` → `active` 부활 가능
- `completed` → `draft` 되돌리기 가능

**유일한 예외**: `plan.approve()`만 `active` 상태를 검증

**권고**: 각 모델에 `ALLOWED_TRANSITIONS` 맵을 정의하고, 상태 변경 시 검증하는 공통 미들웨어 도입

#### B. 테스트 커버리지 불균형
| 영역 | 테스트 현황 |
|------|-----------|
| Engine (7개) | **100% 커버** — 전 모듈 테스트 존재 |
| Models (11개) | **64% 커버** — qa-run, qa-scenario, qa-finding, backlog 4개 미테스트 |
| CLI (1,675줄) | **0% 커버** — 통합 테스트 전무 |
| DB connection | **0% 커버** — findProjectRoot, resolveDbPath 미테스트 |
| Hooks (13개) | **0% 커버** — 셸 스크립트 테스트 없음 |

#### ~~C. 배포 파이프라인 3/4 미구현~~ (RESOLVED)
배포 스킬 3종은 의도적으로 제거됨 (커밋 `e3e7527`). 잔존 참조 정리 완료.

### 3.2 보안 취약점

| 항목 | 심각도 | 설명 |
|------|--------|------|
| GitHub import 명령 주입 | **HIGH** | `importers.ts`에서 repo 파라미터가 `execSync`에 직접 삽입 |
| Config 평문 저장 | **HIGH** | API 키, 토큰 등이 SQLite에 암호화 없이 저장 |
| careful-guard 우회 | MEDIUM | `bash -c`, 변수 확장, 멀티라인 명령으로 우회 가능 |
| freeze-boundary 불완전 | MEDIUM | `cp`, `mv`, `sed -i`로 경로 외부 파일 조작 가능 |
| prefix 매칭 오류 | LOW | `/app/src`가 `/app/srcExtra/`도 매칭 |

### 3.3 문서-구현 괴리

| 문서 표기 | 실제 CLI | 영향 |
|----------|---------|------|
| `plan activate` | 미존재 (auto-activate) | 사용자 혼란 |
| `task list --plan` | 미존재 (`plan show` 대체) | 워크플로우 단절 |
| `backlog create` | `backlog add` | 커맨드 실패 |
| `backlog move-to-plan` | `backlog promote --plan` | 커맨드 실패 |
| `backlog prioritize` | 미존재 (`update --priority`) | 커맨드 실패 |
| `skill-usage` | `skill-log` / `skill-stats` | 커맨드 실패 |
| `freeze unset` | `freeze off` | 커맨드 실패 |
| `guard set --path` | `guard on <path>` | 커맨드 실패 |
| `--error` (error-kb) | `--cause` | 커맨드 실패 |
| `--category` (error-kb) | `--tags` | 커맨드 실패 |

### 3.4 훅-스킬 연동 문제

| 문제 | 영향 |
|------|------|
| on-commit-sync.sh 패턴 불일치 | 훅이 `[task:ID]`를 기대하나 vs-commit은 `Task: #T-<id>` 생성 → 자동 동기화 Dead Code |
| task next가 in_progress 미전환 | 워크플로우 단절, 수동 update 필요 |
| 크래시 후 in_progress 복구 없음 | 방치된 태스크가 next()에서 영구 무시 |

### 3.5 데이터 무결성 위험

| 문제 | 영향 |
|------|------|
| Migration v6 트랜잭션 미래핑 | plans 테이블 재생성 중 크래시 시 전체 플랜 데이터 손실 |
| delete() 트랜잭션 미래핑 | 삭제 중 크래시 시 고아 레코드 |
| duration_min 부정확 | Date.now() 기반 → metrics 호출 지연 시 소요시간 부풀려짐 |
| sort_order 미관리 | 모든 태스크 sort_order=0, 순서 비결정적 |

---

## 4. 카테고리별 상세 비판

### 4.1 동작하지만 개선이 필요한 영역 (WARN 12건)

1. **plan create auto-activate** → draft 상태 도달 불가
2. **plan show에 spec/summary 미출력** → 핵심 정보 누락
3. **plan delete draft-only** → 활성 플랜 삭제 불가 (archive만)
4. **task next가 in_progress 미전환** → 수동 조작 필요
5. **block reason 미출력** → task show에서 이유 확인 불가
6. **backlog prioritize 미존재** → update로 우회
7. **backlog promote auto-plan 미지원** → 기존 플랜 필수
8. **vs-commit 훅 패턴 불일치** → 자동 동기화 미작동
9. **careful/freeze CLI 문법 불일치** → 시나리오 문서와 다름
10. **빈 문자열 title 허용** → 최소 길이 검증 없음
11. **빈 config 키 허용** → 키 검증 없음
12. **insights JSON 강제 출력** → 다른 명령과 비일관

---

## 5. 기능별 사용 가이드

### 5.1 핵심 워크플로우

```
# 1. 플랜 생성 (자동 활성화됨)
vs plan create --title "기능명" --spec "상세 스펙" --summary "요약"

# 2. 태스크 추가
vs task create --plan <plan-id> --title "태스크명" --acceptance "완료 기준"

# 3. 태스크 실행 사이클
vs task next <plan-id>           # 다음 태스크 조회 (수동 전환 필요!)
vs task update <task-id> in_progress  # 작업 시작
vs task update <task-id> done         # 작업 완료

# 4. 플랜 완료
vs plan complete <plan-id>

# 5. 대시보드 확인
vs dashboard
```

### 5.2 백로그 관리

```
vs backlog add --title "아이디어" --priority high --category feature
vs backlog list
vs backlog promote <backlog-id> --plan <plan-id>  # 기존 플랜에 연결
```

### 5.3 Error KB

```
vs error-kb add --title "에러명" --cause "원인" --solution "해결법" --tags "tag1,tag2"
vs error-kb search "키워드"
# 주의: 등록 후 cause/solution 수정 불가 → 삭제 후 재생성
```

### 5.4 가드레일

```
vs careful on       # 파괴적 명령 차단
vs freeze set src/  # 편집 범위 제한
vs guard on src/    # 둘 다 활성화
vs guard off        # 둘 다 해제
```

### 5.5 QA

```
vs qa run create <plan-id> --trigger manual
vs qa scenario create --run <run-id> --category functional --title "시나리오" --description "설명" --priority high
vs qa finding list --run <run-id>
```

### 5.6 사용 금지 (미구현)

| 스킬 | 상태 |
|------|------|
| ~~`/vs-deploy-setup`~~ | 의도적 제거, 잔존 참조 정리 완료 |
| ~~`/vs-deploy`~~ | 의도적 제거, 잔존 참조 정리 완료 |
| ~~`/vs-canary`~~ | 의도적 제거, 잔존 참조 정리 완료 |

---

## 6. 우선순위별 개선 권고

### P0 — 즉시 수정 (CRITICAL)
1. ~~**배포 스킬 3개 제거 또는 구현**~~: RESOLVED — 잔존 참조 정리 완료
2. **GitHub import 명령 주입 수정**: `execSync`에 파라미터 이스케이프 적용
3. **Migration v6에 트랜잭션 추가**: `BEGIN`/`COMMIT`으로 래핑

### P1 — 높은 우선순위 (HIGH)
4. **상태 머신 도입**: Plan/Task에 `ALLOWED_TRANSITIONS` 맵 정의
5. **QA/백로그 모델 테스트 추가**: 4개 모델 테스트 0건 해소
6. **config 값 암호화**: 민감 정보 저장 시 암호화 옵션
7. **on-commit-sync 패턴 수정**: vs-commit 출력 형식과 일치

### P2 — 중간 우선순위 (MEDIUM)
8. **plan show에 spec/summary 출력 추가**
9. **task next 시 자동 in_progress 전환**
10. **error-kb update에 --cause/--solution 플래그 추가**
11. **빈 문자열 title 검증 추가**
12. **careful-guard 우회 방지 강화**
13. **history bare 모드 추가** (최근 N건 조회)

### P3 — 낮은 우선순위 (LOW)
14. CLI 커맨드명 문서 동기화
15. Slack importer 구현 또는 제거
16. backlog promote 자동 플랜 생성
17. insights 출력 포맷 일관성
18. sort_order 자동 관리

---

## 7. 결론

VibeSpec v0.28.0은 **핵심 SDD 워크플로우가 안정적으로 동작**합니다. E2E 통합 테스트 7/7 전체 통과가 이를 증명합니다. Plan→Task→Execute→Complete 사이클, 백로그 관리, Error KB, QA 파이프라인, 가드레일 모두 기본 기능은 정상입니다.

그러나 **구조적 약점**이 존재합니다:
- 상태 머신 부재로 데이터 무결성 위험
- ~~배포 파이프라인 3/4 미구현~~ (RESOLVED — 잔존 참조 정리 완료)
- 보안 취약점 (명령 주입, 평문 저장)
- 테스트 커버리지 불균형 (엔진 100% vs CLI 0%)
- 문서-구현 괴리 10건 이상

**프로덕션 사용 권장 수준**: CLI CRUD 및 스킬 기반 워크플로우는 사용 가능하나, 보안 민감 환경에서는 config 저장 주의 필요.
