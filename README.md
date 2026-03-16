# VibeSpec

SDD(Spec-Driven Development) 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 MCP 플러그인.

Claude Code에서 플랜을 세우고, 태스크를 추적하고, 진행 상황을 한눈에 파악할 수 있습니다.

## Features

- **MCP Server** — Claude Code에 12개 도구를 제공하는 MCP 서버
- **CLI (`vp`)** — 터미널에서 직접 플랜/태스크를 관리하는 CLI
- **SQLite 기반** — `better-sqlite3`로 로컬에 데이터 저장, 별도 서버 불필요
- **Dashboard & Alerts** — 프로그레스 바, stale/blocked/completable 자동 감지
- **Velocity & ETA** — 태스크 완료 속도 기반 예상 완료일 산출
- **Context Resume** — 세션 간 컨텍스트 저장/복원

## Installation

```bash
npm install -g vibespec
```

## Setup (Claude Code MCP)

`~/.claude/settings.json`에 추가:

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
