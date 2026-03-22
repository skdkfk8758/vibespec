import { describe, it, expect } from 'vitest';
import {
  formatErrorSearchResults,
  formatErrorDetail,
  formatErrorKBStats,
} from '../formatters.js';
import type { ErrorEntry, ErrorKBStats } from '../../core/types.js';

function makeErrorEntry(overrides?: Partial<ErrorEntry>): ErrorEntry {
  return {
    id: 'abc123def456',
    title: 'TypeError: Cannot read property of undefined',
    severity: 'high',
    tags: ['runtime', 'frontend'],
    status: 'open',
    occurrences: 3,
    first_seen: '2026-03-10T00:00:00.000Z',
    last_seen: '2026-03-15T00:00:00.000Z',
    content: '\n## Cause\n\nAccessing nested object without null check\n\n## Solution\n\nUse optional chaining\n\n',
    ...overrides,
  };
}

describe('formatErrorSearchResults', () => {
  it('should display search results in a table with ID, severity, status, occurrences, and title', () => {
    const entries: ErrorEntry[] = [
      makeErrorEntry(),
      makeErrorEntry({
        id: 'xyz789abc012',
        title: 'RangeError: Maximum call stack',
        severity: 'critical',
        status: 'recurring',
        occurrences: 10,
        tags: ['runtime'],
      }),
    ];

    const result = formatErrorSearchResults(entries);

    // Header
    expect(result).toContain('ID');
    expect(result).toContain('Severity');
    expect(result).toContain('Status');
    expect(result).toContain('Title');

    // First entry
    expect(result).toContain('abc123def456');
    expect(result).toContain('high');
    expect(result).toContain('open');
    expect(result).toContain('TypeError: Cannot read property of undefined');

    // Second entry
    expect(result).toContain('xyz789abc012');
    expect(result).toContain('critical');
    expect(result).toContain('recurring');
    expect(result).toContain('RangeError: Maximum call stack');
  });

  it('should return "No errors found." for empty results', () => {
    const result = formatErrorSearchResults([]);
    expect(result).toBe('No errors found.');
  });
});

describe('formatErrorDetail', () => {
  it('should display full error entry details including title, severity, tags, status, occurrences, dates, and content', () => {
    const entry = makeErrorEntry();
    const result = formatErrorDetail(entry);

    expect(result).toContain('abc123def456');
    expect(result).toContain('TypeError: Cannot read property of undefined');
    expect(result).toContain('high');
    expect(result).toContain('runtime, frontend');
    expect(result).toContain('open');
    expect(result).toContain('3');
    expect(result).toContain('2026-03-10');
    expect(result).toContain('2026-03-15');
    expect(result).toContain('Accessing nested object without null check');
    expect(result).toContain('Use optional chaining');
  });

  it('should handle entry with no tags', () => {
    const entry = makeErrorEntry({ tags: [] });
    const result = formatErrorDetail(entry);

    expect(result).toContain('abc123def456');
    expect(result).toContain('TypeError: Cannot read property of undefined');
  });
});

describe('formatErrorKBStats', () => {
  it('should display total count, severity breakdown, status breakdown, and top recurring', () => {
    const stats: ErrorKBStats = {
      total: 15,
      by_severity: { critical: 2, high: 5, medium: 6, low: 2 },
      by_status: { open: 8, resolved: 4, recurring: 2, wontfix: 1 },
      top_recurring: [
        { id: 'err1', title: 'Timeout Error', occurrences: 12 },
        { id: 'err2', title: 'Auth Failure', occurrences: 8 },
      ],
    };

    const result = formatErrorKBStats(stats);

    expect(result).toContain('Total: 15');
    expect(result).toContain('critical');
    expect(result).toContain('high');
    expect(result).toContain('medium');
    expect(result).toContain('low');
    expect(result).toContain('open');
    expect(result).toContain('resolved');
    expect(result).toContain('recurring');
    expect(result).toContain('Timeout Error');
    expect(result).toContain('12');
    expect(result).toContain('Auth Failure');
    expect(result).toContain('8');
  });

  it('should handle stats with no recurring errors', () => {
    const stats: ErrorKBStats = {
      total: 0,
      by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
      by_status: { open: 0, resolved: 0, recurring: 0, wontfix: 0 },
      top_recurring: [],
    };

    const result = formatErrorKBStats(stats);
    expect(result).toContain('Total: 0');
  });
});
