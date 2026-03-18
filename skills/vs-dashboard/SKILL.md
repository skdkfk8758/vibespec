---
name: vs-dashboard
description: Use when checking project status dashboard. 활성 플랜 진행률, 알림, 속도 통계를 한눈에 조회합니다.
---

# Dashboard

프로젝트의 전체 현황을 조회하고 다음 액션을 제안합니다.

## Steps

1. **대시보드 데이터 조회**
   - `vp_dashboard`를 호출하여 활성 플랜 현황과 알림을 가져오세요

2. **현황 표시**
   각 활성 플랜에 대해:
   - 플랜 제목, 진행률(%)
   - 태스크 수: done / in_progress / blocked / todo
   - 프로그레스 바 시각화

   알림이 있으면 강조하세요:
   - stale: 3일 이상 진행 중인 태스크
   - blocked: 차단된 태스크가 있는 플랜
   - completable: 모든 태스크 완료, 플랜 완료 가능
   - forgotten: 7일 이상 활동 없는 플랜

3. **속도 통계**
   - `vp_stats`를 호출하여 일일 완료 속도를 보여주세요
   - 활성 플랜이 있으면 plan_id를 넘겨 예상 완료일도 보여주세요

4. **다음 액션 제안**

   **체크포인트**: 아래 상황에 맞는 액션을 제안하고 사용자의 선택을 받으세요:
   - completable 플랜 → 플랜 완료 제안
   - blocked 태스크 → 차단 해소 제안
   - stale 태스크 → 리뷰 제안
   - 그 외 → `/vs-next`로 다음 태스크 시작 제안

## 다음 단계

- → `/vs-next`로 다음 태스크 시작
- → `/vs-commit`으로 미커밋 변경사항 정리
- → `/vs-review`로 스펙 점검
- 플랜 완료 근접 시 → `/vs-release`로 릴리즈 준비
