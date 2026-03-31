import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ErrorKBEngine } from '../error-kb.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { VectorSearchResult, AddResult } from '../../types.js';

// Mock embeddings module
vi.mock('../embeddings.js', () => {
  // Create predictable embeddings based on content keywords
  const makeEmbedding = (text: string): Float32Array => {
    const arr = new Float32Array(384).fill(0);
    const lower = text.toLowerCase();
    // "deploy failure" and "배포 실패" get similar embeddings
    if (lower.includes('deploy') || lower.includes('배포') || lower.includes('failure') || lower.includes('실패')) {
      arr[0] = 0.9; arr[1] = 0.8; arr[2] = 0.7;
    }
    // "auth" / "TypeError" gets a different pattern
    if (lower.includes('auth') || lower.includes('typeerror')) {
      arr[10] = 0.9; arr[11] = 0.8;
    }
    // "connection" / "timeout"
    if (lower.includes('connection') || lower.includes('timeout')) {
      arr[20] = 0.9; arr[21] = 0.8;
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < arr.length; i++) norm += arr[i] * arr[i];
    norm = Math.sqrt(norm);
    if (norm > 0) for (let i = 0; i < arr.length; i++) arr[i] /= norm;
    return arr;
  };

  return {
    generateEmbedding: vi.fn().mockImplementation(async (text: string) => makeEmbedding(text)),
    cosineSimilarity: vi.fn().mockImplementation((a: Float32Array, b: Float32Array) => {
      let dot = 0, normA = 0, normB = 0;
      for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
      }
      const denom = Math.sqrt(normA) * Math.sqrt(normB);
      return denom === 0 ? 0 : dot / denom;
    }),
    loadVec: vi.fn().mockReturnValue(false),
    isVecAvailable: vi.fn().mockReturnValue(false),
    initModel: vi.fn().mockResolvedValue(undefined),
    _resetPipeline: vi.fn(),
  };
});

describe('ErrorKBEngine', () => {
  let tmpDir: string;
  let engine: ErrorKBEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-kb-test-'));
    engine = new ErrorKBEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('constructor - directory auto-creation', () => {
    it('should create .claude/error-kb/errors/ directory if not exists', () => {
      const errorsDir = path.join(tmpDir, '.claude', 'error-kb', 'errors');
      expect(fs.existsSync(errorsDir)).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      expect(() => new ErrorKBEngine(tmpDir)).not.toThrow();
    });
  });

  describe('add', () => {
    it('should create a markdown file with correct frontmatter and body', () => {
      const entry = engine.add({
        title: 'TypeError: Cannot read property of undefined',
        severity: 'high',
        tags: ['typescript', 'runtime'],
        cause: 'Accessing nested property without null check',
        solution: 'Add optional chaining operator',
      });

      expect(entry.id).toHaveLength(12);
      expect(entry.title).toBe('TypeError: Cannot read property of undefined');
      expect(entry.severity).toBe('high');
      expect(entry.tags).toEqual(['typescript', 'runtime']);
      expect(entry.status).toBe('open');
      expect(entry.occurrences).toBe(1);
      expect(entry.first_seen).toBeTruthy();
      expect(entry.last_seen).toBeTruthy();

      // Verify file exists
      const filePath = path.join(tmpDir, '.claude', 'error-kb', 'errors', `${entry.id}.md`);
      expect(fs.existsSync(filePath)).toBe(true);

      // Verify file content has frontmatter structure
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('---');
      expect(content).toContain('title: TypeError: Cannot read property of undefined');
      expect(content).toContain('severity: high');
      expect(content).toContain('status: open');
      expect(content).toContain('## Cause');
      expect(content).toContain('Accessing nested property without null check');
      expect(content).toContain('## Solution');
      expect(content).toContain('Add optional chaining operator');
    });

    it('should create a file without cause/solution sections when not provided', () => {
      const entry = engine.add({
        title: 'Simple error',
        severity: 'low',
        tags: [],
      });

      const filePath = path.join(tmpDir, '.claude', 'error-kb', 'errors', `${entry.id}.md`);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).not.toContain('## Cause');
      expect(content).not.toContain('## Solution');
    });
  });

  describe('show', () => {
    it('should parse a file into an ErrorEntry object', () => {
      const added = engine.add({
        title: 'Test Error',
        severity: 'medium',
        tags: ['test'],
        cause: 'Test cause',
        solution: 'Test solution',
      });

      const entry = engine.show(added.id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(added.id);
      expect(entry!.title).toBe('Test Error');
      expect(entry!.severity).toBe('medium');
      expect(entry!.tags).toEqual(['test']);
      expect(entry!.status).toBe('open');
      expect(entry!.occurrences).toBe(1);
      expect(entry!.content).toContain('## Cause');
      expect(entry!.content).toContain('Test cause');
    });

    it('should return null for non-existent id', () => {
      const entry = engine.show('nonexistent1');
      expect(entry).toBeNull();
    });
  });

  describe('search', () => {
    beforeEach(() => {
      engine.add({
        title: 'TypeError in auth module',
        severity: 'critical',
        tags: ['typescript', 'auth'],
        cause: 'Missing null check',
      });
      engine.add({
        title: 'Connection timeout',
        severity: 'high',
        tags: ['network', 'database'],
        cause: 'Database pool exhausted',
      });
      engine.add({
        title: 'CSS layout broken',
        severity: 'low',
        tags: ['css', 'frontend'],
        cause: 'Flexbox issue',
      });
    });

    it('should search by text query in title and content', () => {
      const results = engine.search('auth');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('auth');
    });

    it('should search by text in content body', () => {
      const results = engine.search('Flexbox');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('CSS');
    });

    it('should filter by tag', () => {
      const results = engine.search('', { tags: ['typescript'] });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('typescript');
    });

    it('should filter by severity', () => {
      const results = engine.search('', { severity: 'critical' });
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe('critical');
    });

    it('should combine text search with filters', () => {
      const results = engine.search('timeout', { severity: 'high' });
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('timeout');
    });

    it('should return empty array when no matches', () => {
      const results = engine.search('nonexistent query xyz');
      expect(results).toHaveLength(0);
    });

    it('should return all entries when query is empty and no filters', () => {
      const results = engine.search('');
      expect(results).toHaveLength(3);
    });
  });

  describe('update', () => {
    it('should update frontmatter fields while preserving body content', () => {
      const added = engine.add({
        title: 'Original Error',
        severity: 'low',
        tags: ['test'],
        cause: 'Original cause',
      });

      engine.update(added.id, { severity: 'high', status: 'resolved' });

      const updated = engine.show(added.id);
      expect(updated!.severity).toBe('high');
      expect(updated!.status).toBe('resolved');
      // Body should be preserved
      expect(updated!.content).toContain('Original cause');
      // Title should not change
      expect(updated!.title).toBe('Original Error');
    });

    it('should update occurrences count', () => {
      const added = engine.add({
        title: 'Counting Error',
        severity: 'medium',
        tags: [],
      });

      engine.update(added.id, { occurrences: 5 });

      const updated = engine.show(added.id);
      expect(updated!.occurrences).toBe(5);
    });
  });

  describe('recordOccurrence', () => {
    it('should increment occurrences and update last_seen', () => {
      const added = engine.add({
        title: 'Recurring Error',
        severity: 'medium',
        tags: ['recur'],
      });

      // Small delay to ensure different timestamp
      engine.recordOccurrence(added.id, 'Happened again in module X');

      const updated = engine.show(added.id);
      expect(updated!.occurrences).toBe(2);
      expect(updated!.last_seen).toBeTruthy();
    });

    it('should append context to history section', () => {
      const added = engine.add({
        title: 'History Error',
        severity: 'high',
        tags: [],
      });

      engine.recordOccurrence(added.id, 'First occurrence context');
      engine.recordOccurrence(added.id, 'Second occurrence context');

      const entry = engine.show(added.id);
      expect(entry!.content).toContain('## History');
      expect(entry!.content).toContain('First occurrence context');
      expect(entry!.content).toContain('Second occurrence context');
      expect(entry!.occurrences).toBe(3);
    });
  });

  describe('getStats', () => {
    it('should return statistics across all error entries', () => {
      const e1 = engine.add({ title: 'Error 1', severity: 'critical', tags: ['a'] });
      const e2 = engine.add({ title: 'Error 2', severity: 'high', tags: ['b'] });
      const e3 = engine.add({ title: 'Error 3', severity: 'high', tags: ['c'] });
      const e4 = engine.add({ title: 'Error 4', severity: 'low', tags: ['d'] });

      // Verify all 4 entries were created with unique IDs
      const ids = new Set([e1.id, e2.id, e3.id, e4.id]);
      expect(ids.size).toBe(4);

      // Verify all 4 files exist on disk
      const files = engine.listErrorFiles();
      expect(files).toHaveLength(4);

      // Make Error 1 recurring
      engine.recordOccurrence(e1.id, 'Again 1');
      engine.recordOccurrence(e1.id, 'Again 2');

      const stats = engine.getStats();
      expect(stats.total).toBe(4);
      expect(stats.by_severity.critical).toBe(1);
      expect(stats.by_severity.high).toBe(2);
      expect(stats.by_severity.low).toBe(1);
      expect(stats.by_severity.medium).toBe(0);
      expect(stats.top_recurring).toHaveLength(4);
      expect(stats.top_recurring[0].occurrences).toBe(3);
      expect(stats.top_recurring[0].title).toBe('Error 1');
    });

    it('should return empty stats when no entries exist', () => {
      const stats = engine.getStats();
      expect(stats.total).toBe(0);
      expect(stats.by_severity.critical).toBe(0);
      expect(stats.top_recurring).toHaveLength(0);
    });
  });

  describe('frontmatter parsing fallback', () => {
    it('should handle malformed frontmatter without throwing', () => {
      // Manually create a file with bad frontmatter
      const errorsDir = path.join(tmpDir, '.claude', 'error-kb', 'errors');
      const id = 'badformat123';
      const filePath = path.join(errorsDir, `${id}.md`);
      fs.writeFileSync(filePath, 'This file has no frontmatter at all\nJust plain text');

      const entry = engine.show(id);
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe(id);
      expect(entry!.content).toContain('This file has no frontmatter at all');
      // Should have default/fallback values
      expect(entry!.title).toBe('');
      expect(entry!.severity).toBe('medium');
      expect(entry!.tags).toEqual([]);
      expect(entry!.status).toBe('open');
      expect(entry!.occurrences).toBe(0);
    });

    it('should handle partially valid frontmatter', () => {
      const errorsDir = path.join(tmpDir, '.claude', 'error-kb', 'errors');
      const id = 'partial12345';
      const filePath = path.join(errorsDir, `${id}.md`);
      fs.writeFileSync(
        filePath,
        `---
title: Partial Entry
severity: high
---

Some content here`,
      );

      const entry = engine.show(id);
      expect(entry).not.toBeNull();
      expect(entry!.title).toBe('Partial Entry');
      expect(entry!.severity).toBe('high');
      expect(entry!.tags).toEqual([]);
      expect(entry!.status).toBe('open');
    });
  });

  describe('_index.md auto-update', () => {
    it('should update _index.md when adding an entry', () => {
      engine.add({ title: 'Index Test Error', severity: 'high', tags: ['test'] });

      const indexPath = path.join(tmpDir, '.claude', 'error-kb', '_index.md');
      expect(fs.existsSync(indexPath)).toBe(true);

      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('Total: 1');
    });

    it('should reflect updated stats after multiple adds', () => {
      engine.add({ title: 'Error A', severity: 'high', tags: [] });
      engine.add({ title: 'Error B', severity: 'low', tags: [] });

      const indexPath = path.join(tmpDir, '.claude', 'error-kb', '_index.md');
      const content = fs.readFileSync(indexPath, 'utf-8');
      expect(content).toContain('Total: 2');
    });
  });

  describe('security - path traversal prevention', () => {
    it('should return null for path traversal attempts in show()', () => {
      expect(engine.show('../../etc/passwd')).toBeNull();
      expect(engine.show('../.env')).toBeNull();
      expect(engine.show('foo/bar')).toBeNull();
    });

    it('should ignore path traversal attempts in update()', () => {
      engine.update('../../etc/passwd', { severity: 'critical' });
      // Should not throw
    });

    it('should ignore path traversal attempts in recordOccurrence()', () => {
      engine.recordOccurrence('../../etc/passwd', 'attack');
      // Should not throw
    });
  });

  describe('delete', () => {
    it('should delete an existing error entry', () => {
      const added = engine.add({ title: 'To Delete', severity: 'low', tags: [] });
      expect(engine.show(added.id)).not.toBeNull();

      const result = engine.delete(added.id);
      expect(result).toBe(true);
      expect(engine.show(added.id)).toBeNull();
    });

    it('should return false for non-existent entry', () => {
      expect(engine.delete('nonexistent1')).toBe(false);
    });

    it('should return false for invalid id', () => {
      expect(engine.delete('../../etc/passwd')).toBe(false);
    });
  });

  describe('searchSemantic', () => {
    it('AC01: searchSemantic("배포 실패")가 "deploy failure" 에러를 유사도 기반으로 반환한다', async () => {
      engine.add({
        title: 'deploy failure on production',
        severity: 'critical',
        tags: ['deploy'],
        cause: 'Docker image build failed',
        solution: 'Fix Dockerfile',
      });
      engine.add({
        title: 'CSS layout broken',
        severity: 'low',
        tags: ['css'],
        cause: 'Flexbox issue',
      });

      // Index embeddings before semantic search
      await engine.initEmbeddings();

      const results: VectorSearchResult[] = await engine.searchSemantic('배포 실패');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].entry.title).toContain('deploy failure');
      expect(results[0].similarity).toBeGreaterThan(0);
    });

    it('AC01: searchSemantic returns empty array when no entries exist', async () => {
      const results = await engine.searchSemantic('test query');
      expect(results).toEqual([]);
    });
  });

  describe('searchHybrid', () => {
    it('AC02: searchHybrid가 텍스트+벡터 결과를 합산하여 반환한다', async () => {
      engine.add({
        title: 'deploy failure on production',
        severity: 'critical',
        tags: ['deploy'],
        cause: 'Docker image build failed',
        solution: 'Fix Dockerfile',
      });
      engine.add({
        title: 'TypeError in auth module',
        severity: 'high',
        tags: ['typescript'],
        cause: 'Missing null check',
      });
      engine.add({
        title: 'Connection timeout',
        severity: 'high',
        tags: ['network'],
        cause: 'Database pool exhausted',
      });

      await engine.initEmbeddings();

      const results: VectorSearchResult[] = await engine.searchHybrid('deploy failure');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The deploy failure entry should be top-ranked (matched by both text and semantic)
      expect(results[0].entry.title).toContain('deploy failure');
      expect(results[0].similarity).toBeGreaterThan(0);
    });

    it('AC02: searchHybrid deduplicates by error ID', async () => {
      engine.add({
        title: 'deploy failure on production',
        severity: 'critical',
        tags: ['deploy'],
        cause: 'Docker image build failed',
      });

      await engine.initEmbeddings();

      const results = await engine.searchHybrid('deploy failure');
      const ids = results.map(r => r.entry.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });

  describe('initEmbeddings', () => {
    it('AC03: initEmbeddings가 기존 N개 엔트리를 임베딩하고 { indexed: N, skipped: 0 }을 반환한다', async () => {
      engine.add({ title: 'Error 1', severity: 'high', tags: [] });
      engine.add({ title: 'Error 2', severity: 'medium', tags: [] });
      engine.add({ title: 'Error 3', severity: 'low', tags: [] });

      const result = await engine.initEmbeddings();
      expect(result).toEqual({ indexed: 3, skipped: 0 });
    });

    it('AC03: initEmbeddings skips already-indexed entries on second call', async () => {
      engine.add({ title: 'Error 1', severity: 'high', tags: [] });

      const first = await engine.initEmbeddings();
      expect(first).toEqual({ indexed: 1, skipped: 0 });

      const second = await engine.initEmbeddings();
      expect(second).toEqual({ indexed: 0, skipped: 1 });
    });
  });

  describe('add with duplicate detection', () => {
    it('AC04: add() 시 유사도 >= 0.85 엔트리가 있으면 duplicateWarning이 반환된다', async () => {
      // First add a deploy failure entry and index it
      engine.add({
        title: 'deploy failure on production',
        severity: 'critical',
        tags: ['deploy'],
        cause: 'Docker image build failed',
        solution: 'Fix Dockerfile',
      });
      await engine.initEmbeddings();

      // Now add a very similar entry
      const result: AddResult = await engine.addWithDuplicateCheck({
        title: 'deploy failure in staging',
        severity: 'high',
        tags: ['deploy'],
        cause: 'Docker build error',
        solution: 'Fix Dockerfile config',
      });

      expect(result.entry).toBeDefined();
      expect(result.entry.title).toBe('deploy failure in staging');
      expect(result.duplicateWarning).toBeDefined();
      expect(typeof result.duplicateWarning).toBe('string');
    });

    it('AC04: add() 시 유사하지 않은 엔트리는 duplicateWarning이 없다', async () => {
      engine.add({
        title: 'deploy failure on production',
        severity: 'critical',
        tags: ['deploy'],
        cause: 'Docker image build failed',
      });
      await engine.initEmbeddings();

      const result: AddResult = await engine.addWithDuplicateCheck({
        title: 'TypeError in auth module',
        severity: 'high',
        tags: ['typescript'],
        cause: 'Missing null check',
      });

      expect(result.entry).toBeDefined();
      expect(result.duplicateWarning).toBeUndefined();
    });
  });

  describe('search fallback', () => {
    it('AC05: vec 미사용 시 search()가 기존 텍스트 검색으로 동작한다', () => {
      engine.add({
        title: 'TypeError in auth module',
        severity: 'critical',
        tags: ['typescript', 'auth'],
        cause: 'Missing null check',
      });
      engine.add({
        title: 'Connection timeout',
        severity: 'high',
        tags: ['network'],
        cause: 'Database pool exhausted',
      });

      // Without vec, search should use text-only
      const results = engine.search('auth');
      expect(results).toHaveLength(1);
      expect(results[0].title).toContain('auth');
    });

    it('AC05: search with tag filter still works without vec', () => {
      engine.add({
        title: 'Error A',
        severity: 'high',
        tags: ['typescript'],
      });
      engine.add({
        title: 'Error B',
        severity: 'low',
        tags: ['css'],
      });

      const results = engine.search('', { tags: ['typescript'] });
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain('typescript');
    });
  });
});
