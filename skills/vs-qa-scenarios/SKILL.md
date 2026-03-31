---
name: vs-qa-scenarios
description: (Deprecated) vs-qa에 통합되었습니다. QA 시나리오를 인터랙티브하게 조회하고 관리합니다.
invocation: agent
---

# QA 시나리오 탐색

> **Note:** 이 스킬은 `/vs-qa`에 통합되었습니다. 동일한 기능을 `/vs-qa`에서 사용할 수 있습니다.
> - CLI: `vs --json qa scenario list <run_id>`
> - 자세한 사용법: `/vs-qa`의 CLI Reference 참조

과거 QA Run의 시나리오를 카테고리별로 조회하거나, QA 실행 없이 예상 시나리오를 미리 확인합니다.

## CLI Reference

- `vs --json dashboard` — 활성 플랜 현황
- `vs --json qa run list [--plan <plan_id>]` — QA Run 목록
- `vs --json qa scenario list <run_id> [--category <cat>] [--status <s>]` — 시나리오 목록
- `vs --json qa scenario create <run_id> --title "..." --description "..." --category <cat> --priority <p>` — 시나리오 추가
- `vs plan show <plan_id> --json` — 플랜 상세 + 태스크 트리

## Steps

### 1. 플랜 선택

- Bash 도구로 `vs --json dashboard` 명령을 실행하세요
- 활성 플랜이 없으면 "활성 플랜이 없습니다" 안내 후 STOP
- 활성 플랜이 1개면 자동 선택
- 여러 개면 `AskUserQuestion`으로 선택:
  - question: "어떤 플랜의 QA 시나리오를 확인할까요?"
  - 각 플랜을 선택지로 제시 (제목 + 진행률)

### 2. 모드 선택

- `AskUserQuestion`으로 모드 선택:
  - question: "무엇을 확인하시겠습니까?"
  - header: "시나리오 모드"
  - multiSelect: false
  - 선택지:
    - label: "과거 QA 시나리오 보기", description: "이전에 실행된 QA Run의 시나리오와 결과를 확인합니다"
    - label: "시나리오 미리보기", description: "QA를 실행하지 않고 예상 시나리오를 미리 확인합니다"

### 3. 과거 QA 시나리오 보기

- Bash 도구로 `vs --json qa run list --plan <plan_id>` 명령을 실행하세요
- Run이 없으면: "QA 실행 이력이 없습니다. `/vs-qa`로 QA를 먼저 실행하세요" 안내 후 STOP
- Run이 1개면 자동 선택
- 여러 개면 `AskUserQuestion`으로 Run 선택 (최근 Run을 첫 번째로):
  - question: "어떤 QA Run의 시나리오를 볼까요?"
  - 각 Run: "Run #{id} ({날짜}) — {status}, risk: {score}"

### 4. 시나리오 렌더링

- Bash 도구로 `vs --json qa scenario list <run_id>` 명령을 실행하세요
- 카테고리별로 그룹핑하여 렌더링:

```
📋 QA 시나리오 — Run #{id} ({날짜}) | Risk: {emoji} {score}

🔧 Functional ({passed}/{total} 통과)
  1. [HIGH] ✅ {title}
     Given: {사전 조건}
     When: {실행 동작}
     Then: {기대 결과}
     📎 Evidence: {evidence 1줄 요약}

  2. [MEDIUM] ❌ {title}
     Given: ... / When: ... / Then: ...
     📎 Evidence: {실패 사유 요약}

🔗 Integration ({passed}/{total} 통과)
  3. [HIGH] ⚠️ {title}
     ...

🚶 Flow ({passed}/{total} 통과)
  ...

🔄 Regression ({passed}/{total} 통과)
  ...

⚠️ Edge Case ({passed}/{total} 통과)
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
총 {total}개 | ✅ {pass} | ❌ {fail} | ⚠️ {warn} | ⏭️ {skip}
```

- 판정 아이콘: ✅ pass, ❌ fail, ⚠️ warn, ⏭️ skip, ⏳ pending
- description에서 Given-When-Then을 추출하여 표시
- evidence가 있으면 1줄 요약으로 표시

### 5. 인터랙티브 액션

- `AskUserQuestion`으로 액션 선택:
  - question: "다음으로 무엇을 하시겠습니까?"
  - header: "액션"
  - multiSelect: false
  - 선택지:
    - label: "상세 보기", description: "특정 시나리오의 전체 evidence를 확인합니다"
    - label: "시나리오 추가", description: "이 Run에 수동 시나리오를 추가합니다 (pending/running Run만)"
    - label: "다른 Run 보기", description: "다른 QA Run의 시나리오를 확인합니다"
    - label: "완료", description: "시나리오 탐색을 종료합니다"

- **"상세 보기"**: 번호를 물어본 뒤 해당 시나리오의 evidence 전문을 표시. 다시 Step 5로.
- **"시나리오 추가"**: Run이 pending 또는 running 상태일 때만 가능. 카테고리/제목/설명/priority를 입력받아 `vs --json qa scenario create` 실행. 재렌더링 후 Step 5로.
- **"다른 Run 보기"**: Step 3으로 돌아감.
- **"완료"**: 종료.

### 6. 시나리오 미리보기 (QA 미실행)

QA를 실행하지 않고 예상 시나리오를 확인합니다. **DB에 저장하지 않습니다.**

1. `vs plan show <plan_id> --json`으로 done 태스크 목록을 조회하세요
2. done 태스크가 없으면: "완료된 태스크가 없어 미리보기를 생성할 수 없습니다" 안내 후 STOP
3. 각 done 태스크의 spec과 acceptance criteria를 분석하여 예상 시나리오를 생성하세요:
   - **Functional**: 각 AC를 시나리오로 변환
   - **Integration**: depends_on 관계에서 교차 검증 포인트 추출
   - **Flow**: 플랜 스펙에서 사용자 시나리오 추출
   - **Regression**: 변경된 파일(allowed_files)의 영향 범위
   - **Edge Case**: 스펙의 엣지 케이스 + 일반적인 엣지 케이스 추론
4. Step 4와 동일한 형식으로 렌더링 (단, 판정 아이콘 대신 `📝` 표시)
5. 안내 메시지 표시:
   ```
   ℹ️ 이것은 미리보기입니다. 실제 QA 실행 시 coordinator가 프로젝트 구조를
   분석하여 더 정밀한 시나리오를 생성합니다. /vs-qa로 QA를 시작하세요.
   ```
6. `AskUserQuestion`: "QA 실행" (→ `/vs-qa` 안내) / "완료" (→ 종료)

## 다음 단계

- → `/vs-qa`로 QA 실행
- → `/vs-qa-status`로 QA 결과 상세 확인
- → `/vs-qa-findings`로 이슈 관리
- → `/vs-dashboard`로 전체 현황 확인
