---
name: vs-dashboard
description: Use when checking project status dashboard. 활성 플랜 진행률, 알림, 속도 통계를 한눈에 조회합니다.
invocation: user
---

# Dashboard

프로젝트의 전체 현황을 조회하고 다음 액션을 제안합니다.

## CLI Reference

대시보드에서 사용하는 CLI 명령:
- `vs --json dashboard` — 활성 플랜 현황, 알림, 스킬 사용 통계 조회
- `vs --json stats` — 전체 프로젝트 속도 통계
- `vs --json stats <plan_id>` — 플랜별 velocity, 예상 완료일, timeline
- `vs plan show <plan_id>` — 플랜 상세 + 태스크 트리 (blocked 사유 확인용)

## Steps

1. **대시보드 데이터 조회**
   - Bash 도구로 `vs --json dashboard` 명령을 실행하세요
   - 활성 플랜이 있으면 각 플랜별로 `vs --json stats <plan_id>`도 실행하세요
   - 활성 플랜이 없으면 `vs --json stats`로 전체 통계만 조회하세요

2. **플랜별 프로그레스 바 렌더링**

   각 활성 플랜에 대해 아래 형식으로 렌더링하세요:

   ```
   📋 {plan_title} ({done}/{total} — {진행률}%)
   [████████████░░░░░░░░] 60%
   ├─ ✅ done: 6  🔄 in_progress: 2  📝 todo: 3  🚫 blocked: 1  ⏭️ skipped: 0
   └─ 속도: {tasks_per_day} tasks/day · 예상 완료: {estimated_completion_date}
   ```

   - 프로그레스 바는 `done / total` 비율로 계산 (skipped는 total에서 제외)
   - `█` (완료)와 `░` (미완료)를 사용, 전체 폭 20칸
   - 진행률 = `done / (total - skipped) * 100`

3. **태스크 상태 분포 요약**

   전체 프로젝트 수준의 상태 분포를 표로 표시하세요:

   ```
   프로젝트 요약: 활성 플랜 {active_count}개 · 전체 태스크 {total_tasks}개

   | 상태 | 개수 | 비율 |
   |------|------|------|
   | ✅ done | {n} | {%} |
   | 🔄 in_progress | {n} | {%} |
   | 📝 todo | {n} | {%} |
   | 🚫 blocked | {n} | {%} |
   | ⏭️ skipped | {n} | {%} |
   ```

4. **알림 목록 렌더링**

   알림 데이터를 아래 4가지 카테고리로 분류하여 해당 항목이 있을 때만 표시하세요:

   - **🚫 blocked** — 차단된 태스크 목록 (태스크 제목 + 차단 사유)
   - **🐌 stale** — 3일 이상 in_progress 상태인 태스크 (태스크 제목 + 경과 일수)
   - **🎉 completable** — 모든 태스크가 done이어서 플랜 완료 가능 (플랜 제목)
   - **👻 forgotten** — 7일 이상 활동 없는 플랜 (플랜 제목 + 마지막 활동일)

   알림이 없으면 "알림 없음 — 모든 플랜이 정상 진행 중입니다" 표시

5. **리스크 분석**

   blocked 또는 stale 항목이 있으면 리스크 섹션을 추가로 렌더링하세요:

   ```
   ⚠️ 리스크 분석:
   ```

   - **blocked 태스크 상세**: 각 blocked 태스크에 대해 `vs plan show <plan_id>`로 차단 사유를 조회하고, 사유와 함께 해소 방안을 제안
   - **stale 태스크 목록**: 3일 이상 정체된 태스크를 경과 일수 내림차순으로 나열
   - 리스크 항목이 없으면 이 섹션은 생략

6. **속도 통계 렌더링**

   `vs --json stats` 결과를 기반으로 표시:

   ```
   📊 속도 통계:
   ├─ 일일 완료 속도: {tasks_per_day} tasks/day (최근 7일 평균)
   ├─ 주간 완료: {weekly_done}개
   └─ 전체 예상 완료일: {estimated_date}
   ```

   - 플랜별 속도는 Step 2의 프로그레스 바에 이미 포함됨

7. **스킬 사용량 요약**

   `skill_usage` 데이터가 있으면:
   ```
   🔧 스킬 사용 빈도 (최근 7일):
   1. vs-next — 23회
   2. vs-commit — 18회
   ...
   ```
   - TOP 5까지만 표시
   - 데이터가 없으면 이 섹션은 생략

8. **다음 단계 안내 (조건부)**

   대시보드 상태에 따라 **우선순위가 높은 순서대로** 다음 액션을 `AskUserQuestion`으로 제안하세요:
   - question: "다음으로 무엇을 하시겠습니까?"
   - header: "다음 액션"
   - multiSelect: false

   **조건부 선택지** (위에서 아래로 우선순위):

   | 조건 | 선택지 | 설명 |
   |------|--------|------|
   | blocked 태스크 있음 | "차단 태스크 해소" | blocked 태스크를 확인하고 해결합니다 → 해당 태스크 상세 표시 |
   | completable 플랜 있음 | "플랜 완료 처리" | 모든 태스크가 done인 플랜을 완료합니다 → `/vs-release` 안내 |
   | stale 태스크 있음 | "정체 태스크 리뷰" | 오래 진행 중인 태스크를 점검합니다 → `/vs-review` 안내 |
   | forgotten 플랜 있음 | "방치된 플랜 정리" | 아카이브하거나 작업을 재개합니다 |
   | in_progress 태스크 있음 | "진행 중 태스크 이어서 작업" | 현재 작업 중인 태스크를 계속합니다 → `/vs-next` |
   | 활성 플랜 없음 | "새 플랜 생성" | `/vs-plan`으로 새 작업을 시작합니다 |
   | 그 외 | "다음 태스크 시작" | `/vs-next`로 다음 태스크를 가져옵니다 |

   해당 조건이 여러 개면 모두 선택지로 포함하되, 위 표의 순서(우선순위)대로 나열하세요.
   - blocked가 있으면 반드시 최상단에 배치하여 해소를 유도
   - completable이 있으면 완료 처리를 우선 안내하여 플랜을 마무리하도록 유도

## 다음 단계

- → `/vs-next`로 다음 태스크 시작
- → `/vs-pick`으로 특정 태스크 선택하여 시작
- → `/vs-exec`로 전체 태스크 일괄 실행
- → `/vs-worktree`로 격리된 환경에서 작업 시작
- → `/vs-commit`으로 미커밋 변경사항 정리
- → `/vs-review`로 스펙 점검
- 플랜 완료 근접 시 → `/vs-release`로 릴리즈 준비
