---
name: vs-review
description: Use when reviewing and editing specs. 플랜의 스펙과 태스크를 인터랙티브하게 선택하여 외부 에디터에서 확인/수정하고, DB에 반영합니다.
invocation: user
---

# Spec Review & Edit

플랜의 스펙과 태스크를 인터랙티브하게 선택하여 외부 에디터에서 확인/수정합니다.

## Performance Notes

- 전체 태스크를 개별 조회하지 마세요. `vs plan show {plan_id}` CLI 명령 하나로 트리 구조를 가져오세요.
- 사용자가 선택한 항목만 `vs task show {task_id}`로 상세 조회하세요.
- 선택된 항목만 마크다운 파일로 생성하여 에디터에서 열어주세요.

## CLI Reference

VibeSpec CLI 경로: 환경에 `vp` 명령이 없으면 아래 경로를 사용하세요.
```
node <vibespec-plugin-cache-path>/dist/cli/index.js
```

주요 명령:
- `vs plan list` — 플랜 목록
- `vs plan show <plan_id>` — 플랜 상세 + 태스크 트리 (한 번의 호출로 전체 구조 확인)
- `vs task show <task_id>` — 개별 태스크 상세 (spec, acceptance 포함)
- `vs task create --plan <id> --title <t> --spec <s> --acceptance <a>` — 태스크 생성
- `vs task update <task_id> <status>` — 태스크 상태 변경

## Steps

1. **플랜 선택**
   - 인자로 plan_id가 주어지면 해당 플랜을 사용하세요
   - 없으면 `vs plan list`로 active 상태인 플랜 목록을 가져와서 선택하게 하세요
   - 플랜이 없으면 `/vs-plan`으로 먼저 플랜을 만들도록 안내하세요

2. **플랜 트리 조회 (단일 호출)**
   - `vs plan show {plan_id}` 한 번만 호출하여 전체 태스크 트리를 가져오세요
   - 개별 태스크를 하나씩 조회하지 마세요 — 이 단계에서는 트리 구조만 파악하면 됩니다

3. **인터랙티브 리뷰 대상 선택**
   - AskUserQuestion으로 사용자에게 리뷰 대상을 물어보세요:

   질문: "리뷰할 대상을 선택하세요"
   옵션:
   - "플랜 스펙 수정" — 플랜 title과 spec만 에디터로 열기
   - "태스크 선택 수정" — 태스크 목록을 보여주고 특정 태스크를 선택하여 에디터로 열기
   - "전체 리뷰" — 플랜 스펙 + 모든 태스크를 에디터로 열기 (태스크가 많으면 느릴 수 있음을 안내)

4. **선택에 따른 상세 조회 및 파일 생성**

   **A) 플랜 스펙 수정 선택 시:**
   - 플랜의 title과 spec만 포함하는 짧은 마크다운 파일 생성
   - 파일 경로: 프로젝트 내부 `.moai/tmp/vs-review-{plan_id}.md` (디렉토리 없으면 생성)
   - 형식:
     ```markdown
     ---
     plan_id: {plan_id}
     title: {plan_title}
     ---

     ## Plan Spec

     {plan.spec 내용}
     ```

   **B) 태스크 선택 수정 시:**
   - AskUserQuestion(multiSelect=true)으로 태스크 목록을 보여주세요
   - 선택된 태스크만 `vs task show {task_id}`로 상세 조회하세요
   - 선택된 태스크만 포함하는 마크다운 파일 생성
   - 형식:
     ```markdown
     ---
     plan_id: {plan_id}
     title: {plan_title}
     ---

     ## Tasks

     ### {task.title} [task_id: {task.id}]
     **Spec:**
     {task.spec}

     **Acceptance:**
     {task.acceptance}
     ```
   - 서브태스크가 있으면 부모 태스크 아래에 `####` 수준으로 들여쓰기하세요

   **C) 전체 리뷰 선택 시:**
   - 모든 태스크를 `vs task show`로 조회 (이때만 전체 조회)
   - 플랜 스펙 + 모든 태스크 포함 마크다운 파일 생성

   공통: task_id는 `[task_id: xxx]` 형식으로 반드시 포함하세요 (파싱에 필요)

5. **에디터 열기**
   - `$EDITOR` 환경변수를 확인하세요 (없으면 `vi` 사용)

   **터미널 에디터** (`vim`, `nvim`, `vi`, `nano`, `emacs -nw`):
   → Bash로 블로킹 실행

   **GUI 에디터** (`cursor`, `code`, `subl`, `zed` 등):
   → `$EDITOR`에 이미 `--wait`가 포함되어 있으면 그대로 사용
   → 없으면 `--wait` 플래그를 추가하여 블로킹 실행
   → 사용자에게 안내: "에디터에서 수정 후 파일/탭을 닫으면 자동으로 반영됩니다"
   → timeout은 600000ms(10분)로 설정하세요

6. **수정사항 파싱**
   - 임시 파일을 다시 읽어서 파싱하세요
   - 원본과 비교하여 변경된 부분만 식별하세요
   - 플랜 스펙: title, spec 비교
   - 태스크: title, spec, acceptance 비교

7. **변경사항 확인 및 DB 반영**
   - 변경된 내용을 사용자에게 요약하여 보여주세요
   - 변경사항이 없으면 "수정사항 없음"을 알려주세요
   - 변경사항이 있으면 사용자에게 반영할지 확인을 받으세요
   - DB 반영: CLI에 update 명령이 없으면 sqlite3로 직접 업데이트하세요
     - vibespec.db 경로: 프로젝트 루트의 `vibespec.db`
     - 플랜: `UPDATE plans SET title=?, spec=? WHERE id=?`
     - 태스크: `UPDATE tasks SET title=?, spec=?, acceptance=? WHERE id=?`

8. **정리**
   - 임시 파일을 삭제하세요
   - `/vs-next`로 작업을 시작할 수 있다고 안내하세요
