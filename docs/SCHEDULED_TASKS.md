# Scheduled Tasks (주기 작업 등록 가이드)

VibeSpec의 일부 품질·유지보수 작업은 **주기적으로 자동 실행**하는 편이 효과적이다. 이 문서는 Claude Code의 `/schedule` 플러그인을 활용한 복붙 가능한 등록 명령과 각 주기의 근거를 제공한다.

## 왜 주기화인가?

수동 실행에만 의존할 때의 문제:
- **vs-gc**: 데드코드·규칙 위반은 누적되는 성질 → 잊으면 쌓인다
- **vs-security**: 릴리즈 직전에만 돌리면 누적된 취약점을 한꺼번에 직면
- **self-improve-review**: 학습 규칙이 bloat되면 신호/잡음 비율 저하

주기 등록을 통해 이 세 가지가 **잊혀도 자동으로 실행**되도록 한다.

## 전제조건

```bash
# schedule 플러그인 확인
ls ~/.claude/plugins/marketplaces/*/schedule* 2>/dev/null
# 또는 Claude Code 안에서: /schedule --list
```

`/schedule`이 설치되어 있지 않다면 [대안 섹션](#대안-schedule-플러그인-미설치-시)을 참조.

## 권장 주기 작업 3종

### 1. vs-gc (월 1회)

```bash
/schedule create \
  --name "vibespec-gc-monthly" \
  --cron "0 9 1 * *" \
  --prompt "/vs-gc --auto-fix=false"
```

- **주기**: 매월 1일 09:00
- **근거**: 데드코드·룰 위반은 개발 속도에 비례해 누적. 월 1회 스캔으로 리팩터 타이밍 포착
- **옵션**: `--auto-fix=false` (초기엔 리포트만, 숙달 후 `true`로 전환)

### 2. vs-security (주 1회 + 릴리즈 전)

```bash
# 주기 스캔
/schedule create \
  --name "vibespec-security-weekly" \
  --cron "0 10 * * 1" \
  --prompt "/vs-security"
```

- **주기**: 매주 월요일 10:00
- **근거**: OWASP Top 10 취약점은 의존성 업데이트·신규 API 추가 시 유입. 주 1회 정기 감사로 릴리즈 직전 폭주 방지
- **추가**: 릴리즈 브랜치 생성 시에도 수동 실행 권장 (`/vs-security`)

### 3. self-improve-review (월 1회)

```bash
/schedule create \
  --name "vibespec-self-improve-review-monthly" \
  --cron "0 14 15 * *" \
  --prompt "/self-improve-review"
```

- **주기**: 매월 15일 14:00
- **근거**: `.claude/rules/` 디렉토리의 학습 규칙은 시간이 지나면서 중복·모순·stale이 발생. 월 1회 정리로 신호/잡음 비율 유지

## 일괄 등록 스크립트

세 작업을 한 번에 등록하려면:

```bash
/schedule create --name "vibespec-gc-monthly" --cron "0 9 1 * *" --prompt "/vs-gc --auto-fix=false"
/schedule create --name "vibespec-security-weekly" --cron "0 10 * * 1" --prompt "/vs-security"
/schedule create --name "vibespec-self-improve-review-monthly" --cron "0 14 15 * *" --prompt "/self-improve-review"
```

## 관리 명령

```bash
# 등록된 VibeSpec 주기 작업 목록
/schedule list --filter "vibespec-*"

# 특정 작업 일시 중지
/schedule update --name "vibespec-gc-monthly" --enabled false

# 삭제
/schedule delete --name "vibespec-gc-monthly"

# 즉시 1회 실행 (테스트)
/schedule run --name "vibespec-gc-monthly"
```

> **주의**: `/schedule` 플러그인의 정확한 CLI 플래그는 버전에 따라 다를 수 있다. `/schedule --help`로 실제 옵션을 확인하라.

## 대안 (schedule 플러그인 미설치 시)

### macOS/Linux: cron

```bash
# crontab -e 로 추가
0 9 1 * *   cd ~/Workspace/VibeSpec && claude "/vs-gc" > /tmp/vs-gc.log 2>&1
0 10 * * 1  cd ~/Workspace/VibeSpec && claude "/vs-security" > /tmp/vs-security.log 2>&1
0 14 15 * * cd ~/Workspace/VibeSpec && claude "/self-improve-review" > /tmp/vs-sir.log 2>&1
```

- `claude` CLI가 설치되어 있고 non-interactive 모드를 지원해야 함
- 로그 경로는 적절히 조정
- 프로젝트 경로는 절대 경로 필수

### macOS: launchd

LaunchAgents plist로 등록. 세부 절차는 `man launchd.plist` 참조.

### GitHub Actions (팀 협업)

`.github/workflows/vibespec-periodic.yml`:

```yaml
on:
  schedule:
    - cron: '0 9 1 * *'   # gc monthly
    - cron: '0 10 * * 1'  # security weekly
jobs:
  periodic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # 실제 Claude Code 실행은 self-hosted runner 또는 API 연동 필요
```

## cron 주기 참고

| 표현식 | 의미 |
|--------|------|
| `0 9 1 * *` | 매월 1일 09:00 |
| `0 10 * * 1` | 매주 월요일 10:00 |
| `0 14 15 * *` | 매월 15일 14:00 |
| `0 */6 * * *` | 6시간마다 |
| `0 0 * * 0` | 매주 일요일 자정 |

## 체크리스트

새 프로젝트 셋업 시 한 번만 실행:

- [ ] `/schedule list`로 현재 등록 상태 확인
- [ ] 위 3개 작업 일괄 등록
- [ ] 첫 실행을 `--run` 옵션 또는 수동 트리거로 테스트
- [ ] 실행 결과가 `.claude/` 또는 로그 경로에 기록되는지 확인

## 관련 문서

- `/vs-gc` 스킬: `skills/vs-gc/SKILL.md`
- `/vs-security` 스킬: `skills/vs-security/SKILL.md`
- `self-improve-review` 스킬: `skills/self-improve-review/SKILL.md`
- QA 도구 전반: `docs/QA_SKILLS_MATRIX.md`
