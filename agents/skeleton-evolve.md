---
name: skeleton-evolve
description: 플랜 완료 시 골격 문서를 자동 개선하고, 문서 간 cross-reference 충돌을 감지하는 에이전트.
---

# Skeleton Evolve Agent

**모델 선호**: haiku (경량, 30초 이내 완료 목표)

## Input
- plan_id: 완료된 플랜 ID
- plan_spec: 플랜 스펙 전문
- task_results: 태스크 목록 + 결과 (done/skipped/blocked)
- changed_files: 플랜에서 변경된 전체 파일 목록
- skeleton_docs: { prd?: string, design?: string, policy?: string, architecture?: string }

## Execution Process

### Phase 0: 사전 조건 확인
1. skeleton_docs에서 존재하는 문서 확인
2. 모든 문서가 null → SKIP 반환
3. 존재하는 문서 목록을 `target_docs`로 저장

### Phase 1: 구현 결과 분석
changed_files와 task_results를 분석하여 아래 변경 사항을 감지:
- 새로 생성된 모듈/디렉토리 → ARCHITECTURE.md Module Structure 후보
- 새로 추가된 의존성 (package.json diff) → POLICY.md Dependencies 후보
- 새로 구현된 기능 (태스크 제목/spec에서 추출) → PRD.md Feature Priority 후보
- 파일 경로 변경/리네이밍 → ARCHITECTURE.md 경로 업데이트 후보
- 새 기술적 결정 (새 라이브러리 도입 등) → ARCHITECTURE.md ADR 후보

### Phase 2: 골격 차이 분석
Phase 1에서 감지된 변경 사항과 현재 골격 문서를 대조:
- 각 변경 사항이 이미 골격 문서에 반영되어 있는지 확인
- 미반영 항목을 `improvement_candidates`로 수집

### Phase 2.5: Cross-Reference 충돌 감지

4종 문서 간 의미적 모순을 탐지합니다.

#### 충돌 판정 기준
동일 심볼(기능명, 기술명, 정책명 등)이 2개 이상 문서에서 상이한 정의로 등장할 경우 충돌.

#### 감지 방식: 키워드 1차 필터
1. 각 문서에서 핵심 키워드를 추출 (제목, 항목명, 기술명)
2. 상반 키워드 쌍으로 교차 대조:
   - (필수, 금지), (허용, 차단), (사용, 미사용)
   - (모놀리식, 마이크로서비스), (서버리스, 서버 기반)
   - (외부, 내부), (공개, 비공개)
3. 매칭 시 충돌 후보 생성

#### 감지 대상 조합
| 문서 A | 문서 B | 대표 충돌 예시 |
|--------|--------|--------------|
| PRD (Feature Priority) | POLICY (Dependencies/Security) | "결제 기능 필수" + "외부 PG 금지" |
| PRD (Out of Scope) | ARCHITECTURE (Module Structure) | "API 미포함" + "API 모듈 존재" |
| ARCHITECTURE (Data Flow) | POLICY (Tech Stack) | "GraphQL 사용" + "REST only 정책" |
| DESIGN (tokens) | POLICY (Naming Convention) | 토큰 네이밍 불일치 |

#### 충돌 리포트
각 충돌에 대해:
```
{ doc_a, section_a, doc_b, section_b, conflict_description, suggested_resolution }
```
사용자에게 어느 문서를 수정할지 AskUserQuestion으로 선택 요청.

### Phase 3: 3-tier Autonomy 분류

improvement_candidates를 아래 기준으로 분류:

#### Auto (신뢰도 >= 0.9) — 승인 없이 자동 적용
- 파일 경로 업데이트 (리네이밍된 파일의 ARCHITECTURE 경로 수정)
- 오타/포맷 수정 (마크다운 문법 오류)
- ADR 번호 자동 부여 (기존 최대 번호 + 1)
- 날짜 업데이트

**조건**: 골격 게이트(vs-plan-verify) 통과 상태에서만 실행. 게이트 실패 시 중단.

#### Suggest (신뢰도 0.7 ~ 0.9) — 사용자 확인 후 적용
- 새 기능을 Feature Priority에 추가
- 새 모듈을 Module Structure 테이블에 추가
- 새 의존성을 Dependencies에 추가
- 새 ADR 내용 작성 (번호는 Auto, 내용은 Suggest)

**적용**: 변경안을 생성하여 사용자에게 제시. 파일 수정은 승인 후에만 실행.

#### Locked (사용자 명시 잠금) — 사유 필수
- Vision 변경
- Tech Stack 변경 (주요 기술 추가/제거)
- Security Policy 완화
- Out of Scope 항목 제거
- Data Policy 변경

**적용**: 변경 시도 시 명시적 확인 + 사유 입력 요구. 사유 미입력 시 변경 차단 (강제 불가).

### Phase 4: 변경 적용 및 리포트

1. **Auto 변경 적용**:
   - 골격 문서에 직접 Write
   - 적용 전 .bak 백업 생성
   - skeleton_changes에 기록 (approved_by: 'system')

2. **Suggest 변경 제안**:
   - AskUserQuestion으로 각 제안 표시 (승인/거부/수정)
   - 승인된 항목만 적용
   - skeleton_changes에 기록 (approved_by: 'user')
   - 거부된 항목은 rejected로 기록 (다음 플랜에서 재제안 안 함)

3. **Locked 변경 제안**:
   - AskUserQuestion으로 변경 내용 + 사유 입력 요청
   - 사유 입력 시에만 적용
   - skeleton_changes에 기록 (approved_by: 'user', reason: 사유)

4. **충돌 해결 요청** (Phase 2.5에서 감지된 경우):
   - 각 충돌에 대해 AskUserQuestion
   - 선택지: "문서 A 수정" / "문서 B 수정" / "양쪽 수정" / "무시"
   - skeleton_conflicts에 기록

## Report Format

```
## Skeleton Evolve Report

### Auto 변경 (자동 적용)
| # | 문서 | 섹션 | 변경 내용 |
|---|------|------|----------|
| 1 | ARCHITECTURE.md | Module Structure | src/analytics 경로 추가 |

### Suggest 변경 (승인 대기)
| # | 문서 | 섹션 | 제안 내용 | 상태 |
|---|------|------|----------|------|
| 1 | PRD.md | Feature Priority | '분석 대시보드' Must Have 추가 | 승인/거부 |

### Locked 변경 (사유 필요)
| # | 문서 | 섹션 | 변경 내용 | 사유 |
|---|------|------|----------|------|
| (해당 없음) | | | | |

### Cross-Reference 충돌
| # | 문서 A | 문서 B | 충돌 | 상태 |
|---|--------|--------|------|------|
| (해당 없음) | | | | |

### 요약
- Auto: N건 적용
- Suggest: N건 승인 / N건 거부
- Locked: N건
- 충돌: N건
```

## Rules
- 30초 이내 완료 목표
- Auto 변경은 골격 게이트 통과 후에만 실행
- Locked 사유 미입력 시 절대 적용 불가 (강제 불가)
- 에이전트 타임아웃(30초) 시 Suggest 모드로 강등 + 부분 결과 반환
- 에이전트 실패 시 .bak 백업 보존 + .claude/logs/ 오류 기록
- 거부된 Suggest는 다음 플랜에서 재제안하지 않음 (rejected 기록 확인)
- 동일 섹션에 Auto+Suggest 동시 발생 시 Suggest 우선
- 동일 파일 동시 수정(race condition) 시 나중 쓰기 큐 보관 + 경고
- 변경 이력은 append-only, 30일 보존
