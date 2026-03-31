import { describe, it, expect } from 'vitest';
import { validateConfigEntry, ConfigValidationError } from '../../config-schema.js';

describe('ConfigSchema', () => {
  describe('boolean config keys', () => {
    it('AC01: ConfigSchema file exists and exports validateConfigEntry', () => {
      expect(typeof validateConfigEntry).toBe('function');
    });

    it('AC02: careful.enabled accepts "true"', () => {
      expect(() => validateConfigEntry('careful.enabled', 'true')).not.toThrow();
    });

    it('AC02: careful.enabled accepts "false"', () => {
      expect(() => validateConfigEntry('careful.enabled', 'false')).not.toThrow();
    });

    it('AC02: careful.enabled rejects invalid value', () => {
      expect(() => validateConfigEntry('careful.enabled', 'yes')).toThrow(ConfigValidationError);
    });

    it('AC02: freeze.enabled accepts "true"/"false"', () => {
      expect(() => validateConfigEntry('freeze.enabled', 'true')).not.toThrow();
      expect(() => validateConfigEntry('freeze.enabled', 'false')).not.toThrow();
    });

    it('AC02: freeze.enabled rejects invalid value', () => {
      expect(() => validateConfigEntry('freeze.enabled', '1')).toThrow(ConfigValidationError);
    });

    it('AC02: guard.enabled accepts "true"/"false"', () => {
      expect(() => validateConfigEntry('guard.enabled', 'true')).not.toThrow();
      expect(() => validateConfigEntry('guard.enabled', 'false')).not.toThrow();
    });

    it('AC02: guard.enabled rejects invalid value', () => {
      expect(() => validateConfigEntry('guard.enabled', 'maybe')).toThrow(ConfigValidationError);
    });
  });

  describe('path config keys', () => {
    it('AC02: freeze.path accepts a valid path string', () => {
      expect(() => validateConfigEntry('freeze.path', '/some/path')).not.toThrow();
    });

    it('AC02: freeze.path rejects empty string', () => {
      expect(() => validateConfigEntry('freeze.path', '')).toThrow(ConfigValidationError);
    });
  });

  describe('unknown keys (passthrough)', () => {
    it('AC02: unknown keys are allowed with any value', () => {
      expect(() => validateConfigEntry('custom.key', 'any-value')).not.toThrow();
      expect(() => validateConfigEntry('some.other.setting', '12345')).not.toThrow();
    });
  });

  describe('AC03: schema validation tests pass', () => {
    it('AC03: ConfigValidationError includes key and value info', () => {
      try {
        validateConfigEntry('careful.enabled', 'invalid');
        expect.unreachable('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ConfigValidationError);
        expect((e as ConfigValidationError).message).toContain('careful.enabled');
      }
    });
  });
});
