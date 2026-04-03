# VibeSpec

SDD(Spec-Driven Development) 기반 바이브코딩을 위한 스펙/플랜/태스크 관리 Claude Code 플러그인.

Claude Code에서 스펙을 작성하고, 플랜을 세우고, 태스크를 추적하고, 진행 상황을 한눈에 파악할 수 있습니다.

## Features

- **Claude Code Plugin** — 슬래시 커맨드, 훅, 에이전트를 포함한 통합 플러그인
- **CLI (`vs`)** — 터미널에서 직접 플랜/태스크를 관리하는 CLI (스킬에서도 자동 호출)
- **Error Knowledge Base** — 에러 지식을 마크다운으로 축적, 자동 검색/기록
- **Self-Improving Pipeline** — fix 커밋 자동 감지 → Error KB 기록 → 반복 패턴 규칙 승격 → 다음 세션 자동 적용
- **SDD Workflow** — Spec → Plan → Tasks → Implementation 자동 워크플로우
- **SQLite 기반** — `better-sqlite3`로 로컬에 데이터 저장, 별도 서버 불필요
- **Dashboard & Alerts** — 프로그레스 바, stale/blocked/completable 자동 감지
- **Velocity & ETA** — 태스크 완료 속도 기반 예상 완료일 산출
- **Context Resume** — 세션 간 컨텍스트 저장/복원
- **QA Pipeline** — 6종 QA 에이전트 팀 (기능/플로우/AC/보안/리포팅)으로 자동 검증
- **Backlog Management** — 아이디어/버그/작업 수집, 우선순위 관리, 플랜 승격, 외부 import
- **Guardrails** — careful(파괴적 명령 차단) + freeze(편집 범위 제한) 안전장치
- **Design System** — 디자인 시스템 생성(DESIGN.md) 및 구현 일치 감사

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

### Other AI Assistants

> `skills/*/SKILL.md`는 범용 포맷이므로 다른 AI 도구에서도 스킬 단독 사용 가능합니다.
> 단, CLI(`vs`), hooks, agents는 Claude Code 전용입니다.

## Slash Commands

| Command | Description |
|---------|-------------|
| `/vs-setup` | 초기 설정 및 SDD 워크플로우 안내 |
| `/vs-plan` | 스펙 작성 → 플랜 생성 → 태스크 분해 |
| `/vs-dashboard` | 활성 플랜 진행률, 알림, 속도 통계 |
| `/vs-next` | 다음 태스크 가져와서 작업 시작 (세션 복원 포함) |
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
| `/self-improve` | fix 커밋 분석 → Error KB 기록 → 반복 패턴 규칙 승격 |
| `/self-improve-review` | 축적된 규칙 효과 분석, 정리/통합/아카이브 |
| `/vs-qa` | QA 에이전트 팀 실행 — 시나리오 생성 → 검증 → 이슈 수집 → 수정 플래닝 |
| `/vs-backlog` | 백로그 관리 — 아이디어/버그/작업 추가, 우선순위 정리, 플랜 승격 |
| `/vs-acceptance` | AC 기반 브라우저/코드 검증 — 머지 후·플랜 검증·독립 호출 |
| `/vs-browse` | 탐색적 브라우저 QA — 자유 탐색으로 시각/기능/UX 이슈 발견 |
| `/vs-ideate` | 아이디어 검증 — 시장/기술/경쟁 분석 후 Go/No-Go 판정 |
| `/vs-careful` | 파괴적 명령 차단 (rm -rf, DROP TABLE 등) |
| `/vs-freeze` | 편집 범위 제한 — 지정 디렉토리 외부 Edit/Write 차단 |
| `/vs-guard` | careful + freeze 동시 활성화 |
| `/vs-code-review` | 코드 리뷰 — git diff 기반 버그 탐지 + 기계적 문제 자동 수정 |
| `/vs-plan-design-review` | 플랜 디자인 리뷰 — 7개 차원 0-10 점수 평가, 구현 전 디자인 검증 |
| `/vs-security` | 보안 감사 — 코드/의존성/설정 취약점 스캔 |
| `/vs-design-init` | 디자인 시스템 생성 — 인터뷰 기반 DESIGN.md 생성 |
| `/vs-design-review` | 디자인 감사 — UI 구현과 DESIGN.md 일치 여부 검증 |
| `/vs-recap` | 머지 결과 리뷰 — 변경 요약, Review Checklist, 충돌 해결 기록 |
| `/vs-skeleton-init` | 골격 문서 4종(PRD/POLICY/ARCHITECTURE/DESIGN) 인터뷰 기반 생성 |
| `/vs-skeleton-status` | 골격 문서 건강도 대시보드 — 정합성·최신성 점검 |
| `/vs-wrap` | 세션 학습 파이프라인 — 교훈 추출, 자동화 탐지, 후속 작업 제안 |
| `/adhoc` | 빠른 수정 — 스펙/플랜 없이 단순 버그·오타·설정 즉시 처리 |

### Domain Skills (자동 참조)

| Skill | Description |
|-------|-------------|
| `verification` | 태스크 완료 검증 — acceptance criteria + 테스트/빌드/lint 체크 |
| `completion-checks` | 태스크 완료 시 공통 체크 로직 — QA Shadow, Adaptive Planner, 백로그 매칭 |
| `sdd-methodology` | SDD 원칙, 스펙 구조, 품질 체크리스트 |
| `tdd-principles` | RED-GREEN-REFACTOR, AAA 패턴, TDD 적합성 판단 |
| `task-decomposition` | 15-30분 분해, INVEST 원칙, AC 작성법 |

도메인 스킬은 명시적 호출 없이 관련 커맨드 실행 시 Claude가 자동으로 참조합니다.

## SDD Workflow

```
1. /vs-plan       → 스펙 작성 + 태스크 분해
2. /vs-next       → 태스크 하나씩 구현
3. /vs-dashboard  → 진행 현황 확인
4. 반복
```

### Worktree Workflow

```
1. /vs-worktree   → 워크트리 생성 + 환경 셋업 (의존성, 테스트 베이스라인)
2. /vs-next       → 태스크 구현
3. /vs-merge      → squash-merge로 메인 브랜치에 병합
```

### Session Safety Net

세션 시작 시 미커밋 변경사항이 감지되면 안내 메시지를 표시합니다.

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
vs context search <query>                    # 컨텍스트 로그 검색

# Self-Improve (규칙 학습)
vs self-improve status                       # pending 수, 규칙 수, 마지막 실행
vs self-improve rules list [--status active] # 활성 규칙 목록
vs self-improve rules show <id>              # 규칙 상세
vs self-improve rules archive <id>           # 규칙 아카이브

# 통계 & 인사이트
vs stats [plan_id]
vs history <entity_type> <entity_id>
vs insights [--scope all|blocked_patterns|duration_stats|success_rates]

# 아이디어
vs ideate list                               # 아이디어 목록
vs ideate show <id>                          # 아이디어 상세

# 머지 리포트
vs merge-report list                         # 머지 리포트 목록
vs merge-report show <id>                    # 머지 리포트 상세
vs merge-report latest                       # 최근 머지 리포트
vs merge-report create --branch "..." --summary "..."  # 머지 리포트 생성

# 스킬 사용량
vs skill-log <name> [--plan-id <id>] [--session-id <id>]
vs skill-stats [--days <days>]

# 가드레일
vs careful on|off|status                     # 파괴적 명령 차단
vs freeze set <path>|off|status              # 편집 범위 제한
vs guard on [--freeze <path>]|off|status     # careful + freeze 동시 제어

# QA
vs qa run create <plan_id> [--trigger manual|auto|milestone]
vs qa run list [--plan <plan_id>]
vs qa run show <run_id>
vs qa run complete <run_id> [--summary "..."] [--status completed|failed]
vs qa scenario create <run_id> --title "..." --description "..." --category <cat>
vs qa scenario update <scenario_id> --status <status> [--evidence "..."]
vs qa scenario list <run_id> [--status <status>] [--category <cat>]
vs qa finding create <run_id> --title "..." --description "..." --severity <sev> --category <cat>
vs qa finding update <finding_id> --status <status> [--fix-plan-id <id>]
vs qa finding list [--run <run_id>] [--severity <sev>] [--status <status>]
vs qa finding stats [--plan <plan_id>]

# 백로그
vs backlog add --title "..." [--description "..."] [--priority high|medium|low] [--category feature|bug|chore|idea]
vs backlog list [--status open] [--priority high] [--category feature]
vs backlog show <id>
vs backlog update <id> [--title "..."] [--priority <p>] [--status <s>]
vs backlog delete <id>
vs backlog promote <id> --plan <plan_id>     # 백로그 → 플랜 태스크 승격
vs backlog stats
vs backlog board                              # 칸반 보드 뷰
vs backlog import github|file|slack [options] # 외부 소스에서 백로그 가져오기
```

모든 명령에 `--json` 플래그를 추가하면 JSON 형식으로 출력됩니다.

## Plugin Structure

```
vibespec/
├── .claude-plugin/        # 플러그인 매니페스트
├── skills/                # 41개 슬래시 커맨드 + 도메인 스킬
├── bin/                   # 가드레일 스크립트 (check-careful.sh, check-freeze.sh)
├── hooks/                 # 13개 PreToolUse/PostToolUse/SessionStart 훅
├── agents/                # 19개 에이전트 (spec-writer, tdd, verifier, debugger, QA 6종, skeleton, session 등)
├── scripts/               # 플러그인 유효성 검증
└── src/                   # CLI 소스 (TypeScript)
    ├── cli/               # CLI 엔트리포인트 + 포매터 + 임포터
    └── core/              # DB 모델, 엔진, 스키마, 타입
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
