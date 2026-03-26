---
name: vs-backlog
description: Use when managing pre-planning backlog items. 플래닝 이전의 아이디어, 버그, 작업을 백로그로 관리합니다. 빠른 추가, 목록 조회, 우선순위 정리, 플랜 승격, 간단 작업 즉시 실행을 지원합니다.
invocation: user
---

# 백로그 관리

플래닝 이전 단계의 아이디어, 버그, 작업을 가볍게 기록하고 관리합니다.
`/vs-backlog` → `/vs-plan` → `/vs-next` 순서로 사용합니다.

## When to Use

**사용하세요:**
- 아이디어, 버그, 개선사항을 빠르게 기록할 때
- 백로그를 검토하고 우선순위를 정리할 때
- 백로그 항목을 플랜으로 승격할 때
- 간단한 작업을 플래닝 없이 바로 처리할 때

**사용하지 마세요:**
- 이미 스펙이 명확하고 복잡한 작업 → `/vs-plan` 직접 사용
- 이미 플랜이 있고 태스크를 실행할 때 → `/vs-next` 사용
- 단일 파일 오타 수정 등 즉시 해결 가능한 것 → 직접 수정

## Steps

1. **모드 선택**

   사용자의 의도를 파악하여 아래 5가지 모드 중 적절한 것을 선택하세요.
   명확하지 않으면 `AskUserQuestion`으로 물어보세요:

   - header: "백로그 관리"
   - question: "어떤 작업을 하시겠습니까?"
   - multiSelect: false
   - 선택지:
     - label: "빠른 추가", description: "새 아이디어/버그/작업을 백로그에 추가합니다"
     - label: "목록 조회/정리", description: "백로그를 검토하고 우선순위를 조정합니다"
     - label: "플랜 승격", description: "백로그 항목을 선택하여 vs-plan으로 플래닝합니다"
     - label: "즉시 실행", description: "간단한 항목을 플래닝 없이 바로 처리합니다"
     - label: "대량 작업", description: "여러 항목을 한번에 정리합니다 (drop, 태그, 우선순위)"

---

### Mode 1: 빠른 추가

2. **정보 추출**

   사용자의 발화에서 다음을 자동 추출하세요:
   - **제목**: 핵심 내용을 한 줄로 요약
   - **카테고리**: 발화 패턴으로 추론
     - "버그", "안 돼", "깨짐", "에러" → `bugfix`
     - "추가", "만들어", "새로운" → `feature`
     - "리팩토링", "정리", "개선" → `refactor`
     - "업데이트", "설정", "의존성" → `chore`
     - "아이디어", "나중에", "생각" → `idea`
   - **우선순위**: 긴급도 표현으로 추론
     - "급해", "지금 당장", "장애" → `critical`
     - "중요", "빨리" → `high`
     - 기본값 → `medium`
     - "나중에", "언젠가" → `low`
   - **복잡도 힌트**: 규모 표현으로 추론
     - "간단", "금방" → `simple`
     - "좀 걸릴", "여러 파일" → `moderate`
     - "큰 작업", "설계 필요" → `complex`

3. **확인 및 등록**

   추출한 정보를 요약하여 `AskUserQuestion`으로 확인받으세요:

   ```
   ## 백로그 항목 추가

   - **제목**: {추출된 제목}
   - **카테고리**: {추출된 카테고리}
   - **우선순위**: {추출된 우선순위}
   - **복잡도**: {추출된 복잡도 또는 '-'}
   ```

   - header: "백로그 추가 확인"
   - 선택지:
     - label: "등록", description: "이대로 백로그에 추가합니다"
     - label: "수정 후 등록", description: "일부 항목을 수정합니다"
     - label: "취소", description: "추가를 취소합니다"

   "등록" 선택 시 Bash 도구로 실행:
   ```bash
   vs --json backlog add --title "제목" --priority medium --category feature [--complexity simple] [--tags "tag1,tag2"] [--description "설명"] [--source "출처"]
   ```

   연속 추가 여부를 물어보세요:
   - header: "계속 추가하시겠습니까?"
   - 선택지:
     - label: "추가할 항목이 더 있습니다", description: "다음 항목을 입력합니다"
     - label: "완료", description: "백로그 추가를 마칩니다"

---

### Mode 2: 목록 조회/정리

4. **백로그 조회**

   Bash 도구로 `vs --json backlog list --status open`을 실행하여 현재 백로그를 가져오세요.

   결과를 보기 좋게 정리하여 보여주세요:

   ```
   ## 백로그 ({N}개)

   | # | 우선순위 | 카테고리 | 복잡도 | 제목 |
   |---|----------|----------|--------|------|
   | 1 | critical | bugfix   | simple | ... |
   | 2 | high     | feature  | complex| ... |
   ```

5. **정리 작업**

   `AskUserQuestion`으로 정리 옵션을 제시하세요:
   - header: "백로그 정리"
   - multiSelect: true
   - 선택지:
     - label: "우선순위 변경", description: "항목의 우선순위를 조정합니다"
     - label: "태그 추가", description: "항목에 태그를 추가합니다"
     - label: "카테고리 변경", description: "항목의 카테고리를 변경합니다"
     - label: "복잡도 설정", description: "항목의 복잡도 힌트를 설정합니다"
     - label: "완료", description: "정리를 마칩니다"

   선택된 작업에 대해 대상 항목을 물어보고 Bash 도구로 `vs --json backlog update <id> --priority high` 등을 실행하세요.

---

### Mode 3: 플랜 승격

6. **승격 대상 선택**

   Bash 도구로 `vs --json backlog list --status open`을 실행하여 목록을 가져오세요.

   `AskUserQuestion`으로 승격할 항목을 선택하게 하세요:
   - header: "플랜으로 승격할 항목 선택"
   - 각 항목을 선택지로 제시 (제목 + 우선순위 + 복잡도)

7. **vs-plan 연계**

   선택된 항목의 정보를 바탕으로 `/vs-plan`을 시작하세요:
   - 항목의 **제목**을 플랜 제목 후보로 사용
   - 항목의 **설명**을 인터뷰의 초기 컨텍스트로 제공
   - 항목의 **카테고리**와 **복잡도 힌트**를 인터뷰에 반영

   플랜이 생성되면 Bash 도구로 승격 처리:
   ```bash
   vs --json backlog promote <backlog_id> --plan <plan_id>
   ```

---

### Mode 4: 즉시 실행

8. **실행 대상 선택**

   Bash 도구로 `vs --json backlog list --status open`을 실행하여 목록을 가져오세요.
   `complexity_hint`가 `simple`인 항목 또는 사용자가 지정한 항목을 대상으로 합니다.

   `AskUserQuestion`으로 실행할 항목을 선택하게 하세요:
   - header: "즉시 실행할 항목 선택"
   - 선택지에 복잡도가 `simple`인 항목을 상단에 배치

9. **작업 수행**

   선택된 항목의 제목과 설명을 기반으로 작업을 수행하세요:
   - 코드베이스를 탐색하여 관련 파일을 찾으세요
   - 작업을 수행하세요 (코드 수정, 설정 변경 등)
   - 작업 완료 후 결과를 요약하세요

10. **완료 처리**

    작업이 완료되면 Bash 도구로 상태를 업데이트하세요:
    ```bash
    vs --json backlog update <id> --status done
    ```

    `/vs-commit`으로 커밋을 안내하세요.

---

### Mode 5: 대량 작업

11. **대량 작업 유형 선택**

    `AskUserQuestion`으로 작업 유형을 선택하게 하세요:
    - header: "대량 작업"
    - 선택지:
      - label: "일괄 Drop", description: "더 이상 필요 없는 항목들을 정리합니다"
      - label: "일괄 태그", description: "여러 항목에 같은 태그를 추가합니다"
      - label: "일괄 우선순위", description: "여러 항목의 우선순위를 한번에 변경합니다"

12. **대상 선택 및 실행**

    Bash 도구로 `vs --json backlog list --status open`을 실행하여 목록을 가져오세요.

    `AskUserQuestion` (multiSelect: true)으로 대상 항목들을 선택하게 하세요.

    선택된 각 항목에 대해 Bash 도구로 일괄 처리:
    - Drop: `vs --json backlog update <id> --status dropped`
    - 태그: `vs --json backlog update <id> --tags "기존태그,새태그"`
    - 우선순위: `vs --json backlog update <id> --priority <새우선순위>`

---

## 결과 보고

모든 모드의 작업 완료 후 현재 백로그 상태를 요약하세요:

```bash
vs --json backlog stats
```

```
## 백로그 현황
- 전체: {N}개 (open: {n}, planned: {n}, done: {n}, dropped: {n})
- 우선순위: critical {n} · high {n} · medium {n} · low {n}
```

## 다음 단계

- → `/vs-backlog`로 추가 항목 등록
- → `/vs-plan`으로 복잡한 항목 플래닝
- → `/vs-dashboard`로 전체 현황 확인
