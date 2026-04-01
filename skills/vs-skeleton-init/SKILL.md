---
name: vs-skeleton-init
description: "[Lifecycle] 프로젝트 골격 문서 4종 인터뷰 기반 생성"
invocation: user
---

# Skeleton Init (골격 문서 초기화)

프로젝트의 핵심 골격 문서 4종(PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md)을 인터뷰 기반으로 생성합니다.

## When to Use

**사용하세요:**
- 새 프로젝트 시작 시 골격 문서를 일괄 생성할 때
- 기존 프로젝트에 골격 문서 체계를 도입할 때 (마이그레이션)

**사용하지 마세요:**
- DESIGN.md만 필요 → `/vs-design-init`
- 이미 골격 문서가 모두 있고 검증만 필요 → `/vs-skeleton-status`

## Steps

### Phase 0: 프로젝트 상태 스캔

1. **동시 실행 잠금 확인**
   - 프로젝트 루트에 `.skeleton.lock` 존재 여부 확인
   - 존재하면: "다른 vs-skeleton-init 프로세스가 실행 중입니다." 출력 후 종료
   - 없으면: `.skeleton.lock` 생성 (Phase 3 완료 또는 중단 시 삭제)

2. **이전 세션 복원 확인**
   - `.skeleton.tmp` 존재 여부 확인
   - 존재하면: JSON 파싱하여 phase, completed_docs, migration_mode를 읽기
     → `AskUserQuestion`으로 복원 여부 확인:
     - question: "이전 세션에서 {completed_docs 수}개 문서까지 진행되었습니다. 이어서 진행할까요?"
     - header: "세션 복원"
     - 선택지:
       - label: "이어서 진행", description: "이전 세션의 응답을 복원합니다"
       - label: "처음부터", description: "이전 세션을 삭제하고 새로 시작합니다"

3. **4종 골격 문서 존재 여부 스캔**
   - PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md 존재 여부 확인
   - 결과를 테이블로 표시

4. **마이그레이션 감지**
   - 3가지 조건: package.json 존재 + src/ 존재 + git log 10개 이상
   - 모두 충족 → migration_mode = true
   - 미충족 → migration_mode = false

5. **유사 문서 감지**
   - `docs/architecture*`, `docs/prd*`, `CONTRIBUTING.md`, README.md 내 관련 섹션 탐색
   - 발견 시 테이블로 표시

6. **Pencil(.pen) 파일 감지**
   - `**/*.pen` 존재 여부 확인
   - 존재하면 안내, 없으면 스킵

### Phase 1: 입력 소스 선택

1. **입력 소스 선택** (`AskUserQuestion`)
   - 신규: (A) 직접 인터뷰 / (B) 기획서 텍스트 / (C) 파일 경로
   - 마이그레이션: (D) 코드베이스 역추론 + 인터뷰 보완 (추천)

2. **기획서 텍스트 입력** ("기획서 텍스트" 선택 시)
   - 텍스트 100자 미만 시 추가 입력 요청 (EC02)
   - 4종 문서 섹션에 자동 분배:
     - 비전/목표/사용자 → PRD.md
     - 기술/스택/보안 → POLICY.md
     - 구조/모듈/흐름 → ARCHITECTURE.md
     - 디자인/UI/색상 → DESIGN.md

3. **마이그레이션 역추론** ("마이그레이션" 선택 시)
   - **민감 파일 제외**: .env, .env.*, *.secret, credentials.*, .npmrc, .yarnrc, *.key, *.pem, *.p12, *.jks, *.cert, id_rsa*, *.pub, .aws/*, .gcp/*, .azure/*, service-account*.json, *.log, node_modules/, .git/objects/
   - **코드베이스 분석** (병렬 실행):
     - package.json → Tech Stack, Dependencies → POLICY.md, ARCHITECTURE.md
     - tsconfig.json/eslint → Naming Convention → POLICY.md
     - 디렉토리 구조 → Module Structure → ARCHITECTURE.md
     - README.md → Vision, Target Users → PRD.md
     - 유사 문서 → 해당 골격 문서에 병합 제안
   - **민감 정보 마스킹** (EC11): API 키/토큰 패턴 감지 → `[MASKED]` 치환

4. **문서별 생성/스킵 선택** (`AskUserQuestion`, multiSelect: true)

5. **세션 상태 저장** (`.skeleton.tmp` JSON)

### Phase 2: 4종 문서별 인터뷰

각 문서에 대해 순차적으로 인터뷰를 진행합니다. 마이그레이션 모드 시 역추론 결과를 미리 채운 상태에서 확인/수정만 합니다.

#### 2a. 기존 문서 처리

`AskUserQuestion`: "병합" (빈 섹션만 채움) / "스킵"
- 전체 덮어쓰기는 제공하지 않음 (Out of Scope)
- "병합" 시 기존 파일을 `.bak`으로 백업 (EC08)

#### 2b. PRD.md 인터뷰 (최소 3개 필수 질문)

**Q1 (Vision)**: "이 프로젝트의 핵심 비전은?" → Vision 섹션
- 응답 50자 미만 → 후속: "좀 더 구체적으로, 어떤 문제를 해결하나요?"

**Q2 (Target Users)**: "주요 사용자는?" → Target Users 테이블

**Q3 (핵심 기능)**: "반드시 있어야 하는 핵심 기능 3가지는?" → Feature Priority + User Stories

**Q4 (Out of Scope)** (선택): "이번 범위에서 제외할 것은?" → Out of Scope

#### 2c. POLICY.md 인터뷰 (최소 3개 필수 질문)

**Q1 (Tech Stack)**: "사용하는 주요 기술 스택은?" → Tech Stack 테이블
- 마이그레이션 모드: package.json 추출값 미리 표시

**Q2 (Security)**: "보안 정책 수준은?" → Security Policy

**Q3 (Naming Convention)**: "코딩 컨벤션은?" → Naming Convention 테이블
- 마이그레이션 모드: eslint/prettier 추출 규칙 표시

#### 2d. ARCHITECTURE.md 인터뷰 (최소 3개 필수 질문)

**Q1 (System Overview)**: "시스템 전체 구조를 간략히 설명해주세요" → System Overview
- 마이그레이션 모드: 디렉토리 구조 추론 모듈 목록 표시

**Q2 (Module Structure)**: "주요 모듈/디렉토리의 역할은?" → Module Structure 테이블

**Q3 (Data Flow)**: "데이터는 어떤 흐름으로 처리되나요?" → Data Flow

#### 2e. DESIGN.md 인터뷰

- 기존 vs-design-init DESIGN.md가 있으면: 스킵 권장
- 없으면 간소화 3개 질문: 색상 / 폰트 / 간격 단위
- Pencil(.pen) 감지 시: `mcp__pencil__get_variables()` 시도, 실패 시 스킵 (EC03)

#### 2f. 세션 중간 저장

각 문서 인터뷰 완료 시마다 `.skeleton.tmp` 업데이트

### Phase 3: 확인 및 문서 생성

1. **수집 데이터 요약 표시**
   4종 문서별 수집된 인터뷰 응답을 요약 테이블로 표시

2. **확인 체크포인트** (`AskUserQuestion`)
   - "생성": 이 내용으로 골격 문서를 생성
   - "수정": 특정 항목을 수정 (해당 질문만 재진행)
   - "처음부터": .skeleton.tmp 삭제 후 Phase 1로

3. **문서 생성**
   - `skills/vs-skeleton-init/templates/` 에서 템플릿 Read
   - 플레이스홀더(`{값}`)를 수집된 응답으로 치환
   - 프로젝트 루트에 Write
   - **병합 모드**: 기존 파일의 빈 섹션만 채움 (내용 있는 섹션 유지)
   - 파일 쓰기 실패 시 (EC06): 에러 출력, 생성 완료 파일 보존, 미완료 삭제

4. **completeness_score 계산 및 표시**
   ```
   score = (필수섹션 존재 수 / 전체 필수섹션 수) × 80 + (선택섹션 존재 수 / 전체 선택섹션 수) × 20
   ```
   결과를 테이블로 표시 (문서별 완성도, 필수/선택 충족 수)

5. **정리**
   - `.skeleton.tmp` 삭제
   - `.skeleton.lock` 삭제
   - 다음 단계 안내:
     - 60 미만 문서 있으면: 직접 편집 또는 재실행 안내
     - 모두 60 이상: `/vs-skeleton-status` 또는 `/vs-plan` 안내

## Rules
- .skeleton.lock은 반드시 Phase 3 완료 또는 중단 시 삭제
- 민감 파일 제외 목록은 보안 요구사항과 일치
- Pencil 연동 실패 시 에러 없이 스킵 (graceful degradation)
- 텍스트 분배 시 확신 낮은 매핑은 "미분류" 표시 → Phase 2에서 사용자 확인
- 전체 덮어쓰기 불가, 병합만 허용
