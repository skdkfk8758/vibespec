# VibeSpec — Project Rules

## 백그라운드 에이전트 Stash 정책

에이전트를 `run_in_background: true`로 디스패치할 때 아래 정책을 반드시 따르세요:

### Read-only 에이전트 → git stash 생성 금지

다음 에이전트는 파일을 **읽기만** 하고 수정하지 않습니다. 디스패치 시 `git stash`를 생성하지 마세요:

- `qa-shadow` — 경량 코드 분석
- `design-review-light` — DESIGN.md 토큰 체크
- `skeleton-guard` — 골격 정합성 체크 (plan-check / impl-check)
- `plan-critical-reviewer` — 스펙 비판적 검토
- `plan-design-reviewer` — 디자인 점수 검증
- `qa-seeder` — QA 시나리오 생성

### Write 에이전트 → git stash 생성

다음 에이전트는 파일을 **수정**합니다. 디스패치 전 `git stash push -m "vibespec-session:..."` 생성:

- `tdd-implementer` — RED-GREEN-REFACTOR 구현
- `debugger` — 버그 수정
- `skeleton-evolve` — Phase 4 Auto 변경 적용 시에만 (분석 Phase에서는 생성 안 함)

### Orphan Stash 자동 정리

`vibespec-session` stash가 **3개 이상** 쌓이면:
- 각 stash의 diff가 현재 HEAD에 이미 반영되었으면 → 자동 `git stash drop`
- "orphan stash {N}개 자동 정리됨" 표시

## 골격 문서 시스템

이 프로젝트는 골격 문서 4종(PRD.md, POLICY.md, ARCHITECTURE.md, DESIGN.md)으로 프로젝트 일관성을 관리합니다.

- `/vs-skeleton-init` — 골격 문서 생성
- `/vs-skeleton-status` — 건강도 대시보드
- `skeleton-guard` — 플래닝/구현 시 자동 정합성 체크
- `skeleton-evolve` — 플랜 완료 시 자동 개선 제안

문서 계층: PRD > POLICY > ARCHITECTURE > DESIGN (충돌 시 상위 우선)
