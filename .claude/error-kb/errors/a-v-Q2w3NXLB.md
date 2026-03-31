---
title: listErrorFiles가 underscore로 시작하는 nanoid entry를 필터링
severity: high
tags: [error-kb, nanoid, file-filter]
status: resolved
occurrences: 1
first_seen: 2026-03-26T20:25:14.217Z
last_seen: 2026-03-26T20:25:14.217Z
---

## Cause

listErrorFiles()에서 \!f.startsWith('_')로 _index.md를 제외하려 했으나, nanoid(12)의 URL-safe 알파벳에 _가 포함되어 _로 시작하는 ID가 생성될 경우 해당 entry가 누락됨. 약 20% 확률로 flaky test 유발.

## Solution

\!f.startsWith('_') 대신 f \!== '_index.md'로 정확 매칭. nanoid의 알파벳 특성을 고려한 필터링 필요.

