# Merge Report 생성 가이드

## 데이터 수집 (Phase 2에서)

Phase 2 연구 단계에서 아래 정보를 수집하여 메모리에 유지하세요:

a. **changes_summary**: 파일별 변경 카테고리와 설명:
```json
[{"file": "src/models/user.ts", "category": "feat", "description": "사용자 인증 필드 추가"}]
```

b. **ai_judgments**: AI가 추론/추측한 부분:
- `inference` (기존 패턴에서 추론) — confidence: high
- `guess` (도메인 지식 필요) — confidence: low
- `pattern_based` (기계적 변환) — confidence: high
```json
[{"file": "src/api/auth.ts", "line": "45", "type": "guess", "description": "세션 만료 시간 30분 설정 — 요구사항 미명시", "confidence": "low"}]
```

c. **테스트 커버리지 갭**: 변경 소스 중 테스트 없는 파일 식별:
- `src/foo.ts` → `src/__tests__/foo.test.ts`, `tests/foo.test.ts`, `src/foo.spec.ts`

---

Phase 2~5에서 수집한 데이터를 사용하여 머지 리포트를 생성합니다.
**이 단계의 실패는 머지 결과에 영향을 주지 않습니다.** 리포트 생성이 실패하면 경고만 표시하고 다음으로 진행하세요.

## Review Checklist 생성

Phase 2에서 수집한 `ai_judgments`와 `conflict_log`를 바탕으로 review_checklist를 생성하세요:

- 🔴 `must` (반드시 확인):
  - AI 병합(`ai_merge`)으로 해결된 충돌 부분
  - `confidence: low`인 AI 판단 (추측이 포함된 코드)
  - 비즈니스 로직을 변경한 파일 중 테스트가 없는 경우
- 🟡 `should` (가능하면 확인):
  - 테스트 파일이 없는 변경된 소스 파일 (Phase 2 step 7c에서 식별)
  - `confidence: medium`인 AI 판단
  - 충돌 해결에서 `ours` 또는 `theirs`를 선택했지만 다른 쪽의 의도도 유효한 경우 — `discarded_intent`를 함께 표시하세요
- 🟢 `info` (참고):
  - `confidence: high`인 기계적 변환
  - 빌드/테스트가 통과한 항목
  - 문서나 설정 파일 변경

## 마크다운 리포트 파일 생성

`.claude/reports/` 디렉토리가 없으면 먼저 생성하세요.
`Write` 도구로 `.claude/reports/merge-{YYYY-MM-DD}-{source-branch}.md` 파일을 생성하세요:

```markdown
# Merge Report: {source-branch} → {target-branch}
> {날짜} | Commit: {commit-hash}
> Plan: {plan-id} (있을 때만)

## 변경 요약
{changes_summary를 카테고리별로 그룹화하여 불릿 리스트}

## ⚡ Review Checklist
{review_checklist를 level별로 그룹화}
### 🔴 반드시 확인
- [ ] {file}:{line} — {description}
  └ {reason}
### 🟡 가능하면 확인
- [ ] ...
### 🟢 참고
- ...

## 충돌 해결 기록
{conflict_log가 있을 때만 — 파일별 hunk 수, 선택, 근거, 버려진 코드 의도}
- 🟡 {file} — {resolution} 선택, {discarded_intent} (있을 때만)

## AI 판단 로그
{ai_judgments가 있을 때만 — confidence별로 그룹화}

## 검증 결과
- Build: {결과}
- Test: {결과} ({passed} passed, {failed} failed)
- Lint: {결과}
- Acceptance: {결과}

## 관련 태스크
{task_ids가 있을 때만}

## 메타
- Report: {report_path}
- Generated: {날짜시간}
```

## DB에 리포트 저장

Bash 도구로 아래 명령을 실행하세요:
```bash
vs merge-report create \
  --commit "{커밋 해시}" \
  --source "{소스 브랜치}" \
  --target "{타겟 브랜치}" \
  --changes '{changes_summary JSON}' \
  --checklist '{review_checklist JSON}' \
  --verification '{verification JSON}' \
  --report-path "{MD 파일 경로}" \
  --plan-id "{플랜 ID}" \
  --conflict-log '{conflict_log JSON}' \
  --ai-judgments '{ai_judgments JSON}' \
  --task-ids '{task_ids JSON}'
```
- plan-id, conflict-log, ai-judgments, task-ids는 해당 데이터가 있을 때만 포함하세요
- JSON 값에 작은따옴표가 포함되면 적절히 이스케이프하세요

## 리포트 생성 결과 표시

```
📋 머지 리포트 생성 완료
- 파일: {report_path}
- Review Checklist: 🔴{must_count} 🟡{should_count} 🟢{info_count}
- /vs-recap으로 나중에 조회할 수 있습니다
```
