---
name: vs-gc
description: Use when scanning the codebase for dead code, rule violations, and refactoring candidates with auto-fix.
invocation: user
argument-hint: "[scan|report|apply|revert] [options]"
---

# vs-gc (Garbage Collection)

코드베이스의 기술 부채를 능동적으로 탐지하고 정리합니다.

## When to Use

**사용하세요:**
- 코드베이스의 데드코드, 미사용 export/import를 정리할 때
- self-improve 규칙을 기존 코드에 소급 적용할 때
- POLICY.md 정책 위반을 탐지할 때
- 리팩토링 후보 (높은 복잡도, 코드 중복)를 식별할 때

**사용하지 마세요:**
- 보안 취약점 스캔 → `/vs-security`
- 런타임 오류 탐지 (정적 분석 범위 초과)
- 외부 의존성 버전 관리

## Commands

```bash
vs gc scan [--full|--incremental] [--path <dir>]   # 스캔 실행
vs gc report [--severity HIGH] [--format json|md]    # 결과 리포트
vs gc apply [--auto-only|--all] [--dry-run]          # 수정 적용
vs gc history                                         # 스캔 이력
vs gc revert <scan_id>                                # 스캔 롤백
```

## Scanners

| 스캐너 | 탐지 대상 | 카테고리 |
|--------|-----------|----------|
| RuleRetroScanner | self-improve 규칙 위반 | RULE_VIOLATION |
| PolicyScanner | POLICY.md 정책 위반 | POLICY_VIOLATION |
| DeadCodeScanner | 미사용 코드 | DEAD_CODE |
| RefactorScanner | 리팩토링 후보 | REFACTOR_CANDIDATE |

## Safety Classification

- **SAFE**: 외부 의존성 없음 + 단일 파일 변경 + 테스트 존재 → 자동 수정
- **RISKY**: 위 조건 미충족 → 사용자 승인 필요
