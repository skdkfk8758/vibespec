import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorKBEngine } from '../../core/engine/error-kb.js';
import type { ErrorEntry, ErrorKBStats } from '../../core/types.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('ErrorKB E2E - Full Cycle', () => {
  let tmpDir: string;
  let engine: ErrorKBEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-kb-e2e-'));
    engine = new ErrorKBEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('add -> show -> search -> update --occurrence -> stats -> delete full cycle', () => {
    it('should complete the full lifecycle of an error entry', () => {
      // 1. ADD - Create an error entry
      const added = engine.add({
        title: 'E2E Test: NullPointerException in UserService',
        severity: 'critical',
        tags: ['java', 'backend', 'e2e'],
        cause: 'User object not validated before access',
        solution: 'Add null check in UserService.getProfile()',
      });

      expect(added.id).toBeTruthy();
      expect(added.id).toHaveLength(12);
      expect(added.title).toBe('E2E Test: NullPointerException in UserService');
      expect(added.severity).toBe('critical');
      expect(added.tags).toEqual(['java', 'backend', 'e2e']);
      expect(added.status).toBe('open');
      expect(added.occurrences).toBe(1);

      // 2. SHOW - Retrieve the entry by ID
      const shown = engine.show(added.id);
      expect(shown).not.toBeNull();
      expect(shown!.id).toBe(added.id);
      expect(shown!.title).toBe(added.title);
      expect(shown!.severity).toBe('critical');
      expect(shown!.tags).toEqual(['java', 'backend', 'e2e']);
      expect(shown!.content).toContain('User object not validated before access');
      expect(shown!.content).toContain('Add null check in UserService.getProfile()');

      // 3. SEARCH - Find the entry by query
      const searchByTitle = engine.search('NullPointerException');
      expect(searchByTitle).toHaveLength(1);
      expect(searchByTitle[0].id).toBe(added.id);

      const searchByTag = engine.search('', { tags: ['e2e'] });
      expect(searchByTag).toHaveLength(1);
      expect(searchByTag[0].id).toBe(added.id);

      const searchBySeverity = engine.search('', { severity: 'critical' });
      expect(searchBySeverity).toHaveLength(1);
      expect(searchBySeverity[0].id).toBe(added.id);

      // 4. UPDATE --occurrence - Record additional occurrences
      engine.recordOccurrence(added.id, 'Occurred again in production deploy #42');
      engine.recordOccurrence(added.id, 'Occurred in staging environment');

      const afterOccurrence = engine.show(added.id);
      expect(afterOccurrence!.occurrences).toBe(3);
      expect(afterOccurrence!.content).toContain('## History');
      expect(afterOccurrence!.content).toContain('Occurred again in production deploy #42');
      expect(afterOccurrence!.content).toContain('Occurred in staging environment');

      // 5. STATS - Check statistics reflect the entry
      const stats = engine.getStats();
      expect(stats.total).toBe(1);
      expect(stats.by_severity.critical).toBe(1);
      expect(stats.by_status.open).toBe(1);
      expect(stats.top_recurring).toHaveLength(1);
      expect(stats.top_recurring[0].id).toBe(added.id);
      expect(stats.top_recurring[0].occurrences).toBe(3);

      // 6. DELETE - Remove the entry
      const deleted = engine.delete(added.id);
      expect(deleted).toBe(true);

      // Verify deletion
      expect(engine.show(added.id)).toBeNull();
      expect(engine.search('NullPointerException')).toHaveLength(0);

      const statsAfterDelete = engine.getStats();
      expect(statsAfterDelete.total).toBe(0);
    });
  });

  describe('multiple entries lifecycle', () => {
    it('should handle add and search across multiple entries', () => {
      const entry1 = engine.add({
        title: 'TypeError: undefined is not a function',
        severity: 'high',
        tags: ['javascript', 'runtime'],
        cause: 'Calling method on undefined object',
        solution: 'Check object existence before method call',
      });

      const entry2 = engine.add({
        title: 'CORS policy error',
        severity: 'medium',
        tags: ['network', 'security'],
        cause: 'Missing CORS headers on backend',
        solution: 'Configure CORS middleware',
      });

      const entry3 = engine.add({
        title: 'OutOfMemoryError in data processing',
        severity: 'critical',
        tags: ['java', 'performance'],
        cause: 'Loading entire dataset into memory',
        solution: 'Use streaming/pagination',
      });

      // Search across all
      const allEntries = engine.search('');
      expect(allEntries).toHaveLength(3);

      // Search by tag
      const javaEntries = engine.search('', { tags: ['java'] });
      expect(javaEntries).toHaveLength(1);
      expect(javaEntries[0].id).toBe(entry3.id);

      // Search by severity
      const criticalEntries = engine.search('', { severity: 'critical' });
      expect(criticalEntries).toHaveLength(1);
      expect(criticalEntries[0].id).toBe(entry3.id);

      // Update one entry status
      engine.update(entry1.id, { status: 'resolved' });
      const updated = engine.show(entry1.id);
      expect(updated!.status).toBe('resolved');

      // Stats reflect all entries
      const stats = engine.getStats();
      expect(stats.total).toBe(3);
      expect(stats.by_severity.critical).toBe(1);
      expect(stats.by_severity.high).toBe(1);
      expect(stats.by_severity.medium).toBe(1);
      expect(stats.by_status.open).toBe(2);
      expect(stats.by_status.resolved).toBe(1);

      // Delete one, verify stats update
      engine.delete(entry2.id);
      const statsAfter = engine.getStats();
      expect(statsAfter.total).toBe(2);
    });
  });

  describe('JSON output format validation', () => {
    it('should produce JSON-parseable output from ErrorEntry', () => {
      const added = engine.add({
        title: 'JSON Format Test Error',
        severity: 'low',
        tags: ['test'],
        cause: 'Testing JSON output',
        solution: 'Verify JSON format',
      });

      const entry = engine.show(added.id);
      expect(entry).not.toBeNull();

      // Verify the entry can be serialized to valid JSON and parsed back
      const jsonStr = JSON.stringify(entry);
      const parsed = JSON.parse(jsonStr) as ErrorEntry;

      expect(parsed.id).toBe(entry!.id);
      expect(parsed.title).toBe(entry!.title);
      expect(parsed.severity).toBe(entry!.severity);
      expect(parsed.tags).toEqual(entry!.tags);
      expect(parsed.status).toBe(entry!.status);
      expect(parsed.occurrences).toBe(entry!.occurrences);
      expect(parsed.first_seen).toBe(entry!.first_seen);
      expect(parsed.last_seen).toBe(entry!.last_seen);
      expect(parsed.content).toBe(entry!.content);
    });

    it('should produce JSON-parseable output from ErrorKBStats', () => {
      engine.add({ title: 'Stats JSON Test', severity: 'high', tags: ['test'] });

      const stats = engine.getStats();
      const jsonStr = JSON.stringify(stats);
      const parsed = JSON.parse(jsonStr) as ErrorKBStats;

      expect(parsed.total).toBe(stats.total);
      expect(parsed.by_severity).toEqual(stats.by_severity);
      expect(parsed.by_status).toEqual(stats.by_status);
      expect(parsed.top_recurring).toEqual(stats.top_recurring);
    });

    it('should produce JSON-parseable output from search results array', () => {
      engine.add({ title: 'Search JSON Test 1', severity: 'low', tags: [] });
      engine.add({ title: 'Search JSON Test 2', severity: 'high', tags: [] });

      const results = engine.search('Search JSON Test');
      const jsonStr = JSON.stringify(results);
      const parsed = JSON.parse(jsonStr) as ErrorEntry[];

      expect(parsed).toHaveLength(2);
      expect(parsed[0].id).toBeTruthy();
      expect(parsed[1].id).toBeTruthy();
    });
  });

  describe('empty KB behavior', () => {
    it('should return empty array when searching empty KB', () => {
      const results = engine.search('anything');
      expect(results).toHaveLength(0);
    });

    it('should return all-zero stats when KB is empty', () => {
      const stats = engine.getStats();
      expect(stats.total).toBe(0);
      expect(stats.by_severity.critical).toBe(0);
      expect(stats.by_severity.high).toBe(0);
      expect(stats.by_severity.medium).toBe(0);
      expect(stats.by_severity.low).toBe(0);
      expect(stats.by_status.open).toBe(0);
      expect(stats.by_status.resolved).toBe(0);
      expect(stats.by_status.recurring).toBe(0);
      expect(stats.by_status.wontfix).toBe(0);
      expect(stats.top_recurring).toHaveLength(0);
    });

    it('should return empty array when searching empty KB with filters', () => {
      const byTag = engine.search('', { tags: ['nonexistent'] });
      expect(byTag).toHaveLength(0);

      const bySeverity = engine.search('', { severity: 'critical' });
      expect(bySeverity).toHaveLength(0);
    });
  });
});
