---
name: vs-skeleton-status
description: "[Core] 골격 문서 건강도 대시보드"
invocation: user
---

# Skeleton Status (골격 문서 건강도)

프로젝트 골격 문서 4종의 존재 여부, 완성도, 최근 변경을 대시보드로 표시합니다.

## When to Use

**사용하세요:**
- 골격 문서 현황을 한눈에 확인할 때
- 누락 문서나 불완전한 문서를 파악할 때
- 프로젝트 온보딩 시 문서 상태를 확인할 때

**사용하지 마세요:**
- 골격 문서를 생성하려면 → `/vs-skeleton-init`
- 플랜 진행률을 보려면 → `/vs-dashboard`

## Steps

1. **골격 문서 스캔**
   프로젝트 루트에서 4종 문서를 스캔합니다:
   - PRD.md, DESIGN.md, POLICY.md, ARCHITECTURE.md
   - 각 파일에 대해:
     - 존재 여부 확인
     - 존재하면 Read로 내용을 읽기
     - `<!-- skeleton:type=... -->` 메타데이터 확인
     - `<!-- [REQUIRED] -->` / `<!-- [OPTIONAL] -->` 마커 기반 섹션 존재 여부 파악

2. **completeness_score 계산**
   각 문서에 대해:
   ```
   score = (존재하는 필수섹션 수 / 전체 필수섹션 수) × 80 + (존재하는 선택섹션 수 / 전체 선택섹션 수) × 20
   ```

   문서별 필수/선택 섹션 기준:
   | 문서 | 필수 (R) | 선택 (O) |
   |------|---------|---------|
   | PRD.md | Vision, Target Users, User Stories, Feature Priority, Out of Scope (5) | Competitive Analysis, Metrics, Timeline (3) |
   | DESIGN.md | Color Palette, Typography, Spacing, Component Style (4) | Responsive Breakpoints, Animation, Dark Mode, Iconography (4) |
   | POLICY.md | Tech Stack, Dependencies Policy, Security Policy, Data Policy, Naming Convention (5) | Code Review Policy, Testing Policy, Deployment Policy (3) |
   | ARCHITECTURE.md | System Overview, Module Structure, Data Flow, ADR (4) | Infrastructure, Monitoring, Scaling Strategy (3) |

   섹션 존재 판단: 해당 제목(##)이 문서에 존재하고, 그 아래에 플레이스홀더({값})가 아닌 실제 내용이 1줄 이상 있으면 "존재"로 판정.
   `<!-- skeleton:type -->` 마커가 없는 문서(수동 생성)도 제목 기반으로 섹션을 매칭합니다.
   섹션 파싱 오류 시 (EC10): 해당 섹션 점수 0 처리 + 경고 출력.

3. **최근 변경 이력**
   각 문서에 대해 `git log --oneline -3 -- {파일명}` 실행하여 최근 3개 커밋을 수집합니다.

4. **대시보드 렌더링**
   ```
   ## 골격 문서 건강도

   | 문서 | 상태 | 완성도 | 필수 | 선택 | 최종 수정 |
   |------|------|--------|------|------|----------|
   | PRD.md | ✅ | 85/100 | 5/5 | 1/3 | 2일 전 |
   | DESIGN.md | ✅ | 60/100 | 4/4 | 0/4 | 5일 전 |
   | POLICY.md | ❌ | - | - | - | - |
   | ARCHITECTURE.md | ✅ | 40/100 | 2/4 | 1/3 | 오늘 |

   ### 전체 건강도: {평균 점수}/100
   (존재하지 않는 문서는 0점으로 계산)
   ```

5. **다음 액션 제안**
   `AskUserQuestion`으로 제안:
   - 누락 문서가 있으면:
     - label: "골격 문서 생성", description: "/vs-skeleton-init으로 누락 문서를 생성합니다"
   - 완성도 60 미만이면:
     - label: "문서 보완", description: "완성도가 낮은 문서를 보완합니다"
   - 모두 양호하면:
     - label: "플랜 진행", description: "/vs-plan으로 개발을 시작합니다"
   - 항상:
     - label: "종료", description: "대시보드를 닫습니다"

## Rules
- skeleton_guard QA config와 무관하게 항상 실행 가능 (독립 스킬)
- 문서가 하나도 없어도 에러 없이 대시보드 표시
- 수동 생성된 문서도 제목 기반으로 섹션 매칭
