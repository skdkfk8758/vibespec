---
name: vs-qa
description: QA 에이전트 팀을 실행합니다. 프로젝트 구조 분석 → 시나리오 생성 → 검증 → 이슈 수집 → 수정 플래닝까지 수행합니다.
invocation: user
---

# QA 에이전트 팀 실행

프로젝트의 플랜을 대상으로 QA 에이전트 팀을 실행합니다.
qa-coordinator가 시나리오를 생성하고, qa-func-tester/qa-flow-tester가 병렬 검증하며,
qa-reporter가 이슈를 정리하고 수정 플랜을 생성합니다.

## CLI Reference

- `vs --json qa run create <plan_id> [--trigger <type>]` — QA Run 생성
- `vs --json qa run list [--plan <plan_id>]` — QA Run 목록
- `vs --json qa run show <run_id>` — QA Run 상세
- `vs --json qa scenario list <run_id>` — 시나리오 목록
- `vs --json qa finding list [--run <run_id>]` — 이슈 목록
- `vs --json qa stats [--plan <plan_id>]` — QA 통계
- `vs plan show <plan_id> --json` — 플랜 상세 + 태스크 트리

## Steps

1. **활성 플랜 확인**
   - Bash 도구로 `vs --json dashboard` 명령을 실행하세요
   - 활성 플랜이 없으면 "활성 플랜이 없습니다. `/vs-plan`으로 플랜을 먼저 생성하세요" 안내
   - 활성 플랜이 1개면 자동 선택
   - 여러 개면 `AskUserQuestion`으로 대상 플랜 선택:
     - question: "어떤 플랜의 QA를 실행할까요?"
     - 각 플랜을 선택지로 제시 (제목 + 진행률)

2. **사전 검증**
   - `vs plan show <plan_id> --json`으로 태스크 조회
   - done 태스크가 0개이면: "완료된 태스크가 없어 QA를 실행할 수 없습니다" 경고 후 STOP
   - `vs --json qa run list --plan <plan_id>`로 기존 Run 확인
   - running 상태의 Run이 있으면:
     ```
     이미 진행 중인 QA Run이 있습니다 (ID: {run_id}).
     ```
     - `AskUserQuestion`으로 "대기" / "취소 후 새로 실행" 선택

3. **QA 모드 선택**
   - `AskUserQuestion`으로 모드 선택:
     - question: "QA 모드를 선택하세요"
     - header: "QA 모드"
     - 선택지:
       - label: "전체 (Full)", description: "플랜의 모든 완료 태스크를 대상으로 QA 수행"
       - label: "증분 (Incremental)", description: "마지막 QA 이후 변경분만 재검증"
       - label: "타겟 (Targeted)", description: "특정 태스크만 대상으로 QA 수행"
   - targeted 선택 시 추가 질문: 대상 태스크 선택

4. **QA 깊이 선택**
   - `AskUserQuestion`으로 깊이 선택:
     - question: "QA 깊이를 선택하세요"
     - header: "QA 깊이"
     - 선택지:
       - label: "Quick", description: "핵심 시나리오만 (critical/high) — 빠른 검증"
       - label: "Standard (권장)", description: "표준 시나리오 (medium까지) — 균형 잡힌 검증"
       - label: "Thorough", description: "심층 시나리오 (low까지) — 완전한 검증"

5. **QA Run 생성**
   - Bash 도구로 `vs --json qa run create <plan_id>` 명령을 실행하세요
   - 생성된 run_id를 기록하세요

6. **qa-coordinator 에이전트 디스패치**
   - Agent 도구를 사용하여 qa-coordinator 에이전트를 디스패치하세요:
     - `subagent_type`: 없음 (일반 에이전트)
     - `run_in_background`: false
     - 전달 정보:
       ```
       당신은 qa-coordinator 에이전트입니다.
       다음 정보로 QA를 실행하세요:

       - plan_id: {plan_id}
       - run_id: {run_id}
       - mode: {full|incremental|targeted}
       - depth: {quick|standard|thorough}
       - target_tasks: {targeted 모드 시 태스크 ID 목록}

       agents/qa-coordinator.md의 Execution Process를 따라 실행하세요.
       ```
   - coordinator가 내부적으로 qa-func-tester, qa-flow-tester, qa-reporter를 디스패치합니다

7. **결과 대기 & 리포트 표시**
   - coordinator의 최종 리포트를 사용자에게 표시하세요
   - `vs --json qa run show <run_id>`로 최종 상태를 확인하세요

8. **후속 조치 안내**
   - `AskUserQuestion`으로 다음 단계 선택:
     - question: "다음으로 무엇을 하시겠습니까?"
     - header: "다음 단계"
     - 조건부 선택지:
       - (수정 플랜 생성됨) "수정 플랜 실행" → `/vs-next`로 QA Fix 플랜의 태스크 시작
       - (이슈 있음) "이슈 상세 확인" → `/vs-qa-findings`
       - "대시보드 확인" → `/vs-dashboard`
       - "QA 재실행" → `/vs-qa` (다른 모드/깊이로)

## 다음 단계

- → `/vs-qa-status`로 QA 결과 상세 조회
- → `/vs-qa-findings`로 이슈 관리
- → `/vs-dashboard`로 전체 현황 확인
- → `/vs-next`로 수정 플랜 태스크 시작
