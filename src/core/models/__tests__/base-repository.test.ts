import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { BaseRepository } from '../base-repository.js';
import type Database from 'better-sqlite3';

interface TestEntity {
  id: string;
  name: string;
  value: number;
  created_at: string;
}

class TestModel extends BaseRepository<TestEntity> {
  constructor(db: Database.Database) {
    super(db, 'test_items');
  }
}

describe('BaseRepository', () => {
  let db: Database.Database;
  let model: TestModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    // Create a test table for our tests
    db.exec(`
      CREATE TABLE IF NOT EXISTS test_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    model = new TestModel(db);
  });

  describe('AC01: BaseRepository class exists', () => {
    it('AC01: BaseRepository should be importable and instantiable via subclass', () => {
      expect(model).toBeInstanceOf(BaseRepository);
    });
  });

  describe('AC02: 6 common methods are implemented', () => {
    it('AC02: getById returns entity when found', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      const result = model.getById('t1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('t1');
      expect(result!.name).toBe('item1');
      expect(result!.value).toBe(10);
    });

    it('AC02: getById returns null when not found', () => {
      const result = model.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('AC02: requireById returns entity when found', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      const result = model.requireById('t1');
      expect(result.id).toBe('t1');
      expect(result.name).toBe('item1');
    });

    it('AC02: list returns all entities', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t2', 'item2', 20);

      const result = model.list();
      expect(result).toHaveLength(2);
    });

    it('AC02: list returns empty array when no entities', () => {
      const result = model.list();
      expect(result).toEqual([]);
    });

    it('AC02: delete removes entity', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      model.delete('t1');
      expect(model.getById('t1')).toBeNull();
    });


    it('AC02: update modifies entity fields', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      const updated = model.update('t1', { name: 'updated_item', value: 99 });
      expect(updated.name).toBe('updated_item');
      expect(updated.value).toBe(99);
    });

    it('AC02: update with no changes returns entity unchanged', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      const result = model.update('t1', {});
      expect(result.name).toBe('item1');
      expect(result.value).toBe(10);
    });
  });

  describe('AC03: requireById throws when not found', () => {
    it('AC03: requireById throws Error with descriptive message when entity does not exist', () => {
      expect(() => model.requireById('nonexistent')).toThrow('not found: nonexistent');
    });
  });

  describe('AC04: all tests pass', () => {
    it('AC04: delete throws when entity does not exist', () => {
      expect(() => model.delete('nonexistent')).toThrow('not found: nonexistent');
    });

    it('AC04: update throws when entity does not exist', () => {
      expect(() => model.update('nonexistent', { name: 'x' })).toThrow('not found: nonexistent');
    });

    it('AC04: update with partial fields only changes specified fields', () => {
      db.prepare("INSERT INTO test_items (id, name, value) VALUES (?, ?, ?)").run('t1', 'item1', 10);

      const updated = model.update('t1', { name: 'changed' });
      expect(updated.name).toBe('changed');
      expect(updated.value).toBe(10); // unchanged
    });
  });
});
