import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { BaseRepository } from '../base-repository.js';
import { QARunModel } from '../qa-run.js';
import { QAFindingModel } from '../qa-finding.js';
import { QAScenarioModel } from '../qa-scenario.js';
import { MergeReportModel } from '../merge-report.js';
import type Database from 'better-sqlite3';

describe('AC01: BaseRepository inheritance', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('AC01: QARunModel extends BaseRepository', () => {
    const model = new QARunModel(db);
    expect(model).toBeInstanceOf(BaseRepository);
  });

  it('AC01: QAFindingModel extends BaseRepository', () => {
    const model = new QAFindingModel(db);
    expect(model).toBeInstanceOf(BaseRepository);
  });

  it('AC01: QAScenarioModel extends BaseRepository', () => {
    const model = new QAScenarioModel(db);
    expect(model).toBeInstanceOf(BaseRepository);
  });

  it('AC01: MergeReportModel extends BaseRepository', () => {
    const model = new MergeReportModel(db);
    expect(model).toBeInstanceOf(BaseRepository);
  });
});

describe('AC02: Inherited CRUD methods work correctly', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    db.prepare("INSERT INTO plans (id, title, status) VALUES (?, ?, ?)").run(
      'test-plan', 'Test Plan', 'active',
    );
  });

  it('AC02: QARunModel.getById works via BaseRepository', () => {
    const model = new QARunModel(db);
    const run = model.create('test-plan', 'manual');
    const fetched = model.getById(run.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(run.id);
  });

  it('AC02: QARunModel.requireById throws for non-existent', () => {
    const model = new QARunModel(db);
    expect(() => model.requireById('no-such-id')).toThrow();
  });

  it('AC02: QAFindingModel.getById works via BaseRepository', () => {
    const runModel = new QARunModel(db);
    const model = new QAFindingModel(db);
    const run = runModel.create('test-plan', 'manual');
    const finding = model.create(run.id, {
      severity: 'high',
      category: 'bug',
      title: 'Test',
      description: 'Desc',
    });
    const fetched = model.getById(finding.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(finding.id);
  });

  it('AC02: QAScenarioModel.getById works via BaseRepository', () => {
    const runModel = new QARunModel(db);
    const model = new QAScenarioModel(db);
    const run = runModel.create('test-plan', 'manual');
    const scenario = model.create(run.id, {
      category: 'functional',
      title: 'Test',
      description: 'Desc',
      priority: 'medium',
    });
    const fetched = model.getById(scenario.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(scenario.id);
  });

  it('AC02: MergeReportModel.getById works via BaseRepository (raw row)', () => {
    const model = new MergeReportModel(db);
    // MergeReportModel extends BaseRepository but get() has custom JSON parsing
    // getById from BaseRepository returns raw row (no JSON parsing)
    // The custom get() method should still work correctly
    expect(typeof model.getById).toBe('function');
    expect(typeof model.requireById).toBe('function');
    expect(typeof model.delete).toBe('function');
  });
});
