---
name: vs-worktree
description: Use when starting isolated feature work in a git worktree. 워크트리 생성, .gitignore 검증, 기술스택 감지, 의존성 설치, 테스트 베이스라인 확인까지 한 번에 수행합니다. 격리된 환경이 필요할 때, 구현 계획 실행 전, /vs-next나 /vs-pick 전에 사용하세요.
invocation: user
---

# Worktree 환경 셋업

격리된 워크트리를 생성하고 개발 환경을 자동으로 구성합니다.
`/vs-worktree` → `/vs-next` → `/vs-merge` 순서로 사용합니다.

## When to Use

**사용하세요:**
- 기능 개발을 메인 브랜치와 격리하여 진행할 때
- `/vs-next`나 `/vs-pick` 전에 안전한 작업 환경이 필요할 때
- 여러 기능을 병렬로 개발할 때 (각각 별도 워크트리)

**사용하지 마세요:**
- 이미 워크트리 안에 있을 때 (중첩 워크트리는 불가)
- 단일 파일 수정, 핫픽스 등 격리가 불필요한 작업
- `git stash`로 충분한 경우

## Steps

1. **현재 환경 확인**
   - `git rev-parse --git-dir`로 현재 워크트리 내부인지 확인하세요
   - 경로에 `/worktrees/`가 포함되면 이미 워크트리 안입니다
   - 이미 워크트리 안이면: 현재 워크트리 정보를 보여주고, 새로 만들 필요가 있는지 물어보세요

2. **워크트리 이름 결정**
   - 활성 플랜이 있으면 (`vs_plan_list`): 플랜 제목에서 kebab-case 이름을 자동 생성하세요
     - 예: "사용자 인증 API 추가" → `user-auth-api`
   - 활성 플랜이 없으면: 사용자에게 작업 목적을 물어보고 이름을 제안하세요
   - `AskUserQuestion`으로 제안한 이름을 확인받으세요:
     - header: "워크트리 이름"
     - 선택지:
       - label: "{제안된 이름}", description: "이 이름으로 워크트리를 생성합니다"
       - label: "직접 입력", description: "다른 이름을 사용합니다"

3. **워크트리 생성**
   - `EnterWorktree`를 실행하여 워크트리를 생성하세요
   - 브랜치명은 `worktree-{이름}` 형식을 사용하세요

4. **.gitignore 검증**
   프로젝트 루트의 `.gitignore`를 읽고 아래 항목을 확인하세요:

   **워크트리 디렉토리 보호:**
   - `.claude/worktrees/`가 `.gitignore`에 있는지 확인
   - 없으면 추가를 제안하세요 (워크트리 내용이 트래킹되는 것을 방지)

   **기술스택별 필수 패턴** (Step 5에서 감지한 스택 기준):

   | 스택 | 필수 패턴 |
   |------|-----------|
   | Node | `node_modules/` |
   | Rust | `target/` |
   | Python | `__pycache__/`, `.venv/`, `*.pyc` |
   | Go | (보통 불필요) |
   | 공통 | `.env`, `.DS_Store` |

   - 누락된 패턴이 있으면 목록을 보여주고 추가 여부를 물어보세요
   - 사용자가 승인하면 `.gitignore`에 추가하세요
   - 이 검증은 워크트리가 아닌 **원본 저장소의 `.gitignore`**를 대상으로 합니다

5. **기술스택 감지 및 의존성 설치**
   프로젝트 루트에서 다음 파일의 존재 여부로 기술스택을 감지하세요:

   | 감지 파일 | 스택 | 설치 명령 |
   |-----------|------|-----------|
   | `package-lock.json` | Node (npm) | `npm ci` |
   | `yarn.lock` | Node (yarn) | `yarn install --frozen-lockfile` |
   | `pnpm-lock.yaml` | Node (pnpm) | `pnpm install --frozen-lockfile` |
   | `bun.lockb` | Node (bun) | `bun install --frozen-lockfile` |
   | `Cargo.toml` | Rust | `cargo build` |
   | `requirements.txt` | Python (pip) | `pip install -r requirements.txt` |
   | `pyproject.toml` | Python (uv/poetry) | `uv sync` 또는 `poetry install` |
   | `go.mod` | Go | `go mod download` |

   - 여러 스택이 감지되면 모두 설치하세요 (모노레포 가능)
   - lock 파일 기반 설치를 우선하세요 (재현 가능한 빌드를 위해 `install` 대신 `ci` 사용)
   - 설치 실패 시 에러를 보여주고, 계속 진행할지 물어보세요

6. **테스트 베이스라인 확인**
   감지된 스택에 맞는 테스트 명령을 실행하세요:

   | 스택 | 테스트 명령 |
   |------|-------------|
   | Node (vitest) | `npx vitest run` |
   | Node (jest) | `npx jest` |
   | Node (기타) | `npm test` |
   | Rust | `cargo test` |
   | Python | `pytest` |
   | Go | `go test ./...` |

   - `package.json`의 `scripts.test`나 설정 파일(`vitest.config.*`, `jest.config.*`)로 테스트 러너를 판별하세요
   - 테스트가 설정되어 있지 않으면 이 단계를 건너뛰세요

   **결과에 따른 분기:**

   모든 테스트 통과 → 베이스라인 기록 후 진행:
   ```
   ✅ 테스트 베이스라인: {passed}개 통과 (기존 실패 0개)
   ```

   일부 테스트 실패 → `AskUserQuestion`으로 선택지를 제시하세요:
   - header: "테스트 베이스라인: {failed}개 실패 / {passed}개 통과"
   - 선택지:
     - label: "무시하고 진행", description: "실패 테스트가 기존 이슈임을 확인했습니다"
     - label: "작업 중단", description: "베이스라인이 깨진 상태에서 작업하지 않습니다"
     - label: "실패 테스트 먼저 수정", description: "베이스라인 복구 후 기능 작업을 시작합니다"

7. **셋업 완료 리포트**
   최종 상태를 요약하세요:

   ```
   ## 워크트리 셋업 완료

   | 항목 | 상태 |
   |------|------|
   | 워크트리 | .claude/worktrees/{이름} (worktree-{이름}) |
   | .gitignore | ✅ 검증 완료 (또는 ⚠️ {N}개 패턴 추가됨) |
   | 기술스택 | Node (npm), ... |
   | 의존성 | ✅ 설치 완료 |
   | 테스트 베이스라인 | ✅ {N}개 통과 (또는 ⚠️ {N}개 실패 — 무시하고 진행) |
   ```

   - `/vs-next`로 첫 태스크를 시작할 수 있다고 안내하세요
   - `/vs-pick`으로 특정 태스크를 선택할 수도 있다고 안내하세요

## 다음 단계

- → `/vs-next`로 첫 번째 태스크 시작
- → `/vs-pick`으로 특정 태스크 선택
- → `/vs-merge`로 작업 완료 후 메인 브랜치에 병합
