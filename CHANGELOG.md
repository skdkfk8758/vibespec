# Changelog

## [0.10.2] - 2026-03-18

### 버그 수정
- **plugin**: 마켓플레이스 배포를 위한 플러그인 매니페스트 표준화 — category/tags 추가, name 통일, 비표준 필드 제거 (59493f6)

### 기타
- **config**: 플러그인 활성화 설정 추가 (fa7225d)

## [0.10.1] - 2026-03-18

### 버그 수정
- **plugin**: dist/ 빌드 결과물을 git에 포함하여 GitHub 릴리즈 설치 시 "Source path does not exist" 오류 해결 (596fd1f)

## [0.10.0] - 2026-03-18

### 새 기능
- **verification**: 태스크 완료 검증 스킬 추가 — acceptance criteria + 테스트/빌드/lint 기반 PASS/WARN/FAIL 판정 (a2d3465)
- **vs-next/vs-pick**: 완료 처리에서 verification 스킬 명시 호출 및 판정별 분기 처리 연동 (a2d3465)

### 문서
- **readme**: 설치 가이드를 Claude Code marketplace 기준으로 최신화, 마켓플레이스 이름 수정 (a2d3465)

## [0.9.4] - 2026-03-18

### 리팩토링
- **plugin**: .claude-plugin/ 플러그인 시스템 롤백 시도 후 마켓플레이스 호환성 검증을 거쳐 복원 (2f20964, 5ac55b1)

## [0.9.3] - 2026-03-18

### 버그 수정
- **plugin**: marketplace 이름을 vibespec으로 수정하여 설치 오류 해결 (a03a6d4)

## [0.9.2] - 2026-03-18

### 문서
- **readme**: 설치 가이드를 멀티 플랫폼 형식으로 개선 — Claude Cowork, Claude Code CLI, Other AI Assistants, Manual 섹션 분리 (f47272e)

### 버그 수정
- **test**: velocity 테스트 날짜를 상대 날짜로 변경 — 시간 경과 시 윈도우 밖으로 밀리는 문제 수정 (85f98ff)

## [0.9.0] - 2026-03-18

### 새 기능
- **skills**: SDD·TDD·태스크분해 도메인 지식 스킬 추가 — Claude가 커맨드 실행 시 자동 참조 (f685193)
- **skills**: 체크포인트 패턴 및 후속 커맨드 추천 섹션 추가 — 6개 커맨드 스킬 UX 표준화 (47273aa)
- **scripts**: 플러그인 유효성 검증 스크립트 추가 — 스킬/에이전트/훅 구조 자동 검증 (e5e056d)

### 문서
- **project**: CONTRIBUTING.md 기여 가이드 및 CI 검증 워크플로우 추가 (3018816)
- **readme**: 도메인 스킬, scripts, CONTRIBUTING.md 반영

## [0.8.0] - 2026-03-18

### 새 기능
- **hooks**: 세션 안전망 훅 추가 — Stop 시 git stash 자동 보존, SessionStart 시 stash 감지 알림 주입 (6871ffb)
- **hooks**: 워크트리 나갈 때 /vs-merge 안내 메시지 자동 표시 (6871ffb)
- **vs-merge**: 워크트리 squash-merge 스킬 추가 — 6단계 Phase로 고품질 커밋 메시지 생성 (8d27aef)
- **vs-resume**: stash 복원 단계 추가 — 세션 안전망 훅과 연동하여 감지·복원·삭제 선택 (46ea9b2)

### 문서
- **readme**: 신규 스킬·훅 문서화 및 Worktree Workflow, Session Safety Net 섹션 추가 (6a09b88)

## [0.7.3] - 2026-03-17

### 리팩토링
- **vs-review**: 인터랙티브 선택·성능 최적화 개선사항을 소스에 동기화 (eb5897c)

### 문서
- **readme**: vp_plan_approve 도구 추가, vs-review 설명 최신화 (README 동기화)

## [0.7.2] - 2026-03-17

### 리팩토링
- **skills**: vs-release 확인을 Phase 2 한 번으로 통합 — Y/local/버전직접입력으로 전체 흐름 결정 (bfbf6ad)

## [0.7.1] - 2026-03-17

### 문서
- **readme**: v0.7.0 기준으로 README 최신화 — 누락된 슬래시 커맨드 4개, MCP 도구 5개, Plugin Structure 반영 (5f91655)
- **skills**: vs-release Phase 1에 README 동기화 검증 단계 추가 (5f91655)

## [0.7.0] - 2026-03-17

### 새 기능
- **plugin**: MCP 서버 선언을 플러그인 시스템으로 위임 — `${CLAUDE_PLUGIN_ROOT}` 변수 사용으로 경로 하드코딩 제거 (57213fe)

## [0.6.1] - 2026-03-17

### 버그 수정
- **skills**: Skills 2.0 description 패턴 준수 — 모든 vs 스킬의 description을 "Use when..." 패턴으로 변환 (c079fc7)

## [0.6.0] - 2026-03-16

### 새 기능
- **engine**: InsightsEngine 패턴 분석 엔진 추가 — blocked 패턴, 소요 시간 통계, 성공률, 신뢰도 기반 추천 (5a08012)
- **mcp**: vp_insights 인사이트 조회 도구 추가 — scope별 학습 데이터 조회 (a720a49)

## [0.5.0] - 2026-03-16

### 새 기능
- **db**: task_metrics 테이블 및 plan_metrics 뷰 스키마 추가 (e72b095)
- **models**: TaskMetricsModel CRUD 및 duration 자동 계산 구현 (c8d1d68)
- **mcp**: vp_task_update에 metrics 필드 및 자동 수집 추가 (8d05e1a)
- **skills**: /vs-review 스펙 리뷰 및 에디터 편집 스킬 추가 (26c3683)
- **skills**: /vs-update 플러그인 셀프 업데이트 커맨드 추가 (55bf289)
- **skills**: vs-pick 태스크 선택 실행 스킬 추가 (94d67a0)
- **skills**: vs-release 릴리즈 자동화 스킬 추가 (96247e8)

### 버그 수정
- **plugin**: marketplace.json 플러그인 이름을 vibespec으로 복원 (9c21214)

### 기타
- **docs**: 완료된 플랜 태스크 문서 삭제 (0d9fd7c)

## [0.4.0] - 2026-03-16

### 새 기능
- **tools**: Plan/Task 편집·삭제 MCP 도구 추가 — vp_plan_update, vp_plan_delete, vp_task_edit, vp_task_delete (54958a9)
- **cli**: task create, task next 명령어 추가 (f8bb8cb)

### 버그 수정
- **deploy**: npm 패키지에 플러그인 파일(agents, skills, hooks, .claude-plugin) 포함 (ec6475a)
- **project**: MCP 서버/CLI 버전 하드코딩 제거, README 정확성 수정, shebang 중복 수정 (966826d)
- **skills**: 미존재 plan-reviewer 에이전트 참조 제거, verification 스킬 폴백 처리, vs-setup 진단 강화 (b62cb74)

### 리팩토링
- **core**: MCP 에러 핸들링 강화(ok/err/requireArgs 헬퍼), DB 경로 .git 기반 탐색 + VIBESPEC_DB_PATH 환경변수 지원, CLI initModels() 팩토리 통일 (bb42c2d)
- **agents**: spec-writer 에이전트를 TEMPLATE.md/EXAMPLE.md 분리 구조로 리팩토링 (886762b)

### 테스트
- **e2e**: 전체 워크플로우 통합 테스트 9개 추가 — 라이프사이클, 블로커, 컨텍스트, 트리, 에러 핸들링 (54f63b4)

## [0.3.2] - 2026-03-16

### 버그 수정
- **plugin**: agents 필드를 개별 .md 파일 경로 배열로 수정 (a6872a2)

### 기타
- **config**: 플러그인과 충돌하는 .mcp.json 제거 (fd33f78)

## [0.2.1] - 2026-03-16

### 버그 수정
- **plugin**: skills 필드 누락으로 슬래시 커맨드 미인식 문제 수정 (be1602d)

### 기타
- **hooks**: 커밋 시 plugin.json 필수 필드 검증 훅 추가 (9c7d903)
