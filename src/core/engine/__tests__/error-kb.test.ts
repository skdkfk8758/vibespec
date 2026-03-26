import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorKBEngine } from '../error-kb.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

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
});
