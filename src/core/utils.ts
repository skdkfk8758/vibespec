import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';

/**
 * Allowed transitions map type: maps each state to its valid target states.
 */
export type AllowedTransitions = Record<string, string[]>;

/**
 * Custom error for invalid state transitions.
 */
export class InvalidTransitionError extends Error {
  constructor(current: string, target: string) {
    super(`Invalid transition: ${current} → ${target}`);
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Validate a state transition against an allowed transitions map.
 * - Same state (current === target) is a no-op (returns silently).
 * - If force is true, the transition is always allowed.
 * - Otherwise, throws InvalidTransitionError if the transition is not in the allowed map.
 */
export function validateTransition(
  allowed: AllowedTransitions,
  current: string,
  target: string,
  opts?: { force?: boolean },
): void {
  if (current === target) return;
  if (opts?.force) return;
  const validTargets = allowed[current];
  if (!validTargets || !validTargets.includes(target)) {
    throw new InvalidTransitionError(current, target);
  }
}

/**
 * Generate a 12-character unique ID.
 */
export function generateId(): string {
  return nanoid(12);
}

/**
 * Check if a column exists in a table.
 */
export function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
  return columns.some((c) => c.name === column);
}

/**
 * Get current ISO timestamp.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Extract date-only string from ISO timestamp.
 */
export function toDateOnly(iso: string): string {
  return iso.split('T')[0];
}

/**
 * Build a dynamic UPDATE query from a fields object.
 * Returns null if no fields to update.
 */
export function buildUpdateQuery(
  table: string,
  id: string,
  fields: Record<string, unknown>,
): { sql: string; params: unknown[] } | null {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      sets.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (sets.length === 0) return null;

  values.push(id);
  return {
    sql: `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`,
    params: values,
  };
}
