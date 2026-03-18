---
name: vs-resume
description: Use when resuming a previous session. 마지막 작업 내용을 불러오고 현재 상태를 조회한 뒤 다음 할 일을 제안합니다.
invocation: user
---

# Session Resume

새 세션을 시작할 때 이전 작업 컨텍스트를 복원합니다.

## Steps

1. **컨텍스트 복원**
   - `vp_context_resume`을 호출하여 이전 세션 로그, 대시보드, 알림을 가져오세요

2. **Stash 복원 확인**
   - `git stash list`에서 `vibespec-session` 패턴의 stash를 검색하세요
   - 현재 브랜치를 `git rev-parse --abbrev-ref HEAD`로 확인하세요
   - 매칭되는 stash가 있으면:
     - stash 메시지 형식을 판별하여 파싱하세요:
       - **새 형식** (6필드): `vibespec-session:{branch}:{worktree_path}:{plan_id}:{task_id}:{timestamp}`
       - **기존 형식** (4필드): `vibespec-session:{plan_id}:{task_id}:{timestamp}` → branch를 "unknown"으로 표시
     - 아래 테이블 형태로 사용자에게 표시하세요:
       ```
       현재 브랜치: main
       이전 세션에서 보존된 변경사항:
       | # | Stash | Branch | Plan | Task | 저장 시각 | 일치 |
       |---|-------|--------|------|------|----------|------|
       | 1 | stash@{0} | main | K7NK... | gyGr... | 20260318-091500 | ✓ |
       | 2 | stash@{3} | unknown | A1B2... | none | 20260318-085000 | ? |
       ```
       - 일치 컬럼: ✓ (현재 브랜치와 동일), ✗ (다른 브랜치), ? (unknown/기존 형식)
     - **현재 브랜치와 일치하는 stash만 기본 복원 대상으로 표시하세요**
     - `AskUserQuestion`으로 복원 여부를 확인하세요:
       - **복원** → `git stash apply stash@{N}` 실행 (pop이 아닌 apply로 안전하게)
         - 성공하면 `git stash drop stash@{N}`으로 정리
         - 충돌 시 충돌 파일을 안내하고 수동 해결을 제안
       - **건너뛰기** → stash를 유지한 채 다음 단계로
       - **삭제** → `git stash drop stash@{N}`으로 해당 stash 제거
     - **브랜치 불일치 경고**: 사용자가 ✗ 표시된 stash를 복원하려 하면 경고하세요:
       "이 stash는 '{branch}' 브랜치에서 생성되었습니다. 현재 브랜치({current})에 적용하면 다른 브랜치의 코드가 섞일 수 있습니다. 계속하시겠습니까?"
     - 여러 개면 최신 것부터 표시하고, 사용자가 개별 선택
   - 매칭되는 stash가 없으면 조용히 다음 단계로 진행하세요

3. **이전 세션 요약**
   - 최근 컨텍스트 로그를 기반으로 이전에 무엇을 했는지 요약하세요
   - 미완료 작업이나 차단된 항목을 강조하세요

4. **현재 상태 표시**
   - 활성 플랜 진행률을 보여주세요
   - 주의가 필요한 알림을 표시하세요

5. **다음 할 일 제안**
   - in_progress 태스크가 있으면 이어서 작업 제안
   - 없으면 `/vs-next`로 다음 태스크 시작 제안
   - 알림이 있으면 우선 처리 제안

6. **세션 시작 기록**
   - `vp_context_save`로 새 세션 시작을 기록하세요
   - stash 복원을 수행했다면 복원 내역도 포함하세요

## 다음 단계

- in_progress 태스크 있을 시 → 이어서 작업 진행
- → `/vs-next`로 다음 태스크 시작
- → `/vs-dashboard`로 전체 현황 파악
- stale 알림 시 → `/vs-review`로 스펙 점검
