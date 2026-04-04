# VibeSpec — Project Rules

## 골격 문서 시스템

이 프로젝트는 골격 문서 4종(docs/PRD.md, docs/POLICY.md, docs/ARCHITECTURE.md, docs/DESIGN.md)으로 프로젝트 일관성을 관리합니다.

- `/vs-skeleton-init` — 골격 문서 생성
- `/vs-skeleton-status` — 건강도 대시보드
- `skeleton-guard` — 플래닝/구현 시 자동 정합성 체크
- `skeleton-evolve` — 플랜 완료 시 자동 개선 제안

문서 계층: PRD > POLICY > ARCHITECTURE > DESIGN (충돌 시 상위 우선)

## UX 기본 모드

VibeSpec 스킬은 **자동 진행이 기본값**이다. 모든 `/vs-*` 스킬은 `--interactive` 플래그 없이 호출되면 기본값 옵션을 자동 선택하고 핵심 결정만 질문한다. 상세: `docs/UX_DEFAULTS.md` 참조.

안전장치(파괴적 명령, 강제 완료 사유, 머지 충돌, 백업 덮어쓰기, secrets 감지)는 모드 무관하게 항상 사용자 확인을 받는다.

## 금지 패턴

- **git stash 자동화 금지**: hooks.json에 git stash를 자동 실행하는 훅(Stop, SessionStart 등)을 등록하지 말 것. 세션 종료 시 자동 stash는 작업 파일 소실을 유발함. worktree dirty check만 허용.
- **git stash 자동 조작 금지 (전체)**: 훅뿐 아니라 **스킬 본문에서도** `git stash apply/pop/drop/push` 자동 실행 금지. 자동 모드에서도 stash는 "알림만 표시 + 수동 복원 명령 안내" 수준까지만 허용. 이유: 복원 시 working tree 덮어쓰기 위험, 사용자가 의도적으로 남긴 stash 임의 소비 방지.
