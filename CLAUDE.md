# VibeSpec — Project Rules

## 골격 문서 시스템

이 프로젝트는 골격 문서 4종(PRD.md, POLICY.md, ARCHITECTURE.md, DESIGN.md)으로 프로젝트 일관성을 관리합니다.

- `/vs-skeleton-init` — 골격 문서 생성
- `/vs-skeleton-status` — 건강도 대시보드
- `skeleton-guard` — 플래닝/구현 시 자동 정합성 체크
- `skeleton-evolve` — 플랜 완료 시 자동 개선 제안

문서 계층: PRD > POLICY > ARCHITECTURE > DESIGN (충돌 시 상위 우선)
