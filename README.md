# VibeSpec

SDD(Spec-Driven Development) 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 Claude Code 플러그인.

Claude Code에서 스펙을 작성하고, 플랜을 세우고, 태스크를 추적하고, 진행 상황을 한눈에 파악할 수 있습니다.

## Features

- **Claude Code Plugin** — 슬래시 커맨드, 훅, 에이전트를 포함한 통합 플러그인
- **MCP Server** — 15개 도구를 제공하는 MCP 서버
- **CLI (`vp`)** — 터미널에서 직접 플랜/태스크를 관리하는 CLI
- **SDD Workflow** — Spec → Plan → Tasks → Implementation 자동 워크플로우
- **SQLite 기반** — `better-sqlite3`로 로컬에 데이터 저장, 별도 서버 불필요
- **Dashboard & Alerts** — 프로그레스 바, stale/blocked/completable 자동 감지
- **Velocity & ETA** — 태스크 완료 속도 기반 예상 완료일 산출
- **Context Resume** — 세션 간 컨텍스트 저장/복원

## Install (Plugin)

Claude Code 안에서:

```bash
# 1. 마켓플레이스 등록
/plugin marketplace add skdkfk8758/vibespec

# 2. 플러그인 설치
/plugin install vibespec
```

설치하면 MCP 서버, Skills, Hooks가 자동으로 등록됩니다.

## Install (Manual)

```bash
npm install -g vibespec
```

`~/.claude/settings.json`에 MCP 서버 수동 추가:

```json
{
  "mcpServers": {
    "vibespec": {
      "command": "npx",
      "args": ["-y", "vibespec"]
    }
  }
}
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/vs-setup` | 초기 설정 및 SDD 워크플로우 안내 |
| `/vs-plan` | 스펙 작성 → 플랜 생성 → 태스크 분해 |
| `/vs-dashboard` | 활성 플랜 진행률, 알림, 속도 통계 |
| `/vs-resume` | 이전 세션 컨텍스트 복원 |
| `/vs-next` | 다음 태스크 가져와서 작업 시작 |
| `/vs-commit` | 변경사항 논리 그룹화 + 태스크 연동 커밋 |

## SDD Workflow

```
1. /vs-resume     → 이전 세션 복원
2. /vs-plan       → 스펙 작성 + 태스크 분해
3. /vs-next       → 태스크 하나씩 구현
4. /vs-dashboard  → 진행 현황 확인
5. 반복
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `vp_dashboard` | 활성 플랜 현황 + 알림 조회 |
| `vp_context_resume` | 이전 세션 컨텍스트 복원 |
| `vp_plan_create` | 플랜 생성 및 활성화 |
| `vp_plan_get` | 플랜 상세 + 태스크 트리 조회 |
| `vp_plan_complete` | 플랜 완료 처리 |
| `vp_plan_archive` | 플랜 아카이브 |
| `vp_plan_list` | 플랜 목록 (상태 필터 가능) |
| `vp_task_create` | 태스크 생성 (서브태스크 지원) |
| `vp_task_update` | 태스크 상태 변경 |
| `vp_task_get` | 태스크 상세 조회 |
| `vp_task_next` | 다음 pending 태스크 조회 |
| `vp_task_block` | 태스크 blocked 처리 |
| `vp_context_save` | 컨텍스트 로그 저장 |
| `vp_stats` | 속도 통계 + 예상 완료일 |
| `vp_history` | 엔티티 변경 이력 조회 |

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
│   └── vs-commit/SKILL.md      # /vs-commit
├── hooks/
│   ├── hooks.json           # 플러그인 훅 정의
│   └── on-commit-sync.sh    # 커밋 시 태스크 연동
├── agents/
│   ├── spec-writer.md          # SDD 스펙 작성 에이전트
│   ├── spec-writer/
│   │   ├── TEMPLATE.md         # 스펙 템플릿
│   │   └── EXAMPLE.md          # 스펙 예시
│   └── tdd-implementer.md      # TDD 구현 에이전트
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
