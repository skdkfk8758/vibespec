# Changelog

## [0.29.0] - 2026-03-29

### 새 기능
- **transaction**: Plan/Task 모델에 DB 트랜잭션 경계 추가 (44ae984)
- **plan-verify**: 정량적 기준 실측 + QA findings 연계 추가 (fd4e4bd)
- **state-machine**: Plan/Task 상태 전환 가드 도입 (ec5b0a7)
- **patterns**: Superpowers 패턴 도입 — HARD-GATE, 구현자 불신, AC 표준화 (31e6bfc)
- **merge-report**: 머지 리포트 + vs-recap 스킬 추가 (38a7d4a)
- **pipeline**: 파이프라인 이음새 개선 10건 (1eecec4)
- **plan**: 스코프 확대 검토 옵션 추가 (dd4958f)
- **qa**: Diff-aware 라우트 매핑 + 회귀 테스트 자동 생성 (ad63f48)
- **guardrail**: careful/freeze/guard PreToolUse hook 실구현 (22cc831)
- **design-review**: 80항목 감사 + A~F 등급 + 수정 루프 (93fc117)
- **security**: OWASP Top 10 전체 커버리지 확대 (5a5d236)
- **ideate**: 적응형 후속 질문 + 점진적 스펙 매핑 추가 (ec20963)

### 버그 수정
- **observability**: 빈 catch 블록 로깅 추가 + verbose 모드 도입 (d7552ed)
- **security**: GitHub import 명령 주입 취약점 수정 (198c762)
- **hooks**: 훅 안정성 강화 — set -euo, jq 체크, fallback 수정 (d76a447)
- **qa**: 복합 시나리오 QA 발견 이슈 2건 수정 (4f5cd11)
- **stability**: CRITICAL 이슈 3건 + 스코프 규칙 명확화 (16e2505)
- **cli**: context search 명령 추가 + security-only Run FK 수정 (f21776d)
- **pipeline**: 시뮬레이션 발견 잔여 이슈 6건 수정 (98237ae)

### 리팩토링
- **cli**: God File 분할 — index.ts를 8개 도메인 모듈로 분리 (45e0307)
- **types**: as any 타입 단언 제거 및 Input DTO 타입 정의 (45a859f)

### 테스트
- **models**: 4개 미테스트 모델에 74개 테스트 추가 (162f10a)

### 문서
- **cleanup**: 제거된 배포 스킬 잔존 참조 정리 + QA 리포트 (29c5bbe)
- **readme**: 스킬 테이블 및 디렉토리 트리 업데이트 (208c9ce)

### 기타
- **simple-backlog**: 6건 simple 백로그 일괄 정리 (a2fb95a)
- **deploy**: 배포 관련 스킬 3종 제거 (e3e7527)
- **build**: 빌드 산출물 갱신 (d619cd5)

## [0.28.0] - 2026-03-27

### 새 기능
- **qa-cli**: QA run complete CLI 명령 추가 (ba0a6c2)
- **opportunistic**: 구현 중 백로그/크로스플랜 융통성 추가 (26ebc19)
- **design**: 디자인 시스템 통합 기능 추가 — vs-design-init, vs-design-review (d302515)
- **security**: 보안 감사 기능 추가 — vs-security (05c7c64)
- **qa-visual**: 브라우저 기반 시각적 QA 기능 추가 — vs-acceptance, vs-browse (6dc5d71)
- **ideate**: 아이디어 검증 기능 추가 — vs-ideate (68a3c17)
- **guardrail**: 안전 가드레일 기능 추가 — vs-careful, vs-freeze, vs-guard (5df303e)
- **backlog**: Backlog 모델, CLI, 타입 확장 + 대시보드 연동 + 외부 import (e5f7969, 3f7ad21)
- **merge**: vs-merge 충돌 해결 고도화 + Post-Merge Acceptance Testing (628ecb2)

### 버그 수정
- **security**: read-config.sh SQL injection 방지 (fc50b1b)

### 리팩토링
- **guardrail**: simplify-loop R1 — 코드 품질 개선 6건 (135d5f9)

### 기타
- **build**: 빌드 산출물 갱신 (8cde274, e396c57, e2d46f8, 16219db)
- **hooks**: hooks 스크립트 업데이트 (0381665)

## [0.27.1] - 2026-03-26

### 버그 수정
- **error-kb**: `listErrorFiles`에서 underscore로 시작하는 nanoid가 `_index.md` 필터에 의해 누락되던 버그 수정 (1c08388)
- **formatters**: `formatPlanList`에서 `created_at` null 방어 추가 (1c08388)

### 리팩토링
- **workflow**: codex-review 스킬 제거 및 전체 참조 정리 — verifier 단독 판정으로 단순화 (91f973d)
- **workflow**: vs-commit에 Phase 0 (simplify-loop 선택적 게이트) 및 Phase 7 (플랜 완료 감지) 추가 (91f973d)
- **workflow**: vs-next에 플랜 완료 시 vs-qa → vs-plan-verify 검증 흐름 추가 (91f973d)

### 테스트
- **plan**: approved 상태 테스트 3건 추가 — approve, list filter, guard (1c08388)
- **error-kb**: getStats 테스트 디버깅 assertion 보강 (1c08388)

## [0.27.0] - 2026-03-25

### 새 기능
- **qa**: QA 시스템 데이터 레이어 및 CLI 구현 — DB migration 8 (qa_runs, qa_scenarios, qa_findings 테이블 + VIEW), QA 타입/모델 CRUD, vs qa 서브커맨드 10개 (249b65b)
- **agents**: QA 에이전트 팀 정의 — qa-coordinator(프로젝트 분석→시나리오 생성→팀 디스패치), qa-func-tester(기능/통합/회귀 검증), qa-flow-tester(플로우/엣지케이스 검증), qa-reporter(이슈 정리→수정 플랜 생성) (86be884)
- **qa**: QA 스킬, 대시보드 통합, 알림 시스템 구현 — /vs-qa, /vs-qa-status, /vs-qa-findings 스킬, DashboardEngine QA 섹션, AlertsEngine QA 알림 4종 (50310dc)
- **qa**: 시나리오 사용자 가시성 개선 — coordinator 리뷰 체크포인트(Phase 2.5), reporter 마크다운 리포트 자동 생성(Phase 3.5), /vs-qa-scenarios 스킬, /vs-qa 리뷰 모드 옵션 (80bab0a)

### 리팩토링
- **qa**: 코드 리뷰 개선 — initQAModels() 통합, N+1 쿼리 배치화, updateStatus 조건 분기 단순화, qa stats 집계 버그 수정 (bceb41c)

### 문서
- **design**: QA Agent Team 설계서 추가 — 아키텍처, 데이터 모델, 에이전트 역할, 사용자 플로우, 대시보드 통합 방안 (a2acac7)

## [0.26.0] - 2026-03-25

### 새 기능
- **self-improve**: DB v7 마이그레이션 및 SelfImproveEngine 핵심 인프라 구축 — self_improve_rules 테이블, 규칙 CRUD/승격/아카이브, pending 관리, 효과 측정 (a749772)
- **hooks**: self-improve hook 시스템 구현 — fix 커밋 감지→pending 생성, 세션 시작 상태 알림, 커밋 전 규칙 리마인드 (c0bcab9)
- **self-improve**: /self-improve, /self-improve-review 스킬 및 CLI 확장 — 5-Phase pending 분석→KB 기록→규칙 승격 워크플로우, 규칙 정리 스킬, vs self-improve CLI 명령 (1d9cdee)
- **agents**: Verifier Phase 3.5 Self-Challenge 추가 — PASS 판정 시 Error KB/Rules 대조, 역방향 검증으로 확신의 함정 방지 (2aa3ffe)

### 문서
- **design**: Self-Improving Pipeline 설계서 추가 — Karpathy autoresearch 영감의 fix→learn→prevent 루프 전체 아키텍처 (6288b82)

## [0.25.0] - 2026-03-24

### 새 기능
- **vs-merge**: 충돌 해결 인터뷰를 hunk 단위 3-way diff로 강화 — 충돌 영역별 개별 인터뷰, base/ours/theirs 3-way 표시, 의미 요약, 원인 커밋 표시, "양쪽 모두" 선택지 추가 (9218760)

## [0.24.0] - 2026-03-24

### 새 기능
- **task**: AC 검증 유틸리티 함수 및 모델 통합 — validateAcceptance()로 빈 문자열, 단일 항목, 동사 누락 감지, TaskWithWarnings 타입 도입 (986db59)
- **cli**: AC 검증 warning 출력 및 --force 플래그 추가 — task create 시 품질 경고 표시, --json 모드 warnings 포함 (5d57da9)
- **agents**: 검증 파이프라인 신뢰성 강화 — vs-exec verifier 에이전트 디스패치, tdd-implementer AC 번호 네이밍 컨벤션, verifier 테스트-AC 명시적 매핑 (71e44bf)

## [0.23.1] - 2026-03-24

### 버그 수정
- **schema**: plans.status CHECK 제약에 approved 추가 — DB 마이그레이션 v6 (c316bf1)

### 리팩토링
- **core**: 공유 유틸리티 모듈 추출 및 타입 안전성 강화 — generateId, hasColumn, buildUpdateQuery, EntityType/EventType union (3ca4ffd)
- **models**: PlanModel·TaskModel 중복 제거 및 성능 개선 — transitionStatus 추출, N+1 쿼리 제거 (748a1de)

### 성능 개선
- **engine**: ErrorKB·Alerts 성능 최적화 및 CLI 리팩토링 — getStats 직접 파싱, plan_progress 1회 조회, withErrorHandler 추출 (b22e684)

## [0.23.0] - 2026-03-24

### 새 기능
- **vs-plan**: 요구사항 인터뷰 구조화 및 코드베이스 탐색 단계 강화 (c47a9be)
- **vs-dashboard**: 대시보드 기능 정의 대폭 개선 — 프로그레스 바, 리스크 분석, 속도 통계, 조건부 안내 (bb90da2)

### 버그 수정
- **skills**: 태스크 실행 스킬 개선 — 순환 의존성 감지, 의존성 시각화, WARN/FAIL 기준표 (dfca58f)
- **skills**: 리뷰·커밋 스킬 개선 — 타임아웃 처리, scope 보정, staged 분리 처리 (56fd93d)
- **skills**: 격리·병합 스킬 개선 — lock 파일 판단, 대규모 충돌 처리, 커밋 메시지 확인 (e2f2067)
- **skills**: 검증·배포 스킬 개선 — 부분 실패 판정, concerns 가중치, 네트워크 재시도 (833c662)
- **skills**: 온보딩·복원 스킬 개선 — 트러블슈팅 강화, stash 충돌 가이드, alert 신호 추가 (ba8ee95)
- **skills**: Skills 2.0 준수 — description 패턴 수정 및 When to Use 섹션 추가 (f790c6b)
- **codex-review**: codex-review 스킬 업데이트 (5e7febf)

## [0.22.0] - 2026-03-24

### 새 기능
- **scope-control**: 에이전트 범위 통제(Scope Control) 레이어 추가 (3262041)
  - tasks 테이블에 `allowed_files`/`forbidden_patterns`, task_metrics에 `changed_files_detail`/`scope_violations` 필드 추가 (migration v4-5)
  - CLI에 `--allowed-files`, `--forbidden-patterns`, `--changed-files-detail`, `--scope-violations` 옵션 추가
  - tdd-implementer: Phase 0.5 Modification Plan 삽입, REFACTOR 단계 제약 강화
  - verifier: Phase 2.5 Scope Verification, 레거시 보호 체크, 변경 파일 요약 섹션
  - debugger: scope 규칙 수신 및 준수 검증
  - vs-next/vs-exec: scope 정보 에이전트 전달, 종합 리포트에 scope 포함
  - vs-plan: 태스크 분해 시 scope 가이드 및 CLI 옵션 안내

## [0.21.1] - 2026-03-23

### 버그 수정
- **vs-merge**: 타겟 브랜치 자동 선택 대신 사용자 인터뷰 방식으로 변경 (3349916)

## [0.21.0] - 2026-03-23

### 새 기능
- **validate**: 스킬 정적 검증 강화 및 일관성 검증 추가 (62db4c9)
  - 프론트매터 스키마 검증(name, description 필수), invocation enum 체크
  - body 필수 섹션 경고, hooks.json 참조 파일 존재 검증, 에이전트 프론트매터 검증
  - `npm run validate`로 전체 검증 실행 가능
- **skill-usage**: 스킬 사용량 로깅 시스템 추가 (25dc909)
  - skill_usage 테이블(v3 마이그레이션), SkillUsageModel(record/getStats/getRecentUsage)
  - `vs skill-log` / `vs skill-stats` CLI 명령으로 스킬 호출 패턴 추적
- **dashboard**: 대시보드에 스킬 사용량 Top 5 통합 (4306504)
  - DashboardEngine에 getSkillUsageSummary 메서드 추가
  - `vs dashboard` 출력에 최근 7일 스킬 사용 빈도 섹션 표시

### 버그 수정
- **skill-usage**: getStats SQL 파라미터 바인딩 복원 (05809a7)

### 리팩토링
- 코드 리뷰 피드백 반영 — 불필요한 쿼리·주석 제거 및 포매터 통합 (6f6192d)

## [0.20.1] - 2026-03-23

### 리팩토링
- **obsidian**: Obsidian 연동 코드 전체 제거 (3e928ca)
  - ObsidianAdapter, SyncEngine, 관련 테스트 삭제
  - ErrorKBEngine에서 mirrorToObsidian, searchWithObsidian 제거
  - CLI에서 --vault, --with-obsidian, sync 커맨드 제거
  - skills(vs-setup, vs-review, error-kb), hooks에서 Obsidian 안내 제거
  - obsidian-ts 의존성 제거
  - error-kb는 순수 파일 기반(.claude/error-kb/)으로 동작

## [0.20.0] - 2026-03-23

### 새 기능
- **vs-setup**: Obsidian 연동 선택 단계 추가 (5bd8e82)
  - 초기 셋업 시 Obsidian 볼트 연동을 안내하여 별도 설정 없이 온보딩 완료 가능
- **vs-review**: Obsidian 볼트에서 스펙 리뷰/편집 지원 (9b25dea)
  - 볼트 설정 시 리뷰 파일을 볼트에 생성하고 `obsidian://` URI로 열어 직접 편집 가능

## [0.19.0] - 2026-03-23

### 새 기능
- **obsidian**: Obsidian 양방향 동기화 엔진 및 어댑터 구현 (136a0cf)
  - `obsidian-ts` 패키지 기반 async API로 ObsidianAdapter 재작성
  - ErrorKBEngine에 fire-and-forget 미러링 및 양방향 검색 통합
  - SyncEngine으로 LWW 충돌 해결 기반 전체 동기화 지원
  - `vs_config` 테이블 및 설정 시스템 추가
- **cli**: Obsidian 연동 CLI 커맨드 추가 (0790b47)
  - `vs config` (set/get/list/delete) 커맨드
  - `vs error-kb sync [--import] [--dry-run]` 서브커맨드
  - `--vault`, `--with-obsidian` 옵션
- **skills**: 훅 및 스킬에 Obsidian 연동 안내 추가 (f6f90ea)
  - error-kb-suggest 훅에 vault 감지 시 `--with-obsidian` 자동 추가
  - error-kb 스킬에 Obsidian 연동 섹션 및 동기화 명령어 추가
  - vs-next 스킬의 에러 KB 검색에 `--with-obsidian` 기본 포함

## [0.18.0] - 2026-03-22

### 새 기능
- **error-kb**: 에러 지식 베이스 엔진 및 Obsidian CLI 어댑터 추가 (b729238)
- **cli**: vs error-kb CLI 명령어 6개 및 포매터 추가 (578969a)
- **skills**: error-kb 스킬 추가 — 에러 검색/기록 워크플로우 (2d6ded0)
- **error-kb**: 에러 KB 자동화 훅 및 스킬 워크플로우 통합 (37735d9)

### 리팩토링
- **cli**: CLI 바이너리명 vp에서 vs로 변경 (81af8b7)

## [0.17.0] - 2026-03-21

### 새 기능
- **vs-merge**: 충돌 발생 시 파일별 사용자 인터뷰 방식으로 변경 (4473865)
- **hooks**: 워크트리 내 메인 브랜치 보호 훅 추가 (674a251)

### 리팩토링
- **cli**: MCP 서버 제거 후 CLI를 유일한 데이터 접근 인터페이스로 전환 (41e18f0)
  - `--json` 글로벌 플래그 추가, 누락 명령 10개 추가
  - `@modelcontextprotocol/sdk` 의존성 제거
- **skills**: 모든 스킬의 MCP 도구 호출을 CLI 명령으로 변환 (85edd52)

### 기타
- **mcp**: MCP 서버 소스, 테스트, 스크립트, 빌드 산출물 삭제 (e90f488)
- **config**: 플러그인 메타데이터에서 MCP 키워드 제거 (72a6fc1)

## [0.16.4] - 2026-03-20

### 리팩토링
- **mcp**: 플러그인 내 중복 .mcp.json 제거 (0475c45)

## [0.16.3] - 2026-03-20

### 버그 수정
- **mcp**: MCP 도구 prefix를 vs_로 통일한 빌드 산출물 반영 (2459cef)
- **mcp**: 글로벌 MCP 자동 등록 로직 추가 (14eb9f4)

## [0.16.2] - 2026-03-20

### 리팩토링
- **mcp**: MCP 도구 prefix를 vp_에서 vs_로 통일 (0d12954)
- **skills**: 스킬/에이전트의 MCP 도구 참조 통일 및 vs-setup·vs-update 로직 개선 (c777e84)

## [0.16.1] - 2026-03-20

### 버그 수정
- **vs-update**: 업데이트 시 native 의존성 누락으로 MCP 연결 실패하는 문제 수정 (49615e9)

## [0.16.0] - 2026-03-19

### 새 기능
- **vs-merge**: squash merge 후 통합 검증 게이트(Phase 4.5) 추가 (3a8df9d)

### 버그 수정
- **codex-review**: Codex CLI 타임아웃을 2분에서 5분으로 증가 (8c30fe7)

### 기타
- **build**: 빌드 산출물 갱신 (18e201a)

## [0.15.0] - 2026-03-19

### 새 기능
- **deps**: 의존성 그래프 기반 Wave 스케줄링 시스템 구현 (dc6a4c7)
- **verification**: 플랜 단위 검증 스킬(vs-plan-verify) 추가 (1137ea1)

### 문서
- **readme**: 누락된 스킬/에이전트 동기화 (18d8325)

### 기타
- **gitignore**: .claude/worktrees/ 디렉토리 제외 추가 (b7a43d8)

## [0.14.0] - 2026-03-19

### 새 기능
- **db**: plans 테이블에 branch/worktree_name 컬럼 추가 및 user_version 기반 migration 시스템 도입 (6ff2e4c)
- **plan**: 플랜 생성 시 git branch 자동 기록 및 vp_plan_list branch 필터 지원 (413a563)
- **hooks**: session-stash/restore 훅의 워크트리 지원 확대 — 워크트리에서도 stash 생성 및 복원 (46e5d5b)

## [0.13.3] - 2026-03-19

### 버그 수정
- **build**: nanoid, commander를 번들에 포함하여 플러그인 설치 시 모듈 누락 해결 (b5f8568)

## [0.13.2] - 2026-03-19

### 버그 수정
- **mcp**: 플러그인 설치 시 better-sqlite3 자동 설치 래퍼 스크립트 추가 (99b8238)

## [0.13.1] - 2026-03-19

### 버그 수정
- **vs-plan**: AskUserQuestion 체크포인트에 question, multiSelect 필드 명시 (84bd8a0)
- **db**: 워크트리 환경에서 프로젝트 루트 탐지 로직 개선 (857e63f)
- **build**: MCP SDK를 번들에 포함하도록 noExternal 설정 추가 (2bffe3e)

## [0.13.0] - 2026-03-19

### 새 기능
- **vs-exec**: 서브에이전트 없이 플랜 전체 순차 실행 스킬 추가 — 4-phase 워크플로우(플랜 로드→비판적 리뷰→순차 실행→종합 리포트) (373505f)
- **vs-next**: 워크트리 환경 확인 + 배치 실행 모드 + AskUserQuestion 체크포인트 추가 — 최대 3개 병렬 디스패치, 자동 재시도, 의존성 기반 스킵 (318e860)
- **vs-pick**: 워크트리 환경 확인 단계 추가 (3f830c6)
- **vs-plan**: 4-signal 복잡도 판단 기준으로 brainstorming 위임 로직 개선 (9873e4a)
- **vs-worktree**: 워크트리 생성 및 환경 셋업 스킬 추가 — .gitignore 검증, 의존성 설치, 테스트 베이스라인 자동화 (0786c75)

### 기타
- **skills**: Skills 2.0 invocation 필드 추가 (3913566)

## [0.12.0] - 2026-03-18

### 새 기능
- **codex-review**: Codex CLI 크로스 리뷰 스킬 추가 — 구현 완료 후 codex review로 크로스 모델 코드 리뷰 수행, graceful skip 지원 (77399ea)
- **workflow**: vs-next/vs-pick에 codex-review 병렬 실행 및 종합 리포트 통합 — verification과 codex-review 병렬 실행, PASS/WARN/FAIL 합산 판정 (b9f4bc9)
- **vs-plan**: 체크포인트에 AskUserQuestion 인터랙티브 선택 UI 적용 — 스펙 검토/플랜 리뷰 체크포인트를 인터랙티브 선택지로 개선 (39dad8f)

## [0.11.1] - 2026-03-18

### 버그 수정
- **hooks**: stash 훅 워크트리 교차 오염 방지 — 워크트리에서 Stop 훅 stash push 비활성화, stash 메시지에 브랜치명 포함 (448a970)
- **hooks**: stash 무한 누적 방지 — vibespec-session stash 최대 5개 제한, 초과 시 FIFO 삭제 (448a970)
- **hooks**: session-restore-check 브랜치 필터링 — 현재 브랜치와 일치하는 stash만 복원 안내, 기존/새 형식 호환 (448a970)
- **vs-resume**: 브랜치 검증 지침 추가 — stash 테이블에 브랜치/일치 컬럼, 불일치 복원 시 경고 (448a970)

## [0.11.0] - 2026-03-18

### 새 기능
- **vs-setup**: MCP 서버 자동 등록 — 플러그인 설치 후 /vs-setup 실행 시 MCP 미연결 감지하면 캐시에서 경로 탐지하여 .mcp.json에 자동 등록 (df8ae08)

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
