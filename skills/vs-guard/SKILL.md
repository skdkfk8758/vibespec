---
name: vs-guard
description: Enable careful + freeze safety mode. (안전 모드)
invocation: user
argument-hint: "[on <path>|off|status]"
---

# Guard Mode (최대 안전 모드)

`vs-careful` + `vs-freeze`를 동시에 활성화하는 결합 모드입니다.

## When to Use

**사용하세요:**
- 프로덕션 환경에서 민감한 작업 수행 시
- `vs-exec` 배치 실행 + 범위 제한이 동시에 필요할 때
- 최대한의 안전장치가 필요한 상황

## Steps

0. **Args 파싱 — 모드 분기**

   ARGUMENTS를 확인하여 모드를 분기하세요:

   | Args | 동작 |
   |------|------|
   | `careful` | `vs careful on` 실행 (파괴적 명령만 차단). freeze는 건드리지 않음 |
   | `freeze` 또는 `freeze <path>` | `vs freeze set <path>` 실행 (편집 범위만 제한). careful은 건드리지 않음 |
   | `off` | `vs guard off` 실행 (둘 다 해제) |
   | `status` | `vs guard status` 실행 |
   | 없음 또는 `on <path>` | 기존대로 careful + freeze 동시 활성화 (Step 1) |

1. **활성화**: Bash 도구로 `vs guard on <path>` 실행
   - careful 모드가 활성화됩니다 (파괴적 명령 차단)
   - freeze 경계가 `<path>`로 설정됩니다 (편집 범위 제한)
2. **비활성화**: `vs guard off` (둘 다 해제)
3. **상태 확인**: `vs guard status`

## 한계

- `vs-careful`과 `vs-freeze`의 한계가 동일하게 적용됩니다
- 자세한 내용은 각 스킬의 "한계" 섹션을 참고하세요

## 다음 단계

- → `/vs-exec`로 안전하게 배치 실행
- → `/vs-worktree`로 격리 환경 + guard 조합
