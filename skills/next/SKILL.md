---
name: next
description: 다음 태스크 가져오기. 다음 pending 태스크를 조회하고 작업을 시작합니다.
---

# Next Task

다음 태스크를 가져와서 작업을 시작합니다.

## Steps

1. **활성 플랜 확인**
   - `vp_plan_list`를 status=active로 호출하여 활성 플랜 목록을 가져오세요
   - 플랜이 여러 개면 사용자에게 어느 플랜에서 작업할지 물어보세요
   - 활성 플랜이 없으면 `/vibespec:plan`으로 새 플랜을 만들도록 안내하세요

2. **다음 태스크 조회**
   - `vp_task_next`를 호출하여 다음 todo 태스크를 가져오세요
   - 남은 태스크가 없으면:
     - 플랜 완료 가능 여부를 확인하고 완료를 제안하세요
     - 또는 새 태스크 추가를 제안하세요

3. **태스크 상세 표시**
   - 태스크 제목, spec, acceptance criteria를 보여주세요
   - 서브태스크가 있으면 함께 표시하세요

4. **작업 시작**
   - `vp_task_update`로 status를 in_progress로 변경하세요
   - 태스크 spec을 기반으로 구현 방향을 안내하세요

5. **작업 완료 시**
   사용자가 작업 완료를 알리면:
   - acceptance criteria 충족 여부를 확인하세요
   - `vp_task_update`로 status를 done으로 변경하세요
   - `vp_context_save`로 완료 내용을 저장하세요
   - 다음 태스크가 있으면 계속할지 물어보세요
