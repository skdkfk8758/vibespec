# QA Skills & Agents Matrix

VibeSpec의 QA 관련 스킬·에이전트 5종의 역할·트리거·판정 기준을 한눈에 비교하기 위한 레퍼런스. 비슷한 이름·유사한 역할로 인한 혼동을 방지하고, 각 도구를 언제 써야 할지 명확히 판별할 수 있게 한다.

## 핵심 매트릭스

| # | 이름 | 종류 | 트리거 | 입력 | 관점 | 판정 | 자동 vs 수동 |
|---|------|------|--------|------|------|------|-------------|
| 1 | **verification** | Skill | 태스크 완료 시점 (vs-pick, vs-exec --inline) | 태스크 AC + 테스트/빌드/lint | 기능 요구사항 충족, 기술 검증 | PASS/WARN/FAIL | **자동** (인라인) |
| 2 | **verifier** | Agent | 태스크 완료 시점 (vs-next, vs-exec 기본) | 태스크 AC + impl_report + scope | 기능 요구사항 + 코드 품질 + Self-Challenge | PASS/WARN/FAIL | **자동** (서브에이전트) |
| 3 | **qa-shadow** | Agent | 태스크 완료 시 verifier와 **병렬** | 변경 파일 + seed 시나리오 | 경량 코드 분석(에러처리/입력검증/타입안전성) | CLEAN/WARNING/ALERT | **자동** (조건부) |
| 4 | **vs-code-review** | Skill | 사용자가 커밋/PR 직전 호출 | git diff (base 브랜치 대비) | 10개 프로덕션 버그 패턴 (race condition, trust boundary 등) | severity별 findings | **수동** |
| 5 | **simplify-loop** | Skill | 사용자가 수동 호출 | 전체 변경 코드 | 재사용·품질·효율성, 반복 개선 | 개선점 목록 (0까지 반복) | **수동** |

## 역할 경계 및 중복 영역

### 1. verification ↔ verifier (기능 중복 있음)

**공통**: 둘 다 태스크 완료 시점의 **같은 검증 로직**(기술 검증 + AC 크로스체크)을 공유. verification 스킬이 기본 정의, verifier는 그것을 감싸는 에이전트.

**차이점**:
| 항목 | verification (스킬) | verifier (에이전트) |
|------|-------------------|-------------------|
| 실행 방식 | 현재 세션 인라인 | 독립 서브에이전트 |
| 컨텍스트 | 구현 맥락 누적 (편향 가능) | Fresh, 편향 없음 |
| 추가 Phase | 없음 | 코드 품질(Phase 3) + Self-Challenge(Phase 3.5) |
| 호출자 | vs-pick, vs-exec --inline | vs-next, vs-exec (기본 모드) |
| 적합 상황 | 빠른 검증, 소규모 변경 | 높은 품질 요구, 복잡한 태스크 |

**언제 어느 쪽?**
- 복잡한 기능 구현 → **verifier** (품질 검사 + 자가 반박)
- 설정·문서·사소한 변경 → **verification** (속도 우선)

### 2. verifier ↔ qa-shadow (병렬, 관점 다름)

둘 다 태스크 완료 시 **자동** 디스패치되지만 관점이 다름:

| | verifier | qa-shadow |
|--|----------|-----------|
| 목적 | AC 충족 검증 (게이트) | 잠재 이슈 탐지 (동반자) |
| 모델 | sonnet | haiku (경량) |
| 차단력 | FAIL 시 완료 차단 | ALERT이어도 차단 없음 |
| 입력 | AC + impl_report | 변경 파일 + seed 시나리오 |

**shadow는 verifier를 대체하지 않는다** — 보완 도구다. 둘 다 활성화되면 병렬 실행됨.

### 3. verifier ↔ vs-code-review (시점·깊이 다름)

| | verifier | vs-code-review |
|--|----------|----------------|
| 시점 | 태스크 완료 **즉시** | 커밋/PR **직전** |
| 입력 단위 | 단일 태스크 | 여러 태스크 누적 diff |
| 탐지 대상 | AC 미충족·품질 이슈 | 10개 프로덕션 버그 패턴(race, SQL 인젝션 등) |
| 자동 수정 | 없음 | 일부 패턴 (기계적 문제) |

verifier는 "이 태스크가 AC를 충족하는가?"를, vs-code-review는 "이 머지가 프로덕션에 안전한가?"를 본다.

### 4. vs-code-review ↔ simplify-loop (둘 다 수동, 관점 다름)

- **vs-code-review**: 버그 탐지 (정확성·안전성)
- **simplify-loop**: 품질 개선 (재사용·효율·가독성), **개선점 0까지 반복**

**순서 권장**: simplify-loop (품질) → vs-code-review (버그) → /vs-security (보안)

### 5. qa-shadow ↔ /vs-qa (레벨 다름)

qa-shadow는 **태스크 단위 경량**, `/vs-qa`는 **플랜 단위 본격**. shadow는 자동 동반자, vs-qa는 수동 QA 팀 실행.

## 트리거 타이밍 차트

```
태스크 구현 → [verifier + qa-shadow 병렬]  ← 자동
                    ↓ done
           다음 태스크...
                    ↓ 플랜 완료
              /vs-qa (수동, 시나리오 기반)
                    ↓
              /vs-plan-verify (수동, 플랜 게이트)
                    ↓ 또는 /vs-plan-close 번들
           커밋/머지 직전
                    ↓
          /simplify-loop → /vs-code-review → /vs-security  ← 수동
                    ↓
              /vs-commit → /vs-merge
```

## 선택 가이드

| 상황 | 사용할 도구 |
|------|-----------|
| 태스크를 방금 끝냈는데 AC 충족 확인 | (자동) verifier / verification |
| 태스크 완료 시 잠재 이슈 병렬 탐지 | (자동) qa-shadow |
| 플랜 전체를 최종 종결하고 싶을 때 | `/vs-plan-close` 번들 |
| 결함을 체계적으로 발견하고 싶을 때 | `/vs-qa` |
| PR/커밋 직전 버그 사전 탐지 | `/vs-code-review` |
| 코드 품질·재사용 개선 반복 | `/simplify-loop` |
| 보안 취약점 OWASP 감사 | `/vs-security` |

## 참고 문서

- verifier 에이전트 상세: `agents/verifier.md`
- qa-shadow 에이전트 상세: `agents/qa-shadow.md`
- verification 스킬 상세: `skills/verification/SKILL.md`
- vs-code-review 스킬 상세: `skills/vs-code-review/SKILL.md`
- completion-checks (자동 트리거 상세): `skills/completion-checks/SKILL.md`
