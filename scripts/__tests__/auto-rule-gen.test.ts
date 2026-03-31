import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

const mockCreate = vi.fn();

// Mock @anthropic-ai/sdk before importing the module under test
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
    },
  };
});

// Import after mocking
import { processAutoRuleGen } from '../auto-rule-gen.js';

describe('auto-rule-gen', () => {
  let tmpDir: string;
  let pendingDir: string;
  let processedDir: string;
  let rulesDir: string;

  function makePendingFile(filename: string, data: Record<string, unknown>) {
    fs.writeFileSync(path.join(pendingDir, filename), JSON.stringify(data), 'utf-8');
  }

  function makePendingData(overrides: Record<string, unknown> = {}) {
    return {
      type: 'fix_commit',
      commit_hash: 'abc123',
      commit_message: 'fix: resolve null pointer issue',
      diff_summary: 'Fixed null check',
      diff_content: '--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,4 @@\n+if (!x) return;\n x.doSomething();',
      task_id: 'task-001',
      timestamp: '2026-03-30T10:00:00.000Z',
      ...overrides,
    };
  }

  function makeApiResponse(data: { title: string; pattern: string; applies_when: string; category: string }) {
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(data),
        },
      ],
    };
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-rule-gen-test-'));
    pendingDir = path.join(tmpDir, '.claude', 'self-improve', 'pending');
    processedDir = path.join(tmpDir, '.claude', 'self-improve', 'processed');
    rulesDir = path.join(tmpDir, '.claude', 'rules');
    fs.mkdirSync(pendingDir, { recursive: true });
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(rulesDir, { recursive: true });
    mockCreate.mockReset();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('AC01: calls Haiku API and creates rule .md file from pending JSON', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse({
      title: 'Check null before method call',
      pattern: 'NEVER call methods on potentially null/undefined values without null check',
      applies_when: 'src/**/*.ts',
      category: 'MISSING_EDGE',
    }));

    makePendingFile('fix-001.json', makePendingData());

    const result = await processAutoRuleGen({ projectRoot: tmpDir });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
    expect(result.rules.length).toBe(1);

    // Verify rule file was created
    const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
    expect(ruleFiles.length).toBe(1);
  });

  it('AC02: created rule file contains Applies When, Enforcement: SOFT, Created, Rule-ID frontmatter', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse({
      title: 'Check null before method call',
      pattern: 'NEVER call methods on potentially null/undefined values without null check',
      applies_when: 'src/**/*.ts',
      category: 'MISSING_EDGE',
    }));

    makePendingFile('fix-002.json', makePendingData());

    const result = await processAutoRuleGen({ projectRoot: tmpDir });

    expect(result.rules.length).toBe(1);
    const ruleFiles = fs.readdirSync(rulesDir).filter(f => f.endsWith('.md'));
    const ruleContent = fs.readFileSync(path.join(rulesDir, ruleFiles[0]), 'utf-8');

    expect(ruleContent).toContain('Applies When:');
    expect(ruleContent).toContain('Enforcement: SOFT');
    expect(ruleContent).toContain('Created:');
    expect(ruleContent).toContain('Rule-ID:');
    expect(ruleContent).toContain('NEVER DO:');
    expect(ruleContent).toContain('WHY:');
  });

  it('AC03: successful pending file is moved to processed directory', async () => {
    mockCreate.mockResolvedValueOnce(makeApiResponse({
      title: 'Check null',
      pattern: 'NEVER call on null',
      applies_when: '**/*.ts',
      category: 'MISSING_EDGE',
    }));

    makePendingFile('fix-003.json', makePendingData());

    await processAutoRuleGen({ projectRoot: tmpDir });

    const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(pendingFiles.length).toBe(0);

    const processedFiles = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));
    expect(processedFiles.length).toBe(1);
    expect(processedFiles[0]).toBe('fix-003.json');
  });

  it('AC04: on API failure, pending is kept and retry_count incremented', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    makePendingFile('fix-004.json', makePendingData());

    const result = await processAutoRuleGen({ projectRoot: tmpDir });

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(1);

    const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(pendingFiles.length).toBe(1);

    const updated = JSON.parse(fs.readFileSync(path.join(pendingDir, 'fix-004.json'), 'utf-8'));
    expect(updated.retry_count).toBe(1);
  });

  it('AC05: file with retry_count > 3 is renamed to .failed extension', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API error'));

    makePendingFile('fix-005.json', makePendingData({ retry_count: 3 }));

    await processAutoRuleGen({ projectRoot: tmpDir });

    const jsonFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(jsonFiles.length).toBe(0);

    const failedFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.failed'));
    expect(failedFiles.length).toBe(1);
    expect(failedFiles[0]).toBe('fix-005.json.failed');
  });

  it('AC06: exits gracefully when ANTHROPIC_API_KEY is not set', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const result = await processAutoRuleGen({ projectRoot: tmpDir, requireApiKey: true });

      expect(result.skipped).toBe(true);
      expect(stderrSpy).toHaveBeenCalled();
    } finally {
      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      }
      stderrSpy.mockRestore();
    }
  });

  it('processes at most 5 pending files per run', async () => {
    for (let i = 0; i < 7; i++) {
      mockCreate.mockResolvedValueOnce(makeApiResponse({
        title: `Rule ${i}`,
        pattern: `NEVER do thing ${i}`,
        applies_when: '**/*.ts',
        category: 'LOGIC_ERROR',
      }));
    }

    for (let i = 0; i < 7; i++) {
      makePendingFile(`fix-${String(i).padStart(3, '0')}.json`, makePendingData());
    }

    const result = await processAutoRuleGen({ projectRoot: tmpDir });

    expect(mockCreate).toHaveBeenCalledTimes(5);
    expect(result.processed).toBe(5);

    const pendingFiles = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(pendingFiles.length).toBe(2);
  });
});
