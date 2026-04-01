---
name: vs-careful
description: [Env] Block destructive commands via PreToolUse hook.
invocation: agent
argument-hint: "[on|off|status]"
---

# Careful Mode (파괴적 명령 차단)

파괴적 명령을 실행 전에 자동으로 차단하는 안전 모드입니다.

## When to Use

**사용하세요:**
- `vs-exec`로 배치 실행 전에 안전장치 활성화
- 프로덕션 DB 접근이 가능한 환경에서 작업 시
- 실수로 인한 데이터 손실을 방지하고 싶을 때

**사용하지 마세요:**
- 의도적으로 파괴적 명령을 실행해야 할 때 → 먼저 `vs careful off`

## Steps

1. **활성화**: Bash 도구로 `vs careful on` 실행
2. 이후 다음 명령들이 자동 차단됩니다:
   - `rm -rf` (재귀 강제 삭제)
   - `DROP TABLE` / `DROP DATABASE` (DB 삭제)
   - `TRUNCATE` (테이블 비우기)
   - `git push --force` (강제 푸시, `--force-with-lease`는 허용)
   - `git reset --hard` (하드 리셋)
   - `git clean -f` (추적되지 않는 파일 삭제)
3. **비활성화**: `vs careful off`
4. **상태 확인**: `vs careful status`

## 한계

- Claude Code의 PreToolUse hook으로 동작하므로, 사용자가 직접 터미널에서 실행하는 명령은 차단할 수 없습니다
- Bash 도구를 통한 명령만 감시합니다
- 패턴 매칭 기반이므로 난독화된 명령은 탐지하지 못할 수 있습니다

## 다음 단계

- → `/vs-freeze`로 편집 범위도 제한
- → `/vs-guard`로 careful + freeze 동시 활성화
