---
name: vs-qa-findings
description: (Deprecated) vs-qa에 통합되었습니다. QA 발견 이슈를 조회하고 상태를 관리합니다.
invocation: agent
---

# QA 이슈 관리

> **Note:** 이 스킬은 `/vs-qa`에 통합되었습니다. 동일한 기능을 `/vs-qa`에서 사용할 수 있습니다.
> - CLI: `vs --json qa finding list`, `vs --json qa finding update`
> - 자세한 사용법: `/vs-qa`의 CLI Reference 참조

QA에서 발견된 이슈를 필터링, 조회, 상태 관리합니다.

## CLI Reference

- `vs --json qa finding list [--run <run_id>] [--severity <s>] [--status <s>] [--category <cat>]` — 이슈 목록
- `vs --json qa finding update <id> --status <status> [--fix-plan-id <id>]` — 이슈 상태 변경
- `vs --json qa run list [--plan <plan_id>]` — QA Run 목록

## Steps

1. **이슈 조회**
   - Bash 도구로 `vs --json qa finding list` 명령을 실행하세요 (기본: 전체 조회)
   - 이슈가 없으면 "발견된 이슈가 없습니다" 안내 후 STOP

2. **필터 선택**
   - `AskUserQuestion`으로 필터 선택:
     - question: "이슈를 어떻게 필터링할까요?"
     - header: "필터"
     - multiSelect: false
     - 선택지:
       - label: "전체 보기", description: "모든 이슈를 표시합니다"
       - label: "미해결만", description: "open 상태 이슈만 표시합니다"
       - label: "심각도별", description: "특정 심각도 이슈만 표시합니다"
       - label: "카테고리별", description: "특정 카테고리 이슈만 표시합니다"
   - 선택에 따라 적절한 필터 옵션으로 재조회

3. **이슈 목록 렌더링**
   - 다음 형식으로 렌더링:
   ```
   🐛 QA 이슈 목록 ({N}건)

   | # | ID | Severity | Category | Title | 상태 | 수정 플랜 |
   |---|----|----------|----------|-------|------|----------|
   | 1 | {id} | 🔴 critical | bug | ... | open | - |
   | 2 | {id} | 🟠 high | regression | ... | planned | QA Fix #1 |
   | 3 | {id} | 🟡 medium | inconsistency | ... | open | - |
   ```
   - severity 아이콘: 🔴 critical, 🟠 high, 🟡 medium, ⚪ low

4. **이슈 상태 관리**
   - `AskUserQuestion`으로 액션 선택:
     - question: "이슈에 대해 어떤 작업을 하시겠습니까?"
     - header: "액션"
     - 선택지:
       - label: "상태 변경", description: "선택한 이슈의 상태를 변경합니다"
       - label: "상세 보기", description: "특정 이슈의 상세 정보를 확인합니다"
       - label: "완료", description: "이슈 관리를 종료합니다"
   - 상태 변경 시:
     - 대상 이슈 선택 (번호 또는 ID)
     - 새 상태 선택: open / planned / fixed / wontfix / duplicate
     - `vs --json qa finding update <id> --status <status>` 실행

5. **결과 확인**
   - 변경 후 업데이트된 이슈 목록을 다시 표시

## 다음 단계

- → `/vs-qa-status`로 QA 전체 결과 확인
- → `/vs-qa`로 QA 재실행
- → `/vs-next`로 수정 플랜 태스크 시작
- → `/vs-dashboard`로 전체 현황 확인
