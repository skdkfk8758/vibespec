---
name: vs-qa-status
description: (Deprecated) vs-qa에 통합되었습니다. QA 실행 결과 및 발견 이슈 현황을 조회합니다.
invocation: user
---

# QA 상태 조회

> **Note:** 이 스킬은 `/vs-qa`에 통합되었습니다. 동일한 기능을 `/vs-qa`에서 사용할 수 있습니다.
> - CLI: `vs --json qa run list`, `vs --json qa stats`
> - 자세한 사용법: `/vs-qa`의 CLI Reference 참조

QA Run 결과를 상세 조회하고 리스크 트렌드를 확인합니다.

## CLI Reference

- `vs --json qa run list [--plan <plan_id>]` — QA Run 목록
- `vs --json qa run show <run_id>` — QA Run 상세
- `vs --json qa scenario list <run_id> [--status <s>]` — 시나리오 목록
- `vs --json qa finding list [--run <run_id>] [--severity <s>]` — 이슈 목록
- `vs --json qa stats [--plan <plan_id>]` — QA 통계

## Steps

1. **플랜 선택**
   - Bash 도구로 `vs --json dashboard` 명령을 실행하세요
   - 활성 플랜이 여러 개면 `AskUserQuestion`으로 선택
   - 활성 플랜이 없으면 "활성 플랜이 없습니다" 안내

2. **QA Run 목록 조회**
   - Bash 도구로 `vs --json qa run list --plan <plan_id>` 명령을 실행하세요
   - Run이 없으면 "QA 실행 이력이 없습니다. `/vs-qa`로 QA를 시작하세요" 안내 후 STOP
   - 최근 Run을 자동 선택 (여러 개면 목록 표시 후 선택)

3. **QA Run 상세 렌더링**
   - Bash 도구로 `vs --json qa run show <run_id>` 명령을 실행하세요
   - 다음 형식으로 렌더링:

   ```
   🔬 QA Run #{run_id}
   ├─ 플랜: {plan_title}
   ├─ 상태: {status} | 트리거: {trigger} | 날짜: {created_at}
   ├─ 리스크: [GREEN|YELLOW|ORANGE|RED] ({risk_score})
   │
   ├─ 📊 시나리오 결과
   │  | 카테고리 | 전체 | PASS | FAIL | WARN | SKIP |
   │  |---------|------|------|------|------|------|
   │  | ... | ... | ... | ... | ... | ... |
   │
   └─ 🐛 미해결 이슈: critical: N  high: N  medium: N  low: N
   ```

4. **리스크 트렌드** (Run이 2개 이상일 때)
   - 이전 Run과 비교하여 트렌드 표시:
   ```
   📈 리스크 트렌드:
   Run #1 (03-20): 0.45 🟡 → Run #2 (03-23): 0.30 🟡 → Run #3 (03-25): 0.15 🟢 ↓개선
   ```

5. **실패 시나리오 상세** (FAIL이 있을 때)
   - `vs --json qa scenario list <run_id> --status fail`로 실패 시나리오 조회
   - 각 실패 시나리오의 evidence를 표시

6. **다음 단계 안내**
   - `/vs-qa-findings`로 이슈 관리
   - `/vs-qa`로 QA 재실행
   - `/vs-dashboard`로 전체 현황

## 다음 단계

- → `/vs-qa-findings`로 이슈 상세 관리
- → `/vs-qa`로 QA 재실행
- → `/vs-dashboard`로 전체 현황 확인
