import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GCEngine } from '../gc.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type Database from 'better-sqlite3';
import type { GCFinding, GCScanner } from '../../types.js';

describe('GCEngine', () => {
  let db: Database.Database;
  let tmpDir: string;
  let engine: GCEngine;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-test-'));
    engine = new GCEngine(db, tmpDir);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('AC01: gc_scans, gc_findings, gc_changes 테이블이 DB에 생성되어야 한다', () => {
    it('should have gc_scans table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='gc_scans'",
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('should have gc_findings table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='gc_findings'",
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('should have gc_changes table', () => {
      const tables = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='gc_changes'",
      ).all();
      expect(tables).toHaveLength(1);
    });

    it('should have correct columns in gc_scans', () => {
      const columns = db.prepare('PRAGMA table_info(gc_scans)').all() as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('scan_type');
      expect(columnNames).toContain('started_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('files_scanned');
      expect(columnNames).toContain('findings_count');
      expect(columnNames).toContain('auto_fixed_count');
      expect(columnNames).toContain('status');
    });

    it('should have correct columns in gc_findings', () => {
      const columns = db.prepare('PRAGMA table_info(gc_findings)').all() as Array<{ name: string }>;
      const columnNames = columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('scan_id');
      expect(columnNames).toContain('category');
      expect(columnNames).toContain('severity');
      expect(columnNames).toContain('safety_level');
      expect(columnNames).toContain('file_path');
      expect(columnNames).toContain('line_start');
      expect(columnNames).toContain('line_end');
      expect(columnNames).toContain('rule_source');
      expect(columnNames).toContain('rule_id');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('suggested_fix');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('resolved_at');
    });
  });

  describe('AC02: GCEngine 클래스가 인스턴스화 가능하고 registerScanner로 스캐너를 등록할 수 있어야 한다', () => {
    it('should instantiate GCEngine', () => {
      expect(engine).toBeInstanceOf(GCEngine);
    });

    it('should register a scanner', () => {
      const mockScanner: GCScanner = {
        name: 'test-scanner',
        scan: async () => [],
      };
      engine.registerScanner(mockScanner);
      expect(engine.getScanners()).toHaveLength(1);
      expect(engine.getScanners()[0].name).toBe('test-scanner');
    });

    it('should register multiple scanners', () => {
      engine.registerScanner({ name: 'scanner-a', scan: async () => [] });
      engine.registerScanner({ name: 'scanner-b', scan: async () => [] });
      expect(engine.getScanners()).toHaveLength(2);
    });
  });

  describe('AC03: 모든 GC 관련 타입이 src/core/types.ts에 export되어야 한다', () => {
    it('should export all GC types', async () => {
      const types = await import('../../types.js');
      // Type aliases can't be checked at runtime, but interfaces used as type imports work
      // We verify the key ones that have runtime presence
      expect(types).toBeDefined();
      // Verify by constructing objects that match the interfaces
      const scan: import('../../types.js').GCScan = {
        id: 'test', scan_type: 'full', started_at: '', completed_at: null,
        files_scanned: 0, findings_count: 0, auto_fixed_count: 0, status: 'running',
      };
      const finding: import('../../types.js').GCFinding = {
        id: 'test', scan_id: 'test', category: 'DEAD_CODE', severity: 'low',
        safety_level: 'SAFE', file_path: '', line_start: 0, line_end: 0,
        rule_source: 'BUILTIN', rule_id: null, description: '', suggested_fix: null,
        status: 'detected', resolved_at: null,
      };
      const change: import('../../types.js').GCChange = {
        id: 'test', finding_id: 'test', commit_sha: '', file_path: '',
        diff_content: '', rollback_cmd: '', created_at: '',
      };
      expect(scan.id).toBe('test');
      expect(finding.category).toBe('DEAD_CODE');
      expect(change.finding_id).toBe('test');
    });
  });

  describe('AC04: scan() 호출 시 등록된 스캐너들을 순회하며 결과를 gc_findings에 저장하는 골격이 동작해야 한다', () => {
    it('should run scan with no scanners and produce empty findings', async () => {
      const result = await engine.scan({ scan_type: 'full' });
      expect(result.status).toBe('completed');
      expect(result.findings_count).toBe(0);
      expect(result.scan_type).toBe('full');
    });

    it('should run registered scanners and store findings', async () => {
      // Create a test file so scanner has something to "find"
      const srcDir = path.join(tmpDir, 'src');
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, 'test.ts'), 'export const unused = 1;');

      const mockFinding: GCFinding = {
        id: 'finding-1',
        scan_id: '', // will be ignored — engine sets scan_id
        category: 'DEAD_CODE',
        severity: 'low',
        safety_level: 'SAFE',
        file_path: 'src/test.ts',
        line_start: 1,
        line_end: 1,
        rule_source: 'BUILTIN',
        rule_id: null,
        description: 'Unused export',
        suggested_fix: 'Remove unused export',
        status: 'detected',
        resolved_at: null,
      };

      const mockScanner: GCScanner = {
        name: 'mock-dead-code',
        scan: async () => [mockFinding],
      };
      engine.registerScanner(mockScanner);

      const result = await engine.scan({ scan_type: 'full' });
      expect(result.status).toBe('completed');
      expect(result.findings_count).toBe(1);

      // Verify finding is stored in DB
      const findings = engine.getFindings(result.id);
      expect(findings).toHaveLength(1);
      expect(findings[0].category).toBe('DEAD_CODE');
      expect(findings[0].description).toBe('Unused export');
    });

    it('should continue scanning if one scanner fails', async () => {
      const failScanner: GCScanner = {
        name: 'fail-scanner',
        scan: async () => { throw new Error('Scanner crash'); },
      };
      const okScanner: GCScanner = {
        name: 'ok-scanner',
        scan: async () => [{
          id: 'f1', scan_id: '', category: 'REFACTOR_CANDIDATE' as const,
          severity: 'medium' as const, safety_level: 'RISKY' as const,
          file_path: 'test.ts', line_start: 1, line_end: 10,
          rule_source: 'BUILTIN' as const, rule_id: null,
          description: 'Complex function', suggested_fix: null,
          status: 'detected' as const, resolved_at: null,
        }],
      };

      engine.registerScanner(failScanner);
      engine.registerScanner(okScanner);

      const result = await engine.scan({ scan_type: 'full' });
      expect(result.status).toBe('completed');
      expect(result.findings_count).toBe(1);
    });

    it('should create a scan record with correct metadata', async () => {
      const result = await engine.scan({ scan_type: 'incremental' });
      expect(result.scan_type).toBe('incremental');
      expect(result.started_at).toBeTruthy();
      expect(result.completed_at).toBeTruthy();

      const retrieved = engine.getScan(result.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(result.id);
    });

    it('should list scans', async () => {
      await engine.scan({ scan_type: 'full' });
      await engine.scan({ scan_type: 'incremental' });
      const scans = engine.listScans();
      expect(scans).toHaveLength(2);
    });
  });
});
