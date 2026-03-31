import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { setConfig, getConfig } from '../../config.js';
import { ConfigValidationError } from '../../config-schema.js';
import type Database from 'better-sqlite3';

describe('setConfig with schema validation', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
  });

  it('AC01: rejects invalid boolean config value', () => {
    expect(() => setConfig(db, 'careful.enabled', 'yes')).toThrow(ConfigValidationError);
  });

  it('AC01: rejects invalid freeze.enabled value', () => {
    expect(() => setConfig(db, 'freeze.enabled', '1')).toThrow(ConfigValidationError);
  });

  it('AC01: rejects empty freeze.path', () => {
    expect(() => setConfig(db, 'freeze.path', '')).toThrow(ConfigValidationError);
  });

  it('AC02: accepts valid boolean config "true"', () => {
    setConfig(db, 'careful.enabled', 'true');
    expect(getConfig(db, 'careful.enabled')).toBe('true');
  });

  it('AC02: accepts valid boolean config "false"', () => {
    setConfig(db, 'freeze.enabled', 'false');
    expect(getConfig(db, 'freeze.enabled')).toBe('false');
  });

  it('AC02: accepts valid freeze.path', () => {
    setConfig(db, 'freeze.path', '/some/valid/path');
    expect(getConfig(db, 'freeze.path')).toBe('/some/valid/path');
  });

  it('AC02: accepts unknown keys with any value', () => {
    setConfig(db, 'custom.setting', 'anything');
    expect(getConfig(db, 'custom.setting')).toBe('anything');
  });

  it('AC03: existing getConfig still works', () => {
    setConfig(db, 'careful.enabled', 'true');
    const val = getConfig(db, 'careful.enabled');
    expect(val).toBe('true');
  });

  it('AC03: existing config functions are unaffected for valid data', () => {
    setConfig(db, 'guard.enabled', 'false');
    expect(getConfig(db, 'guard.enabled')).toBe('false');
    setConfig(db, 'guard.enabled', 'true');
    expect(getConfig(db, 'guard.enabled')).toBe('true');
  });
});
