import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { generateId, hasColumn, buildUpdateQuery, validateTransition, InvalidTransitionError } from '../utils.js';

describe('utils', () => {
  describe('generateId', () => {
    it('should return a 12-character string', () => {
      const id = generateId();
      expect(id).toHaveLength(12);
      expect(typeof id).toBe('string');
    });

    it('should return unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('hasColumn', () => {
    it('should return true for existing column', () => {
      const db = new Database(':memory:');
      db.exec('CREATE TABLE test (id TEXT, name TEXT)');
      expect(hasColumn(db, 'test', 'id')).toBe(true);
      expect(hasColumn(db, 'test', 'name')).toBe(true);
      db.close();
    });

    it('should return false for non-existing column', () => {
      const db = new Database(':memory:');
      db.exec('CREATE TABLE test (id TEXT)');
      expect(hasColumn(db, 'test', 'missing')).toBe(false);
      db.close();
    });
  });

  describe('buildUpdateQuery', () => {
    it('should build UPDATE query from fields', () => {
      const result = buildUpdateQuery('plans', 'abc', { title: 'New', summary: 'Sum' });
      expect(result).not.toBeNull();
      expect(result!.sql).toBe('UPDATE plans SET title = ?, summary = ? WHERE id = ?');
      expect(result!.params).toEqual(['New', 'Sum', 'abc']);
    });

    it('should skip undefined fields', () => {
      const result = buildUpdateQuery('plans', 'abc', { title: 'New', summary: undefined });
      expect(result!.sql).toBe('UPDATE plans SET title = ? WHERE id = ?');
      expect(result!.params).toEqual(['New', 'abc']);
    });

    it('should return null when no fields to update', () => {
      const result = buildUpdateQuery('plans', 'abc', { title: undefined });
      expect(result).toBeNull();
    });
  });

  describe('validateTransition', () => {
    const allowed = {
      draft: ['active'],
      active: ['completed'],
      completed: [],
    };

    it('AC01: should allow valid transition', () => {
      expect(() => validateTransition(allowed, 'draft', 'active')).not.toThrow();
    });

    it('AC02: should throw InvalidTransitionError with current/target in message', () => {
      expect(() => validateTransition(allowed, 'draft', 'completed')).toThrow(InvalidTransitionError);
      try {
        validateTransition(allowed, 'draft', 'completed');
      } catch (e) {
        expect((e as Error).message).toContain('draft');
        expect((e as Error).message).toContain('completed');
      }
    });

    it('AC02: should throw for terminal state transitions', () => {
      expect(() => validateTransition(allowed, 'completed', 'active')).toThrow(InvalidTransitionError);
    });

    it('AC03: should allow transition when force:true', () => {
      expect(() => validateTransition(allowed, 'completed', 'draft', { force: true })).not.toThrow();
    });

    it('should be a no-op for same state transition', () => {
      expect(() => validateTransition(allowed, 'active', 'active')).not.toThrow();
    });

    it('should throw for unknown current state', () => {
      expect(() => validateTransition(allowed, 'unknown', 'active')).toThrow(InvalidTransitionError);
    });
  });
});
