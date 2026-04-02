# VibeSpec — Architecture Document

<!-- skeleton:type=architecture -->
<!-- skeleton:version=1.0 -->

<!-- [REQUIRED] System Overview -->
## System Overview

VibeSpec은 Claude Code 플러그인으로, 로컬 SQLite DB와 마크다운 기반 스킬/에이전트 정의로 구성된 CLI 도구입니다. 사용자의 요구사항을 스펙으로 변환하고, 태스크로 분해하여 자동 실행하는 SDD 워크플로우를 제공합니다.

```
[사용자] → [Claude Code CLI] → [VibeSpec Plugin]
                                    ├── [스킬 엔진] → skills/*.md
                                    ├── [에이전트 엔진] → agents/*.md
                                    ├── [CLI 커맨드] → src/cli/commands/
                                    ├── [코어 엔진] → src/core/engine/
                                    └── [SQLite DB] → .claude/vibespec.db
```

<!-- [REQUIRED] Module Structure -->
## Module Structure

| 모듈 | 경로 | 책임 | 의존성 |
|------|------|------|--------|
| CLI | `src/cli/` | 명령어 파싱, 출력 포맷팅 | core |
| Core Engine | `src/core/engine/` | QA 설정, 검증 로직 | - |
| Skills | `skills/` | 스킬 정의 (마크다운) | - |
| Agents | `agents/` | 에이전트 정의 (마크다운) | - |
| Templates | `skills/*/templates/` | 문서 템플릿 | - |

### 디렉토리 구조
```
src/
├── cli/           # CLI 명령어 및 출력
│   ├── commands/  # 도메인별 명령어
│   └── __tests__/ # CLI 테스트
├── core/          # 코어 비즈니스 로직
│   └── engine/    # QA 엔진, 설정
skills/            # 스킬 정의
agents/            # 에이전트 정의
docs/              # 프로젝트 문서
```

<!-- [REQUIRED] Data Flow -->
## Data Flow

### 주요 데이터 흐름
1. **플래닝**: 사용자 입력 → vs-plan 스킬 → SQLite(plans/tasks 테이블) → 태스크 트리
2. **실행**: vs-next → 태스크 조회 → 에이전트 디스패치 → 구현 → verifier → done/blocked
3. **QA**: vs-qa → qa-config resolve → QA Run 생성 → 에이전트 팀 디스패치 → findings

### 상태 관리
- **플랜/태스크**: SQLite DB (plans, tasks, backlog 테이블)
- **QA 설정**: YAML 파일 (.claude/qa-rules.yaml) + DB 오버라이드
- **골격 문서**: 프로젝트 루트 마크다운 파일 (PRD.md, POLICY.md 등)

<!-- [REQUIRED] ADR -->
## Architecture Decision Records

### ADR-001: SQLite 임베디드 DB 선택
- **상태**: Accepted
- **컨텍스트**: 플랜/태스크 데이터를 영속 저장해야 하나, 외부 DB 서버 의존성을 피하고 싶음
- **결정**: better-sqlite3로 로컬 임베디드 DB 사용
- **근거**: 설치 불필요, 단일 파일, 빠른 읽기, CLI 도구에 적합
- **결과**: 멀티유저 동시 쓰기 불가 (단일 사용자 CLI이므로 문제 없음)

### ADR-002: 마크다운 기반 스킬/에이전트 정의
- **상태**: Accepted
- **컨텍스트**: 스킬과 에이전트의 동작을 정의하는 방법이 필요
- **결정**: 마크다운(.md) 파일로 프롬프트 기반 정의
- **근거**: 코드 변경 없이 동작 수정 가능, 가독성 높음, Claude가 직접 해석
- **결과**: 타입 안전성 없음 (마크다운이므로), 런타임 검증은 에이전트 자체가 수행
