import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeRecurringFindings } from '../qa-findings-analyzer.js';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type Database from 'better-sqlite3';

function insertPlan(db: Database.Database, id: string): void {
  db.prepare(
    'INSERT INTO plans (id, title, spec, status, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, 'Test Plan', 'spec', 'active', new Date().toISOString());
}

function insertQaRun(db: Database.Database, id: string, planId: string): void {
  db.prepare(
    `INSERT INTO qa_runs (id, plan_id, "trigger", status, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(id, planId, 'manual', 'completed', new Date().toISOString());
}

function insertQaFinding(
  db: Database.Database,
  id: string,
  runId: string,
  category: string,
  description: string,
): void {
  db.prepare(
    `INSERT INTO qa_findings (id, run_id, severity, category, title, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, runId, 'medium', category, 'Test Finding', description, 'open');
}

describe('analyzeRecurringFindings', () => {
  let db: Database.Database;
  let tmpDir: string;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-findings-test-'));
    // Create pending directory
    fs.mkdirSync(path.join(tmpDir, '.claude', 'self-improve', 'pending'), { recursive: true });
    // Insert a plan for FK reference
    insertPlan(db, 'plan-1');
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('AC01: should generate pending JSON when same category+similar description appears in 3+ qa_runs', () => {
    // Arrange: 3 different qa_runs with same category and similar description
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');
    insertQaRun(db, 'run-3', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Login button does not respond on mobile');
    insertQaFinding(db, 'f2', 'run-2', 'bug', 'Login button does not respond on mobile');
    insertQaFinding(db, 'f3', 'run-3', 'bug', 'Login button does not respond on mobile');

    // Act
    const result = analyzeRecurringFindings(db, tmpDir);

    // Assert
    expect(result.pendingCreated).toBeGreaterThanOrEqual(1);

    const pendingDir = path.join(tmpDir, '.claude', 'self-improve', 'pending');
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(1);

    const content = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf-8'));
    expect(content.category).toBe('bug');
    expect(content.finding_ids).toHaveLength(3);
    expect(content.finding_ids).toContain('f1');
    expect(content.finding_ids).toContain('f2');
    expect(content.finding_ids).toContain('f3');
    expect(content.repeat_count).toBe(3);
  });

  it('AC02: pending JSON type should be "recurring_qa_finding"', () => {
    // Arrange
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');
    insertQaRun(db, 'run-3', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'regression', 'API timeout on dashboard');
    insertQaFinding(db, 'f2', 'run-2', 'regression', 'API timeout on dashboard');
    insertQaFinding(db, 'f3', 'run-3', 'regression', 'API timeout on dashboard');

    // Act
    analyzeRecurringFindings(db, tmpDir);

    // Assert
    const pendingDir = path.join(tmpDir, '.claude', 'self-improve', 'pending');
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    const content = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf-8'));
    expect(content.type).toBe('recurring_qa_finding');
    expect(content.timestamp).toBeDefined();
  });

  it('AC03: should NOT generate pending when findings repeat less than 3 times across runs', () => {
    // Arrange: only 2 runs with same finding
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Some intermittent error');
    insertQaFinding(db, 'f2', 'run-2', 'bug', 'Some intermittent error');

    // Act
    const result = analyzeRecurringFindings(db, tmpDir);

    // Assert
    expect(result.pendingCreated).toBe(0);
    const pendingDir = path.join(tmpDir, '.claude', 'self-improve', 'pending');
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    expect(files.length).toBe(0);
  });

  it('AC03: should NOT generate pending when same run has multiple same findings (must be different runs)', () => {
    // Arrange: 3 findings in same run
    insertQaRun(db, 'run-1', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Repeated error within same run');
    insertQaFinding(db, 'f2', 'run-1', 'bug', 'Repeated error within same run');
    insertQaFinding(db, 'f3', 'run-1', 'bug', 'Repeated error within same run');

    // Act
    const result = analyzeRecurringFindings(db, tmpDir);

    // Assert
    expect(result.pendingCreated).toBe(0);
  });

  it('AC01: should group by substring match on description', () => {
    // Arrange: descriptions contain shared substring
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');
    insertQaRun(db, 'run-3', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Login button does not respond on mobile - Chrome');
    insertQaFinding(db, 'f2', 'run-2', 'bug', 'Login button does not respond on mobile - Safari');
    insertQaFinding(db, 'f3', 'run-3', 'bug', 'Login button does not respond on mobile - Firefox');

    // Act
    const result = analyzeRecurringFindings(db, tmpDir);

    // Assert: should detect the common substring pattern
    expect(result.pendingCreated).toBeGreaterThanOrEqual(1);
  });

  it('AC01: should return correct analyzed count', () => {
    // Arrange
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');
    insertQaRun(db, 'run-3', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Error A');
    insertQaFinding(db, 'f2', 'run-2', 'bug', 'Error A');
    insertQaFinding(db, 'f3', 'run-3', 'bug', 'Error A');
    insertQaFinding(db, 'f4', 'run-1', 'performance', 'Slow query');

    // Act
    const result = analyzeRecurringFindings(db, tmpDir);

    // Assert
    expect(result.analyzed).toBe(4);
  });

  it('AC01: pending JSON should have correct description_pattern field', () => {
    insertQaRun(db, 'run-1', 'plan-1');
    insertQaRun(db, 'run-2', 'plan-1');
    insertQaRun(db, 'run-3', 'plan-1');

    insertQaFinding(db, 'f1', 'run-1', 'bug', 'Timeout on payment page');
    insertQaFinding(db, 'f2', 'run-2', 'bug', 'Timeout on payment page');
    insertQaFinding(db, 'f3', 'run-3', 'bug', 'Timeout on payment page');

    analyzeRecurringFindings(db, tmpDir);

    const pendingDir = path.join(tmpDir, '.claude', 'self-improve', 'pending');
    const files = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    const content = JSON.parse(fs.readFileSync(path.join(pendingDir, files[0]), 'utf-8'));
    expect(content.description_pattern).toBe('Timeout on payment page');
  });
});
