---
name: vs-setup
description: Use when setting up VibeSpec for the first time. 초기 설정 및 SDD 워크플로우를 안내하고 첫 플랜 생성을 도와줍니다.
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Steps

1. **환경 진단**
   - `vp_dashboard`를 호출하여 MCP 서버 연결 상태를 확인하세요
   - 성공하면 "VibeSpec MCP 서버가 정상 연결되었습니다." 안내
   - 실패하면 트러블슈팅:
     - `npm run build`가 실행되었는지 확인
     - `vibespec.db` 파일이 프로젝트 루트에 생성 가능한지 확인
     - MCP 서버 설정이 올바른지 확인 (`~/.claude/settings.json` 내 mcpServers)

2. **기존 데이터 확인**
   - 대시보드 결과에 기존 플랜이 있으면:
     → "기존 플랜이 있습니다. `/vs-resume`으로 이어서 작업할 수 있습니다." 안내
   - 기존 플랜이 없으면 다음 단계로 진행

3. **SDD 워크플로우 설명**
   사용자에게 다음을 설명하세요:
   - VibeSpec은 **Spec → Plan → Tasks → Implementation** 사이클을 따릅니다
   - 매 세션 시작 시 `/vs-resume`으로 이전 컨텍스트를 복원합니다
   - `/vs-plan`으로 스펙을 작성하고 태스크로 분해합니다
   - `/vs-next`로 다음 태스크를 가져와 작업합니다
   - `/vs-commit`으로 변경사항을 태스크와 연동하여 커밋합니다
   - `/vs-dashboard`로 전체 진행 현황을 봅니다

4. **첫 플랜 생성 (선택)**
   - 사용자에게 첫 플랜을 만들지 물어보세요
   - 원하면 `/vs-plan`을 실행하여 스펙 기반 플랜을 생성하세요

5. **컨텍스트 저장**
   - `vp_context_save`로 셋업 완료 내용을 요약 저장하세요
