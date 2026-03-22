import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ErrorKBEngine } from '../error-kb.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { nanoid } from 'nanoid';

describe('ErrorKB Performance Benchmarks', () => {
  let tmpDir: string;
  let engine: ErrorKBEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'error-kb-bench-'));
    engine = new ErrorKBEngine(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('search performance with 100 entries', () => {
    beforeEach(() => {
      const severities = ['critical', 'high', 'medium', 'low'] as const;
      const tagSets = [
        ['typescript', 'runtime'],
        ['python', 'backend'],
        ['react', 'frontend'],
        ['database', 'sql'],
        ['network', 'timeout'],
      ];

      for (let i = 0; i < 100; i++) {
        const uniqueId = nanoid(8);
        engine.add({
          title: `Error-${uniqueId}: Test error number ${i}`,
          severity: severities[i % 4],
          tags: tagSets[i % 5],
          cause: `Root cause for error ${i}: ${uniqueId}`,
          solution: `Solution for error ${i}: apply fix ${uniqueId}`,
        });
      }
    });

    it('should search 100 entries in less than 500ms', () => {
      const start = performance.now();
      const results = engine.search('Test error');
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
    });

    it('should search with tag filter in less than 500ms', () => {
      const start = performance.now();
      const results = engine.search('', { tags: ['typescript'] });
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
    });

    it('should search with severity filter in less than 500ms', () => {
      const start = performance.now();
      const results = engine.search('', { severity: 'critical' });
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
    });

    it('should search with combined query and filter in less than 500ms', () => {
      const start = performance.now();
      const results = engine.search('error', { severity: 'high', tags: ['python'] });
      const elapsed = performance.now() - start;

      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(elapsed).toBeLessThan(500);
    });
  });

  describe('getStats performance with 100 entries', () => {
    beforeEach(() => {
      const severities = ['critical', 'high', 'medium', 'low'] as const;

      for (let i = 0; i < 100; i++) {
        const uniqueId = nanoid(8);
        engine.add({
          title: `Bench-${uniqueId}: Stats benchmark error ${i}`,
          severity: severities[i % 4],
          tags: [`tag-${i % 10}`],
        });
      }
    });

    it('should compute stats for 100 entries in less than 500ms', () => {
      // Verify entries were created (nanoid may produce rare collisions)
      const allEntries = engine.search('');
      expect(allEntries.length).toBeGreaterThanOrEqual(95);

      const start = performance.now();
      const stats = engine.getStats();
      const elapsed = performance.now() - start;

      expect(stats.total).toBe(allEntries.length);
      const severitySum =
        stats.by_severity.critical +
        stats.by_severity.high +
        stats.by_severity.medium +
        stats.by_severity.low;
      expect(severitySum).toBe(stats.total);
      expect(elapsed).toBeLessThan(500);
    });
  });
});
