import { z } from 'zod';

/**
 * Error thrown when a config value fails schema validation.
 */
export class ConfigValidationError extends Error {
  constructor(key: string, value: string, reason: string) {
    super(`Invalid config value for "${key}": "${value}" — ${reason}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Zod schema for boolean string config values ("true" / "false").
 */
const BooleanStringSchema = z.enum(['true', 'false']);

/**
 * Zod schema for non-empty path strings.
 */
const PathStringSchema = z.string().min(1, 'Path must not be empty');

/**
 * Registry of known config keys and their Zod schemas.
 * Unknown keys are allowed (passthrough) — they skip validation.
 */
const CONFIG_SCHEMAS: Record<string, z.ZodType<string>> = {
  'careful.enabled': BooleanStringSchema,
  'freeze.enabled': BooleanStringSchema,
  'guard.enabled': BooleanStringSchema,
  'freeze.path': PathStringSchema,
};

/**
 * Validates a config key-value pair against the known schema.
 * Unknown keys are silently accepted (passthrough for extensibility).
 *
 * @throws {ConfigValidationError} if the value is invalid for a known key
 */
export function validateConfigEntry(key: string, value: string): void {
  const schema = CONFIG_SCHEMAS[key];
  if (!schema) {
    return; // Unknown key — passthrough
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    const reason = result.error.issues.map((i) => i.message).join('; ');
    throw new ConfigValidationError(key, value, reason);
  }
}
