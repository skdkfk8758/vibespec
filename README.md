# VibeSpec

SDD(Spec-Driven Development) 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 Claude Code 플러그인.

Claude Code에서 스펙을 작성하고, 플랜을 세우고, 태스크를 추적하고, 진행 상황을 한눈에 파악할 수 있습니다.

## Features

- **Claude Code Plugin** — 슬래시 커맨드, 훅, 에이전트를 포함한 통합 플러그인
- **CLI (`vs`)** — 터미널에서 직접 플랜/태스크를 관리하는 CLI (스킬에서도 자동 호출)
- **Error Knowledge Base** — 에러 지식을 마크다운으로 축적, 자동 검색/기록
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

Skills, Hooks가 자동으로 설치됩니다.

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
| `/vs-plan-verify` | 플랜 전체 구현 완성도 검증 (태스크 상태 + 회귀 테스트 + 성공 기준) |
| `/vs-update` | 플러그인을 최신 버전으로 업데이트 |
| `/error-kb` | 에러 지식 베이스 검색/기록 — 과거 해결책 조회, 디버깅 후 자동 기록 |

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

## CLI Commands

스킬 내부에서 `vs ... --json`으로 자동 호출되며, 터미널에서도 직접 사용할 수 있습니다.

```bash
# 대시보드
vs dashboard

# 플랜 관리
vs plan list [--status active] [--branch main]
vs plan create --title "새 기능 구현" [--spec "..."] [--summary "..."]
vs plan show <plan_id>
vs plan complete <plan_id>
vs plan approve <plan_id>
vs plan archive <plan_id>
vs plan update <plan_id> [--title "..."] [--spec "..."] [--summary "..."]
vs plan delete <plan_id>

# 태스크 관리
vs task create --plan <plan_id> --title "..." [--spec "..."] [--acceptance "..."] [--depends-on "id1,id2"]
vs task show <task_id>
vs task next <plan_id>
vs task update <task_id> <status> [--has-concerns] [--impl-status DONE]
vs task edit <task_id> [--title "..."] [--spec "..."] [--acceptance "..."]
vs task block <task_id> [--reason "..."]
vs task delete <task_id>

# 에러 지식 베이스
vs error-kb search <query> [--tag <tag>] [--severity <level>]
vs error-kb add --title "..." --cause "..." --solution "..." [--tags "t1,t2"] [--severity high]
vs error-kb show <id>
vs error-kb update <id> [--occurrence "context"] [--status resolved]
vs error-kb stats
vs error-kb delete <id>

# 설정
vs config set <key> <value>                  # 설정값 저장
vs config get <key>                          # 설정값 조회
vs config list                               # 전체 설정 목록
vs config delete <key>                       # 설정값 삭제

# 컨텍스트
vs context resume [--session-id <id>]
vs context save --summary "..."

# 통계 & 인사이트
vs stats [plan_id]
vs history <entity_type> <entity_id>
vs insights [--scope all|blocked_patterns|duration_stats|success_rates]

# 스킬 사용량
vs skill-log <name> [--plan-id <id>] [--session-id <id>]
vs skill-stats [--days <days>]
```

모든 명령에 `--json` 플래그를 추가하면 JSON 형식으로 출력됩니다.

## Plugin Structure

```
vibespec/
├── .claude-plugin/
│   ├── plugin.json          # 플러그인 매니페스트
│   └── marketplace.json     # 마켓플레이스 배포 설정
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
│   ├── vs-worktree/SKILL.md    # /vs-worktree
│   ├── vs-exec/SKILL.md        # /vs-exec
│   ├── vs-plan-verify/SKILL.md # /vs-plan-verify
│   ├── vs-update/SKILL.md      # /vs-update
│   ├── verification/SKILL.md         # 도메인: 태스크 완료 검증
│   ├── codex-review/SKILL.md        # 도메인: Codex CLI 크로스 리뷰
│   ├── sdd-methodology/SKILL.md   # 도메인: SDD 원칙
│   ├── tdd-principles/SKILL.md    # 도메인: TDD 원칙
│   ├── task-decomposition/SKILL.md # 도메인: 태스크 분해
│   └── error-kb/SKILL.md           # 에러 지식 베이스 검색/기록
├── hooks/
│   ├── hooks.json              # 플러그인 훅 정의
│   ├── on-commit-sync.sh       # 커밋 시 태스크 연동 + fix: KB 기록 제안
│   ├── error-kb-suggest.sh     # 테스트 실패/빌드 에러 감지 → KB 검색 제안
│   ├── session-stash.sh        # 세션 종료 시 미커밋 변경 stash 보존
│   ├── session-restore-check.sh # 세션 시작 시 stash 감지 알림
│   ├── worktree-exit-guide.sh  # 워크트리 나갈 때 vs-merge 안내
│   └── worktree-guard.sh       # 워크트리 내 메인 브랜치 보호
├── agents/
│   ├── spec-writer.md          # SDD 스펙 작성 에이전트
│   ├── spec-writer/
│   │   ├── TEMPLATE.md         # 스펙 템플릿
│   │   └── EXAMPLE.md          # 스펙 예시
│   ├── tdd-implementer.md      # TDD 구현 에이전트
│   ├── debugger.md             # 태스크 실패 자동 디버깅 에이전트
│   └── verifier.md             # 태스크 완료 검증 에이전트
├── scripts/
│   └── validate-plugin.ts     # 플러그인 유효성 검증
├── CONTRIBUTING.md             # 기여 가이드
└── src/                        # CLI 소스
    ├── cli/
    │   ├── index.ts              # 메인 CLI 엔트리포인트
    │   └── formatters.ts         # 출력 포매터
    └── core/
        ├── config.ts             # 설정 관리
        ├── engine/
        │   ├── alerts.ts         # 알림 엔진
        │   ├── dashboard.ts      # 대시보드 엔진
        │   ├── error-kb.ts       # 에러 KB 엔진
        │   ├── insights.ts       # 인사이트 분석 엔진
        │   ├── lifecycle.ts      # 태스크 라이프사이클 관리
        │   ├── stats.ts          # 통계 엔진
        │   └── sync.ts           # 에러 KB ↔ Obsidian 양방향 동기화
        ├── models/               # DB 모델
        │   ├── context.ts        # 컨텍스트 모델
        │   ├── event.ts          # 이벤트 모델
        │   ├── plan.ts           # 플랜 모델
        │   ├── task.ts           # 태스크 모델
        │   └── task-metrics.ts   # 태스크 메트릭 모델
        ├── db/                   # 스키마 및 DB 연결
        └── types.ts              # 공통 타입 정의
```

## Data Model

```
Plan (draft → active → approved → completed → archived)
 └── Task (todo → in_progress → done | blocked | skipped)
      └── SubTask (재귀적 하위 태스크)
```

- **Event** — 모든 상태 변경을 이벤트로 기록
- **ContextLog** — 세션별 작업 요약 저장
- **TaskMetrics** — 태스크 소요 시간, 성공률, 차단 패턴 분석

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
- `better-sqlite3` (로컬 DB)
- `commander` (CLI)

## License

MIT
