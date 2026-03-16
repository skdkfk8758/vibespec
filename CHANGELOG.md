# Changelog

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
