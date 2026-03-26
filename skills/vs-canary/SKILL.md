---
name: vs-canary
description: Use when verifying deployment health after a deploy. 헬스체크 URL을 60초간 폴링하여 HTTP 상태와 응답 시간을 검증합니다. "카나리", "canary", "헬스체크", "배포 확인", "health check" 등에 사용하세요.
invocation: user
argument-hint: "[health_url override]"
---

# vs-canary (배포 헬스체크)

배포 후 헬스체크 URL을 주기적으로 폴링하여 서비스 상태를 검증합니다.

## When to Use

**사용하세요:**
- `/vs-deploy` 완료 후 자동 또는 수동으로 헬스체크할 때
- 배포 후 서비스 상태를 빠르게 확인하고 싶을 때
- 장애 의심 시 헬스 상태를 점검할 때

**사용하지 마세요:**
- 배포 자체를 실행하려는 경우 → `/vs-deploy`
- 배포 설정이 필요한 경우 → `/vs-deploy-setup`

## Prerequisites

`deploy.health_url`이 config에 설정되어 있어야 합니다. 인자로 URL을 직접 전달하면 config 대신 해당 URL을 사용합니다.

```bash
vs config get deploy.health_url
```

미설정이고 인자도 없으면 STOP: "헬스체크 URL이 설정되지 않았습니다. /vs-deploy-setup으로 설정하세요."

## Process

### Phase 1: 폴링 설정

| 항목 | 기본값 |
|------|--------|
| 폴링 간격 | 10초 |
| 총 폴링 시간 | 60초 |
| 폴링 횟수 | 6회 |
| 실패 임계값 | 2회 연속 실패 |

### Phase 2: 헬스체크 폴링

60초 동안 10초 간격으로 헬스체크 URL에 GET 요청을 보냅니다:

```
카나리 검증 시작: {health_url}
폴링 간격: 10초 | 총 시간: 60초

[1/6] GET {health_url} → 200 OK (142ms) ✓
[2/6] GET {health_url} → 200 OK (98ms) ✓
[3/6] GET {health_url} → 200 OK (105ms) ✓
...
```

각 요청에서 확인하는 항목:
1. **HTTP 상태 코드**: 200~299 범위면 성공
2. **응답 시간**: 요청~응답까지 소요 시간 (ms)

### Phase 3: 실패 감지 (2-consecutive-failure debounce)

단일 실패는 무시하고, **2회 연속 실패** 시에만 경고를 발생시킵니다:

- 1회 실패 → 경고 없이 계속 폴링
- 2회 연속 실패 → 즉시 경고 발생:
  ```
  ⚠ 카나리 경고: 2회 연속 헬스체크 실패

  | 시도 | 상태 | 응답시간 |
  |------|------|---------|
  | 3/6 | 503 Service Unavailable | - |
  | 4/6 | 503 Service Unavailable | - |

  롤백을 고려하세요. 이전 배포 로그: vs deploy status
  ```

- 연속 실패 후 성공하면 카운터 리셋

### Phase 4: 결과 보고

폴링 완료 후 최종 리포트를 출력합니다:

```
카나리 검증 완료: {PASS 또는 FAIL}

| 항목 | 값 |
|------|-----|
| URL | {health_url} |
| 총 요청 | 6 |
| 성공 | {success_count} |
| 실패 | {fail_count} |
| 평균 응답시간 | {avg_ms}ms |
| 최대 응답시간 | {max_ms}ms |
| 판정 | {PASS 또는 FAIL} |

상세 로그:
| # | 상태코드 | 응답시간 | 결과 |
|---|---------|---------|------|
| 1 | 200 | 142ms | PASS |
| 2 | 200 | 98ms | PASS |
| 3 | 503 | - | FAIL |
| 4 | 200 | 110ms | PASS |
| 5 | 200 | 95ms | PASS |
| 6 | 200 | 102ms | PASS |
```

PASS 조건: 2회 연속 실패가 한 번도 발생하지 않음
FAIL 조건: 2회 연속 실패가 1회 이상 발생

이벤트 기록:
```bash
vs context save --summary "[canary] {PASS|FAIL} — {health_url} ({success_count}/{total} 성공, avg {avg_ms}ms)"
```

## Rules

- 헬스체크 URL 미설정 시 절대 폴링하지 않음
- 2-consecutive-failure debounce — 단일 실패로 경고하지 않음
- 폴링 중 사용자가 중단하면 즉시 중지하고 현재까지의 결과 보고
- 결과는 항상 `vs context save`로 기록
- 응답 시간이 5000ms를 초과하면 해당 요청을 타임아웃 실패로 처리
