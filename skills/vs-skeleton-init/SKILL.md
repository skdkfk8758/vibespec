---
name: vs-skeleton-init
description: "[Lifecycle] Use when generating 프로젝트 골격 문서 4종 via interview."
invocation: deferred
---

# Skeleton Init (골격 문서 초기화)

프로젝트의 핵심 골격 문서 4종(PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md)을 인터뷰 기반으로 생성합니다. 인터뷰 중 파일, URL, Slack, 이미지 등 다양한 소스를 자유롭게 혼합하여 입력할 수 있습니다.

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
   - `.skeleton.lock` 존재 시: "다른 vs-skeleton-init 프로세스가 실행 중입니다." 출력 후 종료
   - 없으면: `.skeleton.lock` 생성 (Phase 3 완료 또는 중단 시 삭제)

2. **이전 세션 복원 확인**
   - `.skeleton.tmp` 존재 시: AskUserQuestion으로 "이어서 진행" / "처음부터" 선택

3. **4종 골격 문서 존재 여부 스캔**
   - PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md 존재 여부 → 테이블 표시

4. **마이그레이션 감지**
   - 조건: package.json + src/ + git log 10개 이상 → migration_mode = true

5. **모노레포 감지**
   - 아래 중 하나라도 충족 시 monorepo_mode = true:
     - `packages/` 또는 `apps/` 디렉토리 존재
     - package.json에 `workspaces` 필드 존재
     - `pnpm-workspace.yaml` 존재
     - `turbo.json` 또는 `nx.json` 존재
   - 감지 시: "모노레포 프로젝트가 감지되었습니다. 환경 관리 정책을 함께 설정합니다." 표시

6. **유사 문서 감지**
   - `docs/architecture*`, `docs/prd*`, `CONTRIBUTING.md`, README.md 내 관련 섹션 탐색

7. **Pencil(.pen) 파일 감지**
   - `**/*.pen` 존재 시 안내, 없으면 스킵

### Phase 1: 시작 분기

마이그레이션 모드인 경우에만 분기합니다. 그 외에는 바로 Phase 2로 진행합니다.

- **migration_mode = true**: AskUserQuestion으로 선택
  - "마이그레이션 (추천)": 코드베이스 역추론 + Phase 2 인터뷰 보완
  - "직접 인터뷰": 역추론 없이 Phase 2 진행
- **migration_mode = false**: 바로 Phase 2로

**마이그레이션 역추론** (선택 시):
- 민감 파일 제외 (기존 목록 유지)
- 코드베이스 분석 (병렬): package.json, tsconfig, eslint, 디렉토리 구조, README.md
- 모노레포 분석 (monorepo_mode = true 시):
  - `pnpm-workspace.yaml` / `package.json workspaces` → 패키지 구조 추출
  - 루트 `.env*` 파일 존재 여부 확인
  - 각 패키지의 독립 `.env` 존재 여부 확인 → 있으면 "루트 통합 권장" 안내
- 민감 정보 마스킹 (API 키/토큰 → `[MASKED]`)
- 역추론 결과를 Phase 2에서 미리 채움

**문서별 생성/스킵 선택** (AskUserQuestion, multiSelect: true)

### Phase 2: 4종 문서별 인터뷰 (멀티소스 하이브리드)

각 질문에서 사용자는 **텍스트, 파일, URL, Slack, 이미지를 자유롭게 혼합**하여 답변할 수 있습니다.

#### Smart Input Detection

모든 질문의 사용자 답변에 대해 아래 순서로 입력 유형을 자동 감지합니다:

| 패턴 | 감지 기준 | 처리 |
|------|----------|------|
| **로컬 파일** | `/`로 시작, 또는 `*.md`, `*.txt`, `*.yaml`, `*.json` 확장자 | Read로 읽기 → 관련 내용 추출 |
| **PDF** | `*.pdf` | Read(pages 파라미터) → 텍스트 추출. 10페이지 초과 시 "관련 페이지를 지정하세요" 요청 |
| **이미지** | `*.png`, `*.jpg`, `*.jpeg`, `*.webp` | Read(멀티모달) → 시각 분석 → 디자인 토큰/텍스트 추출 |
| **Pencil** | `*.pen` | `mcp__pencil__get_variables()` → 디자인 토큰 추출 |
| **웹 URL** | `http://` 또는 `https://` (Slack/GitHub/Figma 외) | WebFetch → 텍스트 추출 |
| **Slack** | `#채널명`, Slack URL (`*.slack.com/*`), "슬랙" 키워드 | `mcp__slack__slack_get_channel_history` / `get_thread_replies` → 메시지 추출 |
| **GitHub** | `#숫자`, GitHub URL, "issue", "PR" 키워드 | `gh issue view` / `gh pr view` → 내용 추출 |
| **Figma** | `figma.com/` URL | Figma MCP → 디자인 변수/토큰 추출 |
| **직접 텍스트** | 위 패턴에 미매칭 | 그대로 사용 |

**처리 흐름:**
1. 사용자 답변 수신
2. 답변 내에서 여러 소스가 포함될 수 있음 (예: "docs/prd.md 읽고, 기술은 TypeScript")
3. 각 소스를 병렬 처리하여 내용 추출
4. 추출된 내용을 해당 섹션에 매핑
5. "다음 내용을 {섹션}에 반영합니다: {요약}" 확인

**소스 충돌 처리:**
- 동일 섹션에 여러 소스가 매핑되면: "PDF와 Slack에서 다른 내용이 감지되었습니다. 어느 것을 사용할까요?" AskUserQuestion
- 소스 간 보완적 내용은 병합

**Fallback 규칙:**
- Slack MCP 미연결: "Slack에 접근할 수 없습니다. 내용을 직접 붙여넣어주세요."
- URL fetch 실패: "URL에 접근할 수 없습니다. 내용을 직접 입력해주세요."
- PDF 대용량: "PDF가 {N}페이지입니다. 관련 페이지를 지정해주세요 (예: 1-5)"
- Figma MCP 미연결: "Figma에 접근할 수 없습니다. 디자인 토큰을 직접 입력해주세요."
- GitHub CLI 미설치: "gh CLI가 필요합니다. Issue 내용을 직접 붙여넣어주세요."

#### 2a. 기존 문서 처리

기존 문서가 있으면: AskUserQuestion "병합" (빈 섹션만 채움) / "스킵"
- 전체 덮어쓰기 불가 (Out of Scope)
- "병합" 시 `.bak` 백업

#### 2b. PRD.md 인터뷰 (최소 3개 필수 질문)

**Q1 (Vision)**: "프로젝트의 핵심 비전은? (텍스트, 파일 경로, URL 모두 가능)"
- 응답 50자 미만 → 후속 질문
- **입력 예시**: "docs/planning.md 의 1장 참고해줘" → Read → Vision 추출

**Q2 (Target Users)**: "주요 사용자는?"

**Q3 (핵심 기능)**: "반드시 있어야 하는 핵심 기능 3가지는?"
- **입력 예시**: "GitHub issue #45, #67, #89에 정리됨" → gh CLI → 기능 추출

**Q4 (Out of Scope)** (선택): "이번 범위에서 제외할 것은?"

#### 2c. POLICY.md 인터뷰 (최소 3개 + 모노레포 시 1개 추가)

**Q1 (Tech Stack)**: "사용하는 주요 기술 스택은?"
- 마이그레이션 모드: package.json 추출값 미리 표시

**Q2 (Security)**: "보안 정책 수준은?"
- **입력 예시**: "#security 채널 최근 스레드 봐줘" → Slack MCP → 보안 논의 추출

**Q3 (Naming Convention)**: "코딩 컨벤션은?"

**Q4 (Environment Management)** — monorepo_mode = true 시에만:
- question: "환경변수 관리 방식은?"
- 선택지:
  - "루트 통합 관리 (추천)": 루트 .env에서 모든 패키지 환경변수 통합
  - "패키지별 분리": 각 패키지가 독립 .env 관리
  - "하이브리드": 공통은 루트, 패키지 고유는 패키지별
- 선택 결과 → POLICY.md Environment Management 섹션에 반영
- monorepo_mode = false 시 이 질문 스킵

#### 2d. ARCHITECTURE.md 인터뷰 (최소 3개)

**Q1 (System Overview)**: "시스템 전체 구조를 간략히?"
- **입력 예시**: "/Users/me/Desktop/architecture-diagram.png" → 이미지 분석 → 구조 추출

**Q2 (Module Structure)**: "주요 모듈/디렉토리의 역할은?"

**Q3 (Data Flow)**: "데이터는 어떤 흐름으로?"

#### 2e. DESIGN.md 인터뷰

- vs-design-init DESIGN.md 존재 시: 스킵 권장
- 없으면 3개 질문: 색상 / 폰트 / 간격 단위
- **입력 예시**: "https://figma.com/file/abc123" → Figma MCP → 토큰 추출
- Pencil(.pen) 감지 시: 자동 추출 시도, 실패 시 스킵

#### 2f. 세션 중간 저장

각 문서 인터뷰 완료 시 `.skeleton.tmp` 업데이트:
```json
{
  "phase": 2,
  "completed_docs": ["prd", "policy"],
  "partial_responses": { ... },
  "migration_mode": true,
  "monorepo_mode": true,
  "selected_docs": ["prd", "policy", "architecture"],
  "input_sources": ["file:docs/planning.md", "slack:#security", "text"]
}
```

### Phase 3: 확인 및 문서 생성

1. **수집 데이터 요약 표시**
   - 4종 문서별 수집 내용 + 소스 출처 표시:
     ```
     ### PRD.md
     - Vision: (docs/planning.md에서 추출) "AI 기반 코드 리뷰..."
     - Target Users: (직접 입력) "시니어 백엔드 개발자"
     - Features: (GitHub #45, #67, #89에서 추출) 3개 기능
     ```

2. **확인 체크포인트** (AskUserQuestion): "생성" / "수정" / "처음부터"

3. **문서 생성**
   - 템플릿 기반 생성 (기존 로직)
   - 모노레포 감지 시 POLICY.md에 Environment Management 섹션 자동 포함
   - 병합 모드: 기존 빈 섹션만 채움

4. **completeness_score 계산** (품질 기준: 플레이스홀더 제외 후 50자+)

5. **정리**: .skeleton.tmp/.lock 삭제, 다음 단계 안내

## Rules
- .skeleton.lock은 Phase 3 완료 또는 중단 시 반드시 삭제
- Smart Input Detection은 모든 질문에서 동작 (특정 Phase에 국한되지 않음)
- MCP/외부 도구 실패 시 에러 없이 fallback (graceful degradation)
- 민감 파일 제외 + 민감 정보 마스킹 (기존 보안 정책)
- 텍스트 분배 시 확신 낮은 매핑은 "미분류" 표시 → 사용자 확인
- 전체 덮어쓰기 불가, 병합만 허용
- 소스 충돌 시 사용자 선택 (자동 병합 안 함)
