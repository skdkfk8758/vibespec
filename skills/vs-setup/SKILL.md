---
name: vs-setup
description: Use when setting up VibeSpec for the first time. 초기 설정 및 SDD 워크플로우를 안내하고 첫 플랜 생성을 도와줍니다.
invocation: user
---

# VibeSpec Setup

VibeSpec을 처음 사용하는 사용자의 초기 설정을 도와줍니다.

## Steps

1. **CLI 연결 확인**
   - Bash 도구로 `vp dashboard --json` 명령을 실행하여 CLI가 정상 동작하는지 확인하세요
   - 성공하면 → Step 2로 건너뛰세요
   - 실패하면 → 아래 **원인 진단**을 실행하세요

   **원인 진단 (vp dashboard 실패 시):**

   a. **플러그인 설치 확인**:
      ```bash
      cat ~/.claude/plugins/installed_plugins.json | grep vibespec
      ```
      - 결과가 없으면 STOP: "VibeSpec 플러그인이 설치되어 있지 않습니다. `claude plugins install vibespec` 후 재시작하세요."
      - `installPath`를 `PLUGIN_DIR`로 기록

   b. **CLI 바이너리 확인**:
      ```bash
      test -f "$PLUGIN_DIR/dist/cli/index.js" && echo "OK"
      ```
      - 없으면: `/vs-update`를 실행하여 플러그인을 재설치하라고 안내하고 STOP

   c. **native 의존성 확인**:
      ```bash
      test -d "$PLUGIN_DIR/node_modules/better-sqlite3" && echo "OK"
      ```
      - 없으면:
        ```bash
        cd "$PLUGIN_DIR" && npm ci --production
        ```
      - 설치 후 다시 `vp dashboard --json`을 실행하여 확인하세요

   d. **직접 실행 테스트**:
      ```bash
      node "$PLUGIN_DIR/dist/cli/index.js" dashboard --json
      ```
      - 에러가 있으면 에러 내용을 사용자에게 보여주고 STOP

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
   - Bash 도구로 `vp context save --json --summary "VibeSpec 초기 셋업 완료"` 명령을 실행하여 셋업 완료를 저장하세요
