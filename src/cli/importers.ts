import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import type { NewBacklogItem, BacklogPriority, BacklogCategory } from '../core/types.js';

export interface ImportResult {
  items: NewBacklogItem[];
  source_prefix: string;
  errors: string[];
}

// ── Repo Validation ───────────────────────────────────────────────────

const REPO_FORMAT_RE = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

export function validateRepoFormat(repo: string): void {
  const trimmed = repo.trim();
  if (!trimmed) {
    throw new Error('repo 파라미터가 비어 있습니다. "owner/repo" 형식으로 입력하세요.');
  }
  if (!REPO_FORMAT_RE.test(trimmed)) {
    throw new Error(
      `잘못된 repo 형식입니다: "${repo}". "owner/repo" 형식(예: octocat/Hello-World)만 허용됩니다.`,
    );
  }
}

// ── GitHub Issues ──────────────────────────────────────────────────────

export function importFromGithub(
  repo: string,
  options?: { label?: string; state?: string },
): ImportResult {
  const errors: string[] = [];

  try {
    validateRepoFormat(repo);
  } catch (e: unknown) {
    errors.push(e instanceof Error ? e.message : String(e));
    return { items: [], source_prefix: `github:${repo}`, errors };
  }

  const state = options?.state ?? 'open';
  const args = [
    'issue', 'list',
    '--repo', repo,
    '--state', state,
    '--json', 'number,title,body,labels',
    '--limit', '50',
  ];
  if (options?.label) {
    args.push('--label', options.label);
  }

  let jsonStr: string;
  try {
    jsonStr = execFileSync('gh', args, { encoding: 'utf-8', timeout: 30000 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('command not found') || msg.includes('not found') || msg.includes('ENOENT')) {
      errors.push('gh CLI가 설치되어 있지 않습니다. https://cli.github.com 에서 설치하세요.');
    } else {
      errors.push(`GitHub API 오류: ${msg.slice(0, 200)}`);
    }
    return { items: [], source_prefix: `github:${repo}`, errors };
  }

  let issues: Array<{
    number: number;
    title: string;
    body: string | null;
    labels: Array<{ name: string }>;
  }>;
  try {
    issues = JSON.parse(jsonStr);
  } catch {
    errors.push('GitHub API 응답을 파싱할 수 없습니다.');
    return { items: [], source_prefix: `github:${repo}`, errors };
  }

  const items: NewBacklogItem[] = issues.map((issue) => {
    const labelNames = issue.labels.map((l) => l.name);
    return {
      title: issue.title,
      description: issue.body?.slice(0, 500) ?? undefined,
      priority: inferPriorityFromLabels(labelNames),
      category: inferCategoryFromLabels(labelNames),
      tags: labelNames.length > 0 ? labelNames : undefined,
      source: `github:${repo}#${issue.number}`,
    };
  });

  return { items, source_prefix: `github:${repo}`, errors };
}

function inferPriorityFromLabels(labels: string[]): BacklogPriority {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes('critical') || l.includes('urgent') || l.includes('p0'))) return 'critical';
  if (lower.some((l) => l.includes('high') || l.includes('important') || l.includes('p1'))) return 'high';
  if (lower.some((l) => l.includes('low') || l.includes('minor') || l.includes('p3'))) return 'low';
  return 'medium';
}

function inferCategoryFromLabels(labels: string[]): BacklogCategory | undefined {
  const lower = labels.map((l) => l.toLowerCase());
  if (lower.some((l) => l.includes('bug') || l.includes('fix'))) return 'bugfix';
  if (lower.some((l) => l.includes('feature') || l.includes('enhancement'))) return 'feature';
  if (lower.some((l) => l.includes('refactor'))) return 'refactor';
  if (lower.some((l) => l.includes('chore') || l.includes('maintenance'))) return 'chore';
  return undefined;
}

// ── Text File (Markdown) ───────────────────────────────────────────────

export function importFromFile(filepath: string): ImportResult {
  const errors: string[] = [];

  if (!existsSync(filepath)) {
    errors.push(`파일을 찾을 수 없습니다: ${filepath}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }

  let content: string;
  try {
    content = readFileSync(filepath, 'utf-8');
  } catch (e: unknown) {
    errors.push(`파일 읽기 실패: ${e instanceof Error ? e.message : String(e)}`);
    return { items: [], source_prefix: `file:${filepath}`, errors };
  }

  const lines = content.split('\n');
  const items: NewBacklogItem[] = [];

  for (const line of lines) {
    // Match unchecked checklist items: - [ ] text
    const match = line.match(/^[\s]*-\s+\[\s\]\s+(.+)$/);
    if (match) {
      items.push({
        title: match[1].trim(),
        source: `file:${filepath}`,
      });
    }
  }

  if (items.length === 0 && lines.length > 0) {
    errors.push('체크리스트 항목(- [ ])을 찾을 수 없습니다.');
  }

  return { items, source_prefix: `file:${filepath}`, errors };
}

// ── Slack (stub — requires MCP runtime) ────────────────────────────────

export function importFromSlack(
  channel: string,
  _options?: { since?: string },
): ImportResult {
  // Slack import is handled at the skill level via MCP tools.
  // This CLI function provides a stub for --dry-run and structured output.
  return {
    items: [],
    source_prefix: `slack:${channel}`,
    errors: ['Slack import는 스킬 모드(/vs-backlog)에서 MCP 도구를 통해 실행하세요. CLI에서는 지원하지 않습니다.'],
  };
}
