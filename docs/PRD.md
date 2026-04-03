# VibeSpec — Product Requirements Document

<!-- skeleton:type=prd -->
<!-- skeleton:version=1.0 -->

<!-- [REQUIRED] Vision -->
## Vision

SDD(Spec-Driven Development) 기반의 바이브코딩 플러그인으로, Claude Code 사용자가 스펙 → 플랜 → 태스크 → 구현 사이클을 자동화하여 일관성 있는 개발을 수행할 수 있게 한다.

<!-- [REQUIRED] Target Users -->
## Target Users

| 사용자 유형 | 설명 | 핵심 니즈 |
|------------|------|----------|
| Claude Code 개발자 | Claude Code CLI를 사용하는 개발자 | 스펙 기반 자동화된 개발 워크플로우 |
| 팀 리더 | 프로젝트 진행 현황을 관리하는 리더 | 플랜/태스크 추적, QA 자동화 |

<!-- [REQUIRED] User Stories -->
## User Stories

- **US-01**: 개발자로서, 요구사항을 스펙으로 변환하여, 일관된 구현을 할 수 있다.
- **US-02**: 개발자로서, 태스크를 자동으로 분해하여, 15-30분 단위로 작업할 수 있다.
- **US-03**: 팀 리더로서, 대시보드를 통해, 전체 진행 현황을 파악할 수 있다.
- **US-04**: 개발자로서, 반복되는 에러 패턴을 자동 학습하여, 같은 실수를 반복하지 않을 수 있다.
- **US-05**: 개발자로서, 세션 종료 시 자동 리포트를 생성하여, 다음 세션에서 이어서 작업할 수 있다.
- **US-06**: 개발자로서, 워크트리 격리 환경에서 안전하게 작업하고, squash merge할 수 있다.

<!-- [REQUIRED] Feature Priority -->
## Feature Priority (MoSCoW)

### Must Have
- 스펙 기반 플랜 생성 (vs-plan)
- 태스크 자동 분해 및 실행 (vs-next, vs-exec, vs-pick)
- QA 자동화 (vs-qa, vs-acceptance, vs-browse, vs-plan-verify)
- 골격 문서 관리 (vs-skeleton-init/status + skeleton-guard/evolve 에이전트)
- 대시보드 및 현황 (vs-dashboard)
- 세션 관리 (vs-wrap, vs-recap)

### Should Have
- 워크트리 격리 환경 (vs-worktree, vs-merge, vs-freeze)
- 백로그 관리 (vs-backlog)
- 자기 개선 (self-improve, self-improve-review, dream)
- 에러 학습 (error-kb)
- 코드 리뷰 및 보안 (vs-code-review, vs-security)
- 안전 모드 (vs-careful, vs-guard)

### Could Have
- GC (vs-gc) — 데드코드, 규칙 위반 자동 탐지/수정
- 아이디에이션 (vs-ideate) — 아이디어 구조화
- Codex 연동 (codex 플러그인)
- Pencil 디자인 연동
- 디자인 리뷰 (vs-design-review, vs-plan-design-review)

### Won't Have (this release)
- 다국어 지원
- 실시간 협업 기능
- 클라우드 동기화
- GUI 기반 대시보드

<!-- [REQUIRED] Out of Scope -->
## Out of Scope

- 다국어 UI/인터뷰 지원
- 실시간 멀티유저 협업
- 클라우드 서버 기반 데이터 동기화
- GUI 기반 대시보드 (CLI 전용)
- 자체 에디터/IDE 구현

<!-- [OPTIONAL] Metrics -->
## Metrics

| 지표 | 측정 방법 | 목표 |
|------|----------|------|
| 태스크 완료 속도 (Velocity) | StatsEngine: 일별/주별 완료 태스크 수 | 일 5+ 태스크 |
| 플랜 완료율 | DashboardEngine: done/total 비율 | 80%+ |
| 정체 태스크 감지 | AlertsEngine: N일 이상 in_progress 상태 | 48시간 내 경고 |
| QA 발견 사항 | qa-findings-analyzer: 심각도별 분류 | critical 0건 유지 |
| 백로그 소화율 | DashboardEngine: open/total 비율 추적 | 주별 감소 추세 |
