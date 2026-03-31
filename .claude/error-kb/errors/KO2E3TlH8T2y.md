---
title: formatPlanList에서 created_at이 null일 때 split 에러
severity: medium
tags: [cli, formatters, null-safety]
status: resolved
occurrences: 1
first_seen: 2026-03-26T20:25:27.077Z
last_seen: 2026-03-26T20:25:27.077Z
---

## Cause

plan.created_at이 null인 레코드가 DB에 존재할 때 plan.created_at.split('T')에서 TypeError 발생. DB 마이그레이션 중 컬럼 순서 불일치로 null이 저장된 것으로 추정.

## Solution

plan.created_at?.split('T')[0] ?? 'unknown'으로 optional chaining 적용.

