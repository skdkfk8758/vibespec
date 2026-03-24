import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { generateId, hasColumn, nowISO, toDateOnly, buildUpdateQuery } from '../utils.js';

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

  describe('nowISO', () => {
    it('should return a valid ISO string', () => {
      const iso = nowISO();
      expect(new Date(iso).toISOString()).toBe(iso);
    });
  });

  describe('toDateOnly', () => {
    it('should extract date from ISO string', () => {
      expect(toDateOnly('2026-03-24T10:30:00.000Z')).toBe('2026-03-24');
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
});
