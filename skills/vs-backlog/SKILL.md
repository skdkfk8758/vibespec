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

   사용자의 의도를 파악하여 아래 6가지 모드 중 적절한 것을 선택하세요.
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
     - label: "임포트", description: "GitHub Issues, Slack, 텍스트 파일에서 백로그를 가져옵니다"

---

### Mode 1: 빠른 추가

2. **정보 추출**

   사용자의 발화에서 다음을 자동 추출하세요:
   - **제목**: 핵심 내용을 한 줄로 요약
   - **카테고리**: 발화 패턴으로 추론

     | 패턴 키워드 | 카테고리 |
     |-------------|----------|
     | "버그", "안 돼", "깨짐", "에러", "오류", "크래시", "실패", "안됨" | `bugfix` |
     | "추가", "만들어", "새로운", "구현", "개발", "기능", "넣어" | `feature` |
     | "리팩토링", "정리", "개선", "리팩터", "클린업", "단순화", "분리" | `refactor` |
     | "업데이트", "설정", "의존성", "버전", "마이그레이션", "CI", "배포" | `chore` |
     | "아이디어", "나중에", "생각", "검토", "고민", "해볼까", "어떨까" | `idea` |

   - **우선순위**: 긴급도 표현으로 추론

     | 패턴 키워드 | 우선순위 |
     |-------------|----------|
     | "급해", "지금 당장", "장애", "긴급", "프로덕션", "핫픽스", "블로커" | `critical` |
     | "중요", "빨리", "우선", "먼저", "곧", "이번주" | `high` |
     | (기본값 — 특별한 긴급도 표현 없을 때) | `medium` |
     | "나중에", "언젠가", "시간될때", "여유있을때", "백로그", "낮은" | `low` |

   - **복잡도 힌트**: 규모 표현으로 추론

     | 패턴 키워드 | 복잡도 |
     |-------------|--------|
     | "간단", "금방", "한줄", "바로", "쉬운", "작은" | `simple` |
     | "좀 걸릴", "여러 파일", "며칠", "중간", "보통" | `moderate` |
     | "큰 작업", "설계 필요", "아키텍처", "대규모", "복잡", "리서치" | `complex` |

3. **중복 감지**

   등록 전에 기존 백로그와의 중복을 확인하세요:

   a. 제목에서 **scope 키워드**를 추출하세요 (예: "vs-plan", "vs-qa", "guardrail", "config" 등)
   b. Bash 도구로 같은 scope의 기존 항목을 조회하세요:
      ```bash
      vs --json backlog list --status open,planned,done,dropped
      ```
      - 결과에서 scope 키워드가 제목/태그에 포함된 항목만 필터링
      - 전체 목록이 아닌 **매칭된 항목만** 사용자에게 표시 (토큰 절감)
   c. 매칭 결과에 따라 분기하세요:

      | 매칭 상태 | 표시 | 행동 |
      |-----------|------|------|
      | open/planned에 유사 항목 있음 | "관련 항목 {N}개:" + 제목 목록 | 확인 선택지에 "기존 항목에 통합" 추가 |
      | done에 유사 항목 있음 | "이미 완료된 관련 항목: {제목}" | 정보 제공만, 등록은 허용 |
      | dropped에 유사 항목 있음 | "이전에 제외된 항목: {제목} (사유: ...)" | 맥락 제공, 등록은 허용 |
      | 매칭 없음 | 표시 없음 | 바로 확인 단계 진행 |

   d. **통합 선택 시**: description 병합 대신 새 항목의 내용을 기존 항목의 description에 `\n\n---\n추가 컨텍스트: {새 내용}` 형태로 append하고, 새 항목은 등록하지 않음

4. **확인 및 등록**

   추출한 정보와 중복 감지 결과를 함께 요약하여 `AskUserQuestion`으로 확인받으세요:

   ```
   ## 백로그 항목 추가

   - **제목**: {추출된 제목}
   - **카테고리**: {추출된 카테고리}
   - **우선순위**: {추출된 우선순위}
   - **복잡도**: {추출된 복잡도 또는 '-'}
   {관련 항목이 있으면}
   - **관련 항목**: {제목1}, {제목2}
   ```

   - header: "백로그 추가 확인"
   - 선택지 (관련 항목이 있을 때):
     - label: "등록", description: "별개 항목으로 백로그에 추가합니다"
     - label: "기존 항목에 통합", description: "가장 유사한 기존 항목에 컨텍스트를 추가합니다"
     - label: "수정 후 등록", description: "일부 항목을 수정합니다"
     - label: "취소", description: "추가를 취소합니다"
   - 선택지 (관련 항목이 없을 때):
     - label: "등록", description: "이대로 백로그에 추가합니다"
     - label: "수정 후 등록", description: "일부 항목을 수정합니다"
     - label: "취소", description: "추가를 취소합니다"

   "등록" 선택 시 Bash 도구로 실행:
   ```bash
   vs --json backlog add --title "제목" --priority medium --category feature [--complexity simple] [--tags "tag1,tag2"] [--description "설명"] [--source "출처"]
   ```

   "기존 항목에 통합" 선택 시:
   - 통합 대상이 2개 이상이면 `AskUserQuestion`으로 대상 선택
   - Bash 도구로 기존 항목의 description을 업데이트:
     ```bash
     vs --json backlog update <id> --description "기존 설명\n\n---\n추가 컨텍스트: {새 내용}"
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

   **클러스터 그룹화** (기본 표시 방식):

   조회된 항목들을 **함께 플래닝/처리할 수 있는 단위**로 클러스터링하세요:

   a. 그룹화 기준 (우선순위 순):
      1. **같은 scope** — 제목/태그에서 공통 모듈 키워드 (예: "vs-plan", "vs-qa", "guardrail")
      2. **같은 목적** — 제목/설명에서 공통 의도 (예: "context 절감", "UX 개선", "질문 축소")
      3. **의존 관계** — 한 항목이 다른 항목의 선행 조건

   b. 그룹화되지 않는 항목은 "독립 항목"으로 하단에 별도 표시

   c. 출력 형식:
      ```
      ## 백로그 ({N}개, {G}개 그룹)

      ### 그룹 1: vs-plan UX 개선 (4개, 번들 승격 가능)
      | # | 우선순위 | 복잡도 | 제목 |
      |---|----------|--------|------|
      | 1 | high     | moderate | vs-plan 인터뷰 질문 자동추론 |
      | 2 | high     | moderate | vs-plan 체크포인트 통합 |
      | 3 | medium   | moderate | vs-plan 조건부 질문 자동결정 |
      | 4 | medium   | simple   | vs-plan 비판적 검토 루프 간소화 |

      ### 그룹 2: Context 토큰 최적화 (3개, 번들 승격 가능)
      | # | 우선순위 | 복잡도 | 제목 |
      |---|----------|--------|------|
      | 5 | high     | simple   | Guardrail skills 통합 |
      | 6 | high     | moderate | QA skills 통합 |
      | 7 | high     | moderate | Reference skills 내부화 |

      ### 독립 항목
      | # | 우선순위 | 카테고리 | 복잡도 | 제목 |
      |---|----------|----------|--------|------|
      | 8 | medium   | chore    | moderate | CI/CD 파이프라인 구축 |
      ```

   d. 각 그룹에 **번들 승격 가능** 라벨을 표시:
      - 그룹 내 항목이 2개 이상이고 하나의 플랜으로 묶을 수 있으면 표시
      - 그룹 내 복잡도 합산이 complex를 초과하면 "분할 승격 권장"으로 변경

   **우선순위 자동 정렬 제안:**
   조회 결과를 분석하여 다음 조건에 해당하는 항목이 있으면 승격을 제안하세요:
   - `medium` 우선순위이고 생성 후 7일 이상 경과 → `high` 승격 제안
   - `low` 우선순위이고 생성 후 14일 이상 경과 → `medium` 승격 제안
   - `high` 우선순위이고 생성 후 14일 이상 경과 → `critical` 승격 제안

   승격 대상이 있으면:
   ```
   우선순위 승격 제안:
   - "{제목}" (medium → high): 7일 이상 미처리
   - "{제목}" (low → medium): 14일 이상 미처리
   ```
   `AskUserQuestion`으로 "승격 적용" / "무시" 선택을 받으세요.

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

7. **효과성 판단**

   승격 전에 선택된 항목의 ROI를 평가하세요:

   a. 코드베이스를 탐색하여 **영향 범위**를 파악:
      - 관련 파일/모듈이 몇 개인지
      - 해당 코드가 얼마나 자주 실행되는 경로인지 (skill, agent, core engine 등)
   b. 같은 scope의 다른 open 백로그 항목을 조회하여 **번들 승격 후보**를 탐색:
      ```bash
      vs --json backlog list --status open
      ```
      - 같은 태그/scope의 항목이 2개 이상이면 묶어서 승격 제안
   c. 평가 결과를 인라인으로 표시:

      ```
      ## 승격 평가: {제목}
      - 영향 범위: {높음/중간/낮음} — {근거 1줄}
      - 복잡도 대비 가치: {높음/중간/낮음} — {근거 1줄}
      - 번들 후보: {있으면 항목 나열, 없으면 "없음"}
      ```

   d. `AskUserQuestion`으로 승격 방식을 확인:
      - header: "승격 방식"
      - 선택지 (번들 후보가 있을 때):
        - label: "단독 승격", description: "이 항목만 플랜으로 승격합니다"
        - label: "번들 승격", description: "관련 항목 {N}개를 묶어서 하나의 플랜으로 승격합니다"
        - label: "취소", description: "승격을 취소합니다"
      - 선택지 (번들 후보가 없을 때):
        - label: "승격", description: "플랜으로 승격합니다"
        - label: "취소", description: "승격을 취소합니다"

8. **vs-plan 연계**

   선택된 항목(번들 시 모든 항목)의 정보를 바탕으로 `/vs-plan`을 시작하세요:
   - 항목의 **제목**을 플랜 제목 후보로 사용 (번들 시 공통 scope로 통합 제목 생성)
   - 항목의 **설명**을 인터뷰의 초기 컨텍스트로 제공
   - 항목의 **카테고리**와 **복잡도 힌트**를 인터뷰에 반영
   - 효과성 판단의 **영향 범위 분석 결과**를 인터뷰에 포함

   플랜이 생성되면 Bash 도구로 승격 처리 (각 항목별):
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

### Mode 6: 임포트

13. **소스 선택**

    `AskUserQuestion`으로 임포트 소스를 선택하게 하세요:
    - header: "임포트 소스"
    - 선택지:
      - label: "GitHub Issues", description: "GitHub 리포지토리의 Issue를 가져옵니다"
      - label: "텍스트 파일", description: "마크다운 체크리스트(- [ ])를 파싱합니다"
      - label: "Slack 메시지", description: "Slack 채널의 메시지를 수집합니다 (MCP 필요)"

14. **파라미터 입력 및 미리보기**

    **GitHub Issues:**
    - `AskUserQuestion`으로 리포지토리(owner/repo)와 선택적 라벨 필터를 입력받으세요
    - Bash 도구로 `vs --json backlog import github --repo <repo> [--label <label>] --dry-run`을 실행하세요
    - 미리보기 결과를 보여주세요

    **텍스트 파일:**
    - `AskUserQuestion`으로 파일 경로를 입력받으세요
    - Bash 도구로 `vs --json backlog import file --path <filepath> --dry-run`을 실행하세요
    - 미리보기 결과를 보여주세요

    **Slack 메시지:**
    - `AskUserQuestion`으로 채널 ID와 조회 기간(일)을 입력받으세요
    - Slack MCP 도구 `slack_get_channel_history`를 실행하세요:
      - channel_id: 입력받은 채널 ID
      - limit: 50 (최대)
    - 반환된 메시지에서 백로그 항목을 추출하세요:
      - 메시지 text를 제목으로 사용
      - thread reply는 건너뛰세요 (thread_ts가 있는 메시지)
      - bot 메시지는 건너뛰세요
      - source를 `slack:{channel_id}`로 설정
    - 추출된 항목 목록을 미리보기로 보여주세요

15. **선택적 등록**

    미리보기 결과를 보여준 후 `AskUserQuestion`으로 등록 옵션을 제시하세요:
    - header: "임포트 확인 ({N}개 항목)"
    - multiSelect: false
    - 선택지:
      - label: "전체 등록", description: "모든 항목을 백로그에 추가합니다"
      - label: "선택 등록", description: "항목을 선택하여 일부만 등록합니다"
      - label: "취소", description: "임포트를 취소합니다"

    "전체 등록" 선택 시:
    - GitHub/파일: Bash 도구로 `vs --json backlog import github --repo <repo>` (--dry-run 없이) 실행
    - Slack: 추출된 각 항목에 대해 `vs --json backlog add --title "..." --source "slack:..."` 실행

    "선택 등록" 선택 시:
    - `AskUserQuestion` (multiSelect: true)으로 등록할 항목을 선택하게 하세요
    - 선택된 항목만 `vs --json backlog add` 명령으로 등록

    중복 항목이 있으면 경고를 표시하세요:
    ```
    ⚠ 중복 건너뜀: "{제목}" (기존 항목: {id})
    ```

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
