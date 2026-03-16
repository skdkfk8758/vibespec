---
name: vs-review
description: Use when reviewing and editing specs. 플랜의 스펙과 태스크를 외부 에디터에서 열어 확인/수정하고, DB에 반영한 뒤 approved 상태로 전환합니다.
---

# Spec Review & Edit

플랜의 스펙과 태스크를 외부 에디터에서 열어 사용자가 직접 확인/수정합니다.

## Steps

1. **플랜 선택**
   - 인자로 plan_id가 주어지면 해당 플랜을 사용하세요
   - 없으면 `vp_plan_list`로 active 상태인 플랜 목록을 가져와서 선택하게 하세요
   - 플랜이 없으면 `/vs-plan`으로 먼저 플랜을 만들도록 안내하세요

2. **스펙 export**
   - `vp_plan_get`으로 플랜 스펙과 전체 태스크 트리를 가져오세요
   - 아래 포맷으로 임시 마크다운 파일을 생성하세요
   - 파일 경로: `/tmp/vs-review-{plan_id}.md`

   ```markdown
   ---
   plan_id: {plan_id}
   title: {plan_title}
   ---

   ## Plan Spec

   {plan.spec 내용}

   ## Tasks

   ### Task {순번}: {task.title} [task_id: {task.id}]
   **Spec:**
   {task.spec}

   **Acceptance:**
   {task.acceptance}
   ```

   - 서브태스크가 있으면 부모 태스크 아래에 `####` 수준으로 들여쓰기하세요
   - task_id는 `[task_id: xxx]` 형식으로 반드시 포함하세요 (파싱에 필요)

3. **에디터 열기**
   - `$EDITOR` 환경변수를 확인하세요 (없으면 `vi` 사용)
   - 에디터 타입에 따라 실행 방식을 결정하세요:

   **터미널 에디터** (`vim`, `nvim`, `vi`, `nano`, `emacs -nw`):
   → Bash로 블로킹 실행: `$EDITOR /tmp/vs-review-{plan_id}.md`
   → 에디터가 종료되면 자동으로 다음 단계로 진행

   **GUI 에디터** (`cursor`, `code`, `subl`, `zed` 등):
   → `--wait` 플래그를 붙여서 블로킹 실행: `$EDITOR --wait /tmp/vs-review-{plan_id}.md`
   → `--wait`가 지원되면 에디터에서 탭/파일을 닫을 때까지 대기
   → 사용자에게 안내: "에디터에서 수정 후 파일을 닫으면(또는 탭을 닫으면) 자동으로 반영됩니다"

   **대기 불가능한 경우**:
   → Bash로 에디터를 실행하되 사용자에게 안내: "수정이 끝나면 알려주세요"
   → 사용자가 완료를 알려주면 다음 단계로 진행

4. **수정사항 파싱**
   - 임시 파일을 다시 읽어서 파싱하세요
   - frontmatter에서 plan_id, title을 추출
   - `## Plan Spec` 섹션에서 스펙 내용 추출
   - `### Task N: ... [task_id: xxx]` 패턴으로 각 태스크의 id, title, spec, acceptance 추출
   - 원본과 비교하여 변경된 부분만 식별하세요

5. **변경사항 확인**
   - 변경된 내용을 사용자에게 요약하여 보여주세요:
     - 플랜 스펙 변경 여부
     - 수정된 태스크 목록 (어떤 필드가 바뀌었는지)
   - 변경사항이 없으면 "수정사항 없음"을 알리고 approve 여부만 확인하세요
   - 사용자에게 반영할지 확인을 받으세요

6. **DB 반영**
   - 플랜 스펙이 변경되었으면 `vp_plan_update`로 업데이트
   - 태스크가 변경되었으면 각 태스크마다 `vp_task_edit`으로 업데이트
   - 플랜 title이 변경되었으면 `vp_plan_update`로 업데이트

7. **상태 변경**
   - `vp_plan_approve`로 플랜 상태를 approved로 변경하세요
   - 상태 변경 결과를 사용자에게 알려주세요

8. **정리**
   - 임시 파일을 삭제하세요: `rm /tmp/vs-review-{plan_id}.md`
   - `vp_context_save`로 리뷰 내용을 저장하세요
   - `/vs-next`로 작업을 시작할 수 있다고 안내하세요
