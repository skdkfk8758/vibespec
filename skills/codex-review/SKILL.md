---
name: codex-review
description: Use when performing cross-model code review with Codex CLI. 구현 완료 후 codex review를 실행하여 코드 품질, 버그, 설계 관점의 독립적 리뷰를 제공합니다.
invocation: user
---

# Codex CLI 크로스 리뷰

Codex CLI의 `codex review` 명령을 활용하여 크로스 모델 코드 리뷰를 수행합니다. 구현자(Claude)와 리뷰어(Codex)가 다른 모델이므로 독립적 검증을 제공합니다.

## When to Use

**사용하세요:**
- `vs-next` / `vs-pick`의 완료 처리 단계에서 `verifier` 에이전트 완료 후 순차 실행
- 수동으로 코드 리뷰가 필요할 때

**사용하지 마세요:**
- 문서, 설정 파일만 변경한 경우
- 중간 저장(WIP) 시점

## Input

호출 시 다음 정보가 컨텍스트에 존재해야 합니다:
- **task**: 태스크 제목, spec, acceptance criteria (`vs --json task show <task_id>`로 조회)
- **impl_report**: tdd-implementer 리포트 (있는 경우, 없으면 생략)

## Steps

1. **사전 조건 확인**

   **a. Codex CLI 설치 확인:**
   - `which codex` 명령을 실행하세요
   - 실패(exit code ≠ 0)하면 → **SKIP** 처리
     ```
     ### Verdict: SKIP
     Codex CLI가 설치되어 있지 않습니다. `npm install -g @openai/codex` 로 설치하세요.
     ```
   - 성공하면 다음 단계로 진행하세요

   **b. 변경사항 존재 확인:**
   - `git diff --stat` 명령을 실행하세요
   - 출력이 비어있으면 → **SKIP** 처리
     ```
     ### Verdict: SKIP
     리뷰할 변경사항이 없습니다.
     ```
   - 변경사항이 있으면 다음 단계로 진행하세요

   **c. 리뷰 범위 판단:**
   - `git worktree list`로 워크트리 환경인지 확인하세요
   - 워크트리 환경이면 → `--base` 모드 사용 (브랜치 전체 변경사항 리뷰)
   - 워크트리가 아니면 → `--uncommitted` 모드 사용 (미커밋 변경사항 리뷰)

2. **리뷰 프롬프트 구성**
   태스크 컨텍스트를 포함한 커스텀 프롬프트를 구성하세요:

   ```
   다음 태스크의 구현을 리뷰해주세요.

   ## 태스크: {task.title}

   ## Spec
   {task.spec}

   ## Acceptance Criteria
   {task.acceptance}

   ## 리뷰 관점
   1. 버그 및 논리 오류
   2. 보안 취약점 (OWASP Top 10)
   3. 성능 문제
   4. 코드 품질 및 가독성
   5. acceptance criteria 충족 여부
   ```

3. **Codex CLI 실행**

   프롬프트가 길 수 있으므로 stdin(`-`)을 사용하여 전달하세요:

   **워크트리 환경 (`--base` 모드):**
   ```bash
   codex review --base main --title "{task.title}" - <<'EOF'
   {위에서 구성한 프롬프트}
   EOF
   ```

   **일반 환경 (`--uncommitted` 모드):**
   ```bash
   codex review --uncommitted --title "{task.title}" - <<'EOF'
   {위에서 구성한 프롬프트}
   EOF
   ```

   - **타임아웃: 300초 (5분)**로 설정하세요
   - 타임아웃 초과 시 → **SKIP** 처리
     ```
     ### Verdict: SKIP
     Codex CLI 실행이 타임아웃(5분)되었습니다.
     ```
   - 인증 실패 또는 기타 에러 시 → **SKIP** 처리
     ```
     ### Verdict: SKIP
     Codex CLI 실행 실패: {에러 메시지}
     ```
   - 성공하면 출력을 저장하고 다음 단계로 진행하세요

4. **결과 분석 및 판정**
   Codex CLI 출력 **전체를 의미적으로 분석**하여 판정하세요. 단순 키워드 매칭이 아닌, 문맥을 고려한 판단이 필요합니다.

   판정 기준:
   ```
   PASS = 심각한 이슈 없음 (버그, 보안 취약점, 설계 결함 없음)
   WARN = 개선 권고사항 존재 (코드 스타일, 성능 최적화 제안 등)
   FAIL = 심각한 이슈 발견 (버그, 보안 취약점, 설계 결함, acceptance criteria 미충족)
   ```

   분석 시 주의사항:
   - "no bugs found", "error handling is correct" 같은 **부정 문맥**은 이슈가 아닙니다 — 단어가 아닌 의미를 판단하세요
   - Codex가 발견한 각 항목의 **심각도와 실제 영향**을 평가하세요
   - 스타일 제안과 실제 버그를 구분하세요
   - 판정이 애매한 경우 → **WARN** (보수적으로 판정)

5. **리포트 출력**
   반드시 다음 형식으로 출력하세요:

   ```
   ## Codex 리뷰 리포트

   ### Verdict: [PASS | WARN | FAIL | SKIP]

   ### 리뷰 요약
   [Codex CLI 원본 출력을 요약]

   ### 주요 발견사항
   | # | 카테고리 | 심각도 | 내용 |
   |---|----------|--------|------|
   | 1 | {버그/보안/성능/품질} | {높음/중간/낮음} | {구체적 내용} |

   ### 판정 근거
   - [왜 이 판정을 내렸는지 설명]
   ```

   SKIP인 경우 리뷰 요약과 주요 발견사항 섹션은 생략하세요.

## Rules

- Codex CLI 실행 실패 시 절대 워크플로우를 차단하지 마세요 — 항상 SKIP으로 graceful 처리
- 리뷰 결과는 참고용이며, 최종 판단은 사용자에게 위임하세요
- 이 스킬은 태스크 상태를 직접 변경하지 않습니다 — 판정 결과를 호출자(vs-next/vs-pick)에게 반환하세요
- 타임아웃은 반드시 300초(5분)를 사용하세요
