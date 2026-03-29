# Superpowers (obra/superpowers) 프로젝트 분석

> GitHub: https://github.com/obra/superpowers
> Star: 120k+ | Commits: 407 | 작성자: Jesse Vincent (obra)

## 프로젝트 개요

Superpowers는 코딩 에이전트를 위한 **완전한 소프트웨어 개발 워크플로우 프레임워크**입니다.
"스킬(Skills)" 기반의 조합 가능한 방법론으로, 에이전트가 자동으로 brainstorming → spec → plan → implementation → review → finish 파이프라인을 따르도록 합니다.

### 핵심 철학
- **Spec First, Code Second**: 코드 작성 전 반드시 디자인/스펙 승인
- **Subagent-Driven Development**: 태스크별 독립 서브에이전트 디스패치
- **TDD (Red-Green-Refactor)**: 테스트 먼저, 구현 나중에
- **YAGNI / DRY**: 불필요한 기능 금지, 반복 금지
- **Git Worktree 격리**: 피처별 격리된 작업 공간

---

## 디렉토리 구조

```
superpowers/
├── .claude-plugin/          # Claude Code 플러그인 설정
├── .cursor-plugin/          # Cursor 플러그인 설정
├── .codex/                  # Codex 플랫폼 지원
├── .opencode/               # OpenCode 플랫폼 지원
├── .github/                 # GitHub 설정
├── agents/                  # 에이전트 정의 (1개)
├── commands/                # 슬래시 커맨드 (3개, 모두 deprecated)
├── hooks/                   # 훅 설정
├── skills/                  # 스킬 정의 (9개)
├── docs/                    # 문서
└── tests/                   # 테스트
```

---

## 1. Skills (스킬) - 9개

### 핵심 스킬 (워크플로우 순서)

| # | 스킬 이름 | 설명 | 트리거 |
|---|----------|------|--------|
| 1 | **using-superpowers** | 세션 시작 시 로드되는 메타 스킬. 모든 스킬 사용법과 우선순위 규칙 정의 | SessionStart 훅으로 자동 주입 |
| 2 | **brainstorming** | 아이디어를 디자인/스펙으로 전환. 프로젝트 컨텍스트 탐색 → 질문 → 접근법 제안 → 디자인 승인 → 스펙 문서 작성 | 모든 창작 작업 전 **필수** (HARD-GATE) |
| 3 | **using-git-worktrees** | 격리된 git worktree 생성. 디렉토리 선택 → .gitignore 검증 → 프로젝트 셋업 → 테스트 베이스라인 확인 | 디자인 승인 후 자동 |
| 4 | **writing-plans** | 스펙을 2-5분 단위 bite-sized 태스크로 분해. 파일 구조 → 태스크 정의 → TDD 스텝 | 스펙 승인 후 |
| 5 | **executing-plans** | 플랜을 순차 실행 (서브에이전트 미지원 환경용). 플랜 로드 → 리뷰 → 태스크 실행 → 완료 | 플랜 실행 시 (서브에이전트 없을 때) |
| 6 | **subagent-driven-development** | 태스크별 서브에이전트 디스패치 + 2단계 리뷰 (스펙 준수 → 코드 품질). **핵심 실행 스킬** | 플랜 실행 시 (서브에이전트 있을 때, 권장) |
| 7 | **dispatching-parallel-agents** | 독립적인 2+ 태스크를 병렬 에이전트로 디스패치. 실패 그룹 분석 → 에이전트별 디스패치 → 결과 통합 | 독립 태스크 병렬 처리 시 |
| 8 | **requesting-code-review** | code-reviewer 에이전트 디스패치하여 코드 리뷰 요청. git SHA 기반 diff 리뷰 | 태스크 완료 후, 머지 전 |
| 9 | **receiving-code-review** | 코드 리뷰 피드백 수신 시 대응 방법. 검증 → 평가 → 기술적 응답 | 리뷰 피드백 수신 시 |

### 보조 파일 (스킬 내부)

| 스킬 | 보조 파일 | 용도 |
|------|----------|------|
| brainstorming | `visual-companion.md` | 브라우저 기반 시각적 브레인스토밍 (HTML 목업/다이어그램 서빙) |
| brainstorming | `spec-document-reviewer-prompt.md` | 스펙 문서 리뷰어 서브에이전트 프롬프트 템플릿 |
| brainstorming | `scripts/` | 비주얼 컴패니언 서버 스크립트 |
| writing-plans | `plan-document-reviewer-prompt.md` | 플랜 문서 리뷰어 서브에이전트 프롬프트 템플릿 |
| subagent-driven-development | `implementer-prompt.md` | 구현자 서브에이전트 프롬프트 템플릿 |
| subagent-driven-development | `spec-reviewer-prompt.md` | 스펙 준수 리뷰어 서브에이전트 프롬프트 템플릿 |
| subagent-driven-development | `code-quality-reviewer-prompt.md` | 코드 품질 리뷰어 서브에이전트 프롬프트 템플릿 |
| using-superpowers | `references/` | 플랫폼별 도구 매핑 (예: codex-tools.md) |
| finishing-a-development-branch | `SKILL.md` | 브랜치 완료 워크플로우 (테스트 → 옵션 제시 → 실행 → 정리) |

---

## 2. Agents (에이전트) - 1개

| 에이전트 | 파일 | 설명 |
|----------|------|------|
| **code-reviewer** | `agents/code-reviewer.md` | Senior Code Reviewer 역할. 플랜 정합성, 코드 품질, 아키텍처, 문서화, 이슈 분류(Critical/Important/Suggestion) |

### 서브에이전트 역할 (프롬프트 템플릿 기반, 별도 에이전트 파일은 아님)

| 역할 | 정의 위치 | 설명 |
|------|----------|------|
| **Implementer** | `subagent-driven-development/implementer-prompt.md` | 태스크 구현, 테스트 작성, 커밋, 셀프리뷰 |
| **Spec Reviewer** | `subagent-driven-development/spec-reviewer-prompt.md` | 구현이 스펙과 일치하는지 검증 (구현자 리포트를 신뢰하지 않음) |
| **Code Quality Reviewer** | `subagent-driven-development/code-quality-reviewer-prompt.md` | 코드 품질, 유지보수성, 테스트 품질 검증 |
| **Spec Document Reviewer** | `brainstorming/spec-document-reviewer-prompt.md` | 스펙 문서 완성도, 일관성, 명확성 검증 |
| **Plan Document Reviewer** | `writing-plans/plan-document-reviewer-prompt.md` | 플랜 문서 완성도, 스펙 정합성, 태스크 분해 검증 |

---

## 3. Hooks (훅) - 1개

| 이벤트 | 매처 | 동작 |
|--------|------|------|
| **SessionStart** | `startup\|clear\|compact` | `hooks/session-start` 셸 스크립트 실행 |

### session-start 훅 동작
1. `using-superpowers` 스킬의 SKILL.md 전체 내용을 읽음
2. JSON 이스케이프 후 `additionalContext`로 주입
3. 레거시 스킬 디렉토리(`~/.config/superpowers/skills`) 존재 시 경고 메시지 추가
4. 플랫폼별 분기: Cursor → `additional_context`, Claude Code → `hookSpecificOutput.additionalContext`

### 추가 훅 파일
- `hooks-cursor.json` — Cursor 전용 훅 설정
- `run-hook.cmd` — Windows용 훅 실행 래퍼

---

## 4. Commands (커맨드) - 3개 (모두 Deprecated)

| 커맨드 | 대체 스킬 |
|--------|----------|
| `/brainstorm` | `superpowers:brainstorming` |
| `/execute-plan` | `superpowers:executing-plans` |
| `/write-plan` | `superpowers:writing-plans` |

---

## 5. 워크플로우 파이프라인

```
사용자 아이디어
    │
    ▼
[brainstorming] ── 프로젝트 컨텍스트 탐색 → 질문 → 접근법 제안
    │                → 디자인 승인 → 스펙 문서 작성
    │                → spec-document-reviewer 서브에이전트로 스펙 검증
    │
    ▼
[using-git-worktrees] ── 격리 워크트리 생성 → 셋업 → 테스트 베이스라인
    │
    ▼
[writing-plans] ── 스펙 → 파일 구조 설계 → 2-5분 단위 태스크 분해
    │               → plan-document-reviewer 서브에이전트로 플랜 검증
    │
    ▼
[subagent-driven-development] (또는 executing-plans)
    │   ┌─────────────────────────────────────────┐
    │   │ 태스크마다:                               │
    │   │  1. Implementer 서브에이전트 디스패치      │
    │   │  2. Spec Reviewer 서브에이전트 검증        │
    │   │  3. Code Quality Reviewer 서브에이전트 검증│
    │   │  4. 이슈 수정 후 다음 태스크               │
    │   └─────────────────────────────────────────┘
    │
    ▼
[requesting-code-review] ── 전체 구현 최종 리뷰
    │
    ▼
[finishing-a-development-branch]
    ├── 테스트 확인
    ├── 옵션 제시: Merge / PR / Keep / Discard
    └── 선택 실행 + 워크트리 정리
```

---

## 6. 플랫폼 지원

| 플랫폼 | 설치 방법 | 지원 수준 |
|--------|----------|----------|
| Claude Code | `/plugin install superpowers@claude-plugins-official` | 공식 마켓플레이스 |
| Cursor | `/add-plugin superpowers` | 플러그인 마켓플레이스 |
| Codex | URL fetch 기반 수동 설치 | 매뉴얼 |
| OpenCode | URL fetch 기반 수동 설치 | 매뉴얼 |
| Gemini CLI | `gemini extensions install` | 네이티브 |

---

## 7. VibeSpec과의 비교 포인트

| 관점 | Superpowers | VibeSpec |
|------|------------|----------|
| 스펙 작성 | brainstorming 스킬 (대화형) | vs-ideate → vs-plan (SDD 기반) |
| 플랜 분해 | writing-plans (2-5분 단위) | spec-writer + task-decomposition |
| 실행 방식 | subagent-driven-development | vs-exec / vs-next / vs-pick |
| 코드 리뷰 | code-reviewer 에이전트 + 2단계 리뷰 | simplify / simplify-loop |
| QA | 없음 (리뷰로 대체) | vs-qa (팀 기반 QA 파이프라인) |
| 브랜치 관리 | using-git-worktrees + finishing | vs-worktree + vs-merge |
| 시각적 도구 | visual-companion (HTML 서빙) | browser-control + Figma 연동 |
| 에러 학습 | 없음 | error-kb + self-improve |
| 배포 | 없음 | vs-release (릴리즈만 지원) |
