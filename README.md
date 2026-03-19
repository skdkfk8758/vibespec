# VibeSpec

SDD(Spec-Driven Development) 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 Claude Code 플러그인.

Claude Code에서 스펙을 작성하고, 플랜을 세우고, 태스크를 추적하고, 진행 상황을 한눈에 파악할 수 있습니다.

## Features

- **Claude Code Plugin** — 슬래시 커맨드, 훅, 에이전트를 포함한 통합 플러그인
- **MCP Server** — 21개 도구를 제공하는 MCP 서버
- **CLI (`vp`)** — 터미널에서 직접 플랜/태스크를 관리하는 CLI
- **SDD Workflow** — Spec → Plan → Tasks → Implementation 자동 워크플로우
- **SQLite 기반** — `better-sqlite3`로 로컬에 데이터 저장, 별도 서버 불필요
- **Dashboard & Alerts** — 프로그레스 바, stale/blocked/completable 자동 감지
- **Velocity & ETA** — 태스크 완료 속도 기반 예상 완료일 산출
- **Context Resume** — 세션 간 컨텍스트 저장/복원

## Installation

### Claude Code

```bash
# 1. 마켓플레이스 등록
/plugin marketplace add skdkfk8758/vibespec

# 2. 플러그인 설치
/plugin install vibespec@vibespec
```

MCP 서버, Skills, Hooks가 자동으로 설치됩니다.

**업데이트:**

```bash
/plugin marketplace update vibespec
```

### Other AI Assistants (Skills Only)

`skills/*/SKILL.md` 파일은 범용 스킬 포맷을 따르므로 다른 AI 도구에서도 사용할 수 있습니다.
슬래시 커맨드(`/vs-*`)는 Claude 전용입니다.

| Tool | 사용 방법 | 지원 범위 |
|------|----------|----------|
| **Gemini CLI** | 스킬 폴더를 `.gemini/skills/`에 복사 | Skills only |
| **OpenCode** | 스킬 폴더를 `.opencode/skills/`에 복사 | Skills only |
| **Cursor** | 스킬 폴더를 `.cursor/skills/`에 복사 | Skills only |
| **Codex CLI** | 스킬 폴더를 `.codex/skills/`에 복사 | Skills only |
| **Kiro** | 스킬 폴더를 `.kiro/skills/`에 복사 | Skills only |

```bash
# 예시: OpenCode 프로젝트 레벨에 스킬 복사
mkdir -p .opencode/skills/
cp -r skills/* .opencode/skills/

# 예시: Gemini CLI 글로벌에 스킬 복사
cp -r skills/* ~/.gemini/skills/
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/vs-setup` | 초기 설정 및 SDD 워크플로우 안내 |
| `/vs-plan` | 스펙 작성 → 플랜 생성 → 태스크 분해 |
| `/vs-dashboard` | 활성 플랜 진행률, 알림, 속도 통계 |
| `/vs-resume` | 이전 세션 컨텍스트 복원 |
| `/vs-next` | 다음 태스크 가져와서 작업 시작 |
| `/vs-pick` | 태스크 목록에서 선택하여 작업 시작 |
| `/vs-exec` | 서브에이전트 없이 플랜 전체 순차 실행 |
| `/vs-review` | 스펙/태스크를 인터랙티브 선택하여 에디터에서 확인·수정 |
| `/vs-commit` | 변경사항 논리 그룹화 + 태스크 연동 커밋 |
| `/vs-worktree` | 워크트리 생성 + .gitignore 검증 + 의존성 설치 + 테스트 베이스라인 |
| `/vs-merge` | 워크트리 브랜치를 squash-merge로 메인 브랜치에 병합 |
| `/vs-release` | Conventional Commits 기반 릴리즈 자동화 |
| `/vs-update` | 플러그인을 최신 버전으로 업데이트 |

### Domain Skills (자동 참조)

| Skill | Description |
|-------|-------------|
| `verification` | 태스크 완료 검증 — acceptance criteria + 테스트/빌드/lint 체크 |
| `codex-review` | Codex CLI 크로스 리뷰 — 크로스 모델 코드 품질/버그/설계 검증 |
| `sdd-methodology` | SDD 원칙, 스펙 구조, 품질 체크리스트 |
| `tdd-principles` | RED-GREEN-REFACTOR, AAA 패턴, TDD 적합성 판단 |
| `task-decomposition` | 15-30분 분해, INVEST 원칙, AC 작성법 |

도메인 스킬은 명시적 호출 없이 관련 커맨드 실행 시 Claude가 자동으로 참조합니다.

## SDD Workflow

```
1. /vs-resume     → 이전 세션 복원 (stash 자동 감지)
2. /vs-plan       → 스펙 작성 + 태스크 분해
3. /vs-next       → 태스크 하나씩 구현
4. /vs-dashboard  → 진행 현황 확인
5. 반복
```

### Worktree Workflow

```
1. /vs-worktree   → 워크트리 생성 + 환경 셋업 (의존성, 테스트 베이스라인)
2. /vs-next       → 태스크 구현
3. /vs-merge      → squash-merge로 메인 브랜치에 병합
```

### Session Safety Net

세션 종료 시 미커밋 변경사항이 있으면 자동으로 `git stash`에 보존됩니다.
다음 세션 시작 시 자동으로 감지되어 `/vs-resume`으로 복원할 수 있습니다.

## MCP Tools

| Tool | Description |
|------|-------------|
| `vp_dashboard` | 활성 플랜 현황 + 알림 조회 |
| `vp_context_resume` | 이전 세션 컨텍스트 복원 |
| `vp_plan_create` | 플랜 생성 및 활성화 |
| `vp_plan_get` | 플랜 상세 + 태스크 트리 조회 |
| `vp_plan_complete` | 플랜 완료 처리 |
| `vp_plan_archive` | 플랜 아카이브 |
| `vp_plan_approve` | 플랜 스펙 검토 후 승인 |
| `vp_plan_list` | 플랜 목록 (상태 필터 가능) |
| `vp_plan_update` | 플랜 제목·설명·스펙 수정 |
| `vp_plan_delete` | 플랜 삭제 |
| `vp_task_create` | 태스크 생성 (서브태스크 지원) |
| `vp_task_update` | 태스크 상태 변경 |
| `vp_task_get` | 태스크 상세 조회 |
| `vp_task_next` | 다음 pending 태스크 조회 |
| `vp_task_edit` | 태스크 제목·설명·acceptance criteria 수정 |
| `vp_task_delete` | 태스크 삭제 |
| `vp_task_block` | 태스크 blocked 처리 |
| `vp_context_save` | 컨텍스트 로그 저장 |
| `vp_stats` | 속도 통계 + 예상 완료일 |
| `vp_history` | 엔티티 변경 이력 조회 |
| `vp_insights` | 패턴 분석 인사이트 조회 |

## Plugin Structure

```
vibespec/
├── .claude-plugin/
│   ├── plugin.json          # 플러그인 매니페스트
│   ├── marketplace.json     # 마켓플레이스 배포 설정
│   └── .mcp.json            # MCP 서버 선언 (${CLAUDE_PLUGIN_ROOT} 변수)
├── skills/
│   ├── vs-setup/SKILL.md       # /vs-setup
│   ├── vs-plan/SKILL.md        # /vs-plan
│   ├── vs-dashboard/SKILL.md   # /vs-dashboard
│   ├── vs-resume/SKILL.md      # /vs-resume
│   ├── vs-next/SKILL.md        # /vs-next
│   ├── vs-pick/SKILL.md        # /vs-pick
│   ├── vs-review/SKILL.md      # /vs-review
│   ├── vs-commit/SKILL.md      # /vs-commit
│   ├── vs-merge/SKILL.md       # /vs-merge
│   ├── vs-release/SKILL.md     # /vs-release
│   ├── vs-update/SKILL.md      # /vs-update
│   ├── verification/SKILL.md         # 도메인: 태스크 완료 검증
│   ├── codex-review/SKILL.md        # 도메인: Codex CLI 크로스 리뷰
│   ├── sdd-methodology/SKILL.md   # 도메인: SDD 원칙
│   ├── tdd-principles/SKILL.md    # 도메인: TDD 원칙
│   └── task-decomposition/SKILL.md # 도메인: 태스크 분해
├── hooks/
│   ├── hooks.json              # 플러그인 훅 정의
│   ├── on-commit-sync.sh       # 커밋 시 태스크 연동
│   ├── session-stash.sh        # 세션 종료 시 미커밋 변경 stash 보존
│   ├── session-restore-check.sh # 세션 시작 시 stash 감지 알림
│   └── worktree-exit-guide.sh  # 워크트리 나갈 때 vs-merge 안내
├── agents/
│   ├── spec-writer.md          # SDD 스펙 작성 에이전트
│   ├── spec-writer/
│   │   ├── TEMPLATE.md         # 스펙 템플릿
│   │   └── EXAMPLE.md          # 스펙 예시
│   └── tdd-implementer.md      # TDD 구현 에이전트
├── scripts/
│   └── validate-plugin.ts     # 플러그인 유효성 검증
├── CONTRIBUTING.md             # 기여 가이드
└── src/                        # MCP 서버 + CLI 소스
```

## CLI Usage

```bash
# 대시보드
vp dashboard

# 플랜 관리
vp plan list
vp plan list --status active
vp plan create --title "새 기능 구현"
vp plan show <plan_id>
vp plan complete <plan_id>

# 태스크 관리
vp task show <task_id>
vp task update <task_id> done

# 통계 & 이력
vp stats [plan_id]
vp history plan <plan_id>
vp history task <task_id>
```

## Data Model

```
Plan (draft → active → completed → archived)
 └── Task (todo → in_progress → done | blocked | skipped)
      └── SubTask (재귀적 하위 태스크)
```

- **Event** — 모든 상태 변경을 이벤트로 기록
- **ContextLog** — 세션별 작업 요약 저장

## Development

```bash
git clone https://github.com/skdkfk8758/vibespec.git
cd vibespec
npm install
npm run build
npm test
```

## Tech Stack

- TypeScript + tsup (빌드)
- Vitest (테스트)
- `@modelcontextprotocol/sdk` (MCP 서버)
- `better-sqlite3` (로컬 DB)
- `commander` (CLI)

## License

MIT
