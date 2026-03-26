---
name: vs-freeze
description: Use when restricting file edits to a specific directory. 지정 디렉토리 외부의 Edit/Write를 PreToolUse hook으로 차단합니다. vs-worktree 생성 시 자동 제안됩니다.
invocation: user
argument-hint: "[set <path>|off|status]"
---

# Freeze Mode (편집 범위 제한)

파일 편집을 지정된 디렉토리 내부로 제한하는 안전 모드입니다.

## When to Use

**사용하세요:**
- 특정 모듈만 수정해야 하는 태스크에서 범위 이탈 방지
- `vs-worktree`로 격리 환경을 만든 후 해당 디렉토리로 제한
- 공유 코드(core, config)를 실수로 건드리는 것을 방지

**사용하지 마세요:**
- 여러 모듈에 걸친 리팩토링 작업
- 프로젝트 전체 설정 변경

## Steps

1. **활성화**: Bash 도구로 `vs freeze set <path>` 실행 (상대경로 자동 변환)
2. 이후 지정 디렉토리 외부의 Edit/Write 도구 사용이 자동 차단됩니다
3. **비활성화**: `vs freeze off`
4. **상태 확인**: `vs freeze status`

## 한계

- Edit/Write 도구만 차단합니다. Bash 도구를 통한 파일 수정(`>`, `sed -i` 등)은 완벽히 차단하지 못합니다
- 심볼릭 링크를 통한 우회는 감지하지 못합니다
- 한 번에 하나의 디렉토리만 설정 가능합니다

## 다음 단계

- → `/vs-careful`로 파괴적 명령도 차단
- → `/vs-guard`로 careful + freeze 동시 활성화
