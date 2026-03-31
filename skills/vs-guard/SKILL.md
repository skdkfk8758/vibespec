---
name: vs-guard
description: Enable careful + freeze safety mode together.
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

1. **활성화**: Bash 도구로 `vs guard on <path>` 실행
   - careful 모드가 활성화됩니다 (파괴적 명령 차단)
   - freeze 경계가 `<path>`로 설정됩니다 (편집 범위 제한)
2. **비활성화**: `vs guard off` (둘 다 해제)
3. **상태 확인**: `vs guard status`

## 개별 제어

guard를 해제하지 않고 개별 모드만 조절하려면:
- `vs careful off` — careful만 해제, freeze는 유지
- `vs freeze off` — freeze만 해제, careful은 유지

## 한계

- `vs-careful`과 `vs-freeze`의 한계가 동일하게 적용됩니다
- 자세한 내용은 각 스킬의 "한계" 섹션을 참고하세요

## 다음 단계

- → `/vs-exec`로 안전하게 배치 실행
- → `/vs-worktree`로 격리 환경 + guard 조합
