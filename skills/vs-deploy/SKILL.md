---
name: vs-deploy
description: Use when deploying the application to production. 사전 검증(git clean, 테스트, QA), 배포 실행, 사후 검증(vs-canary)을 3단계로 수행합니다. "배포", "deploy", "프로덕션 반영", "릴리즈 배포" 등에 사용하세요.
invocation: user
argument-hint: "[--skip-tests] [--skip-canary]"
---

# vs-deploy (배포 실행)

사전 검증 → 배포 실행 → 사후 검증의 3단계 파이프라인으로 안전한 배포를 수행합니다.

## When to Use

**사용하세요:**
- 릴리즈 후 프로덕션에 배포할 때
- 핫픽스를 즉시 반영할 때
- `vs-release` 완료 후 배포를 진행할 때

**사용하지 마세요:**
- 배포 설정이 없는 경우 → `/vs-deploy-setup` 먼저 실행
- 카나리 검증만 하려는 경우 → `/vs-canary`

## Prerequisites

`deploy.command`가 config에 설정되어 있어야 합니다. 미설정 시 STOP하고 `/vs-deploy-setup`을 안내합니다.

```bash
vs config get deploy.command
```

## Process

### Phase 1: 사전 검증 (Pre-deploy Validation)

1. **Git 상태 확인**
   ```bash
   git status -s
   ```
   - 커밋되지 않은 변경사항이 있으면 STOP: "커밋되지 않은 변경사항이 있습니다."

2. **테스트 실행** (`--skip-tests` 미지정 시)
   ```bash
   npm test
   ```
   - 실패하면 STOP: "테스트가 실패합니다. 수정 후 다시 시도하세요."

3. **QA Findings 확인**
   ```bash
   vs qa findings --status open
   ```
   - critical/high severity finding이 있으면 경고 표시:
     ```
     ⚠ 미해결 QA 항목이 있습니다:
     - [critical] #12: 인증 우회 가능
     계속 진행할까요? (Y/N)
     ```

4. **사용자 확인**
   ```
   배포 준비 완료:

   | 항목 | 상태 |
   |------|------|
   | Git | clean |
   | 테스트 | pass |
   | QA | {open_count}건 미해결 |
   | 플랫폼 | {deploy.platform} |
   | 명령 | {deploy.command} |

   배포를 진행할까요? (Y/N)
   ```

### Phase 2: 배포 실행 (Deploy Execution)

1. config에서 배포 명령을 읽어 실행:
   ```bash
   vs config get deploy.command
   # → 해당 명령 실행
   ```

2. 명령 실행 결과를 모니터링:
   - 성공 (exit code 0) → Phase 3으로 진행
   - 실패 (exit code != 0) → STOP하고 에러 로그 출력

3. 배포 이벤트 기록:
   ```bash
   vs context save --summary "[deploy] {platform} 배포 완료 — v{version}"
   ```

### Phase 3: 사후 검증 (Post-deploy)

1. `deploy.health_url`이 설정되어 있으면 자동으로 vs-canary 트리거:
   ```
   헬스체크 URL이 설정되어 있습니다. 카나리 검증을 시작합니다...
   ```
   → `/vs-canary` 실행 안내

2. `deploy.health_url`이 없으면:
   ```
   헬스체크 URL이 미설정입니다. 수동으로 배포 상태를 확인하세요.
   설정하려면: /vs-deploy-setup
   ```

3. 최종 결과 보고:
   ```
   배포 완료!

   | 항목 | 값 |
   |------|-----|
   | 플랫폼 | {platform} |
   | 명령 | {command} |
   | 상태 | 성공 |
   | 카나리 | {triggered 또는 "미설정"} |

   다음 단계:
   - /vs-canary — 헬스체크 수동 실행
   - vs deploy status — 배포 상태 확인
   ```

## Rules

- deploy.command가 미설정이면 절대 배포하지 않음 — `/vs-deploy-setup` 안내
- Git이 clean하지 않으면 STOP
- 테스트 실패 시 STOP (--skip-tests로 건너뛰기 가능)
- 배포 이벤트는 항상 `vs context save`로 기록
- critical QA finding이 있으면 사용자 확인 필수
- 배포 명령은 config에서 읽은 것만 실행 — 임의 명령 실행 금지
