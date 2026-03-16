---
name: setup
description: VibeSpec 초기 설정 및 SDD 워크플로우 안내. 처음 사용하는 사용자에게 사용법을 설명하고 첫 플랜 생성을 도와줍니다.
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Steps

1. **MCP 서버 연결 확인**
   - `vp_dashboard`를 호출하여 연결 상태를 확인하세요
   - 실패하면 `npm run build`를 먼저 실행하도록 안내하세요

2. **SDD 워크플로우 설명**
   사용자에게 다음을 설명하세요:
   - VibeSpec은 **Spec → Plan → Tasks → Implementation** 사이클을 따릅니다
   - 매 세션 시작 시 `/vibespec:resume`으로 이전 컨텍스트를 복원합니다
   - `/vibespec:plan`으로 스펙을 작성하고 태스크로 분해합니다
   - `/vibespec:next`로 다음 태스크를 가져와 작업합니다
   - `/vibespec:dashboard`로 전체 진행 현황을 봅니다

3. **첫 플랜 생성 (선택)**
   - 사용자에게 첫 플랜을 만들지 물어보세요
   - 원하면 프로젝트 제목과 간단한 스펙을 받아 `vp_plan_create`로 생성하세요

4. **컨텍스트 저장**
   - `vp_context_save`로 셋업 완료 내용을 요약 저장하세요
