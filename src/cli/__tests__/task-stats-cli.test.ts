import { describe, it, expect } from 'vitest';
import { formatStats, formatHistory } from '../formatters.js';
import type { Event } from '../../core/types.js';

describe('formatStats', () => {
  it('with velocity only shows tasks/day', () => {
    const result = formatStats({ daily: 2.0, total_completed: 6 });
    expect(result).toContain('tasks/day');
    expect(result).toContain('2.0');
    expect(result).toContain('6 completed');
    expect(result).not.toContain('Remaining');
    expect(result).not.toContain('Estimated');
  });

  it('with velocity + estimate shows Remaining and Estimated', () => {
    const result = formatStats(
      { daily: 2.0, total_completed: 6 },
      {
        remaining_tasks: 4,
        velocity: 2.0,
        estimated_days: 2,
        estimated_date: '2026-03-18',
      },
    );
    expect(result).toContain('tasks/day');
    expect(result).toContain('Remaining: 4 tasks');
    expect(result).toContain('Estimated: ~2 days (2026-03-18)');
  });

  it('with timeline shows date strings and bar chars', () => {
    const result = formatStats(
      { daily: 2.0, total_completed: 6 },
      undefined,
      [
        { date: '2026-03-14', tasks_completed: 2, cumulative: 2 },
        { date: '2026-03-15', tasks_completed: 1, cumulative: 3 },
        { date: '2026-03-16', tasks_completed: 3, cumulative: 6 },
      ],
    );
    expect(result).toContain('Timeline:');
    expect(result).toContain('03/14');
    expect(result).toContain('03/15');
    expect(result).toContain('03/16');
    expect(result).toContain('█');
    expect(result).toContain('2 tasks');
    expect(result).toContain('1 task');
    expect(result).toContain('3 tasks');
  });
});

describe('formatHistory', () => {
  it('formats events with entity_type and dates', () => {
    const events: Event[] = [
      {
        id: 1,
        entity_type: 'plan',
        entity_id: 'p1',
        event_type: 'created',
        old_value: null,
        new_value: '{"title":"Auth","status":"draft"}',
        session_id: null,
        created_at: '2026-03-14T10:30:00Z',
      },
      {
        id: 2,
        entity_type: 'task',
        entity_id: 't1',
        event_type: 'status_changed',
        old_value: '{"status":"todo"}',
        new_value: '{"status":"done"}',
        session_id: null,
        created_at: '2026-03-15T14:00:00Z',
      },
    ];
    const result = formatHistory(events);
    expect(result).toContain('History:');
    expect(result).toContain('plan');
    expect(result).toContain('task');
    expect(result).toContain('2026-03-14');
    expect(result).toContain('2026-03-15');
    expect(result).toContain('created');
    expect(result).toContain('status_changed');
  });

  it('returns "No history found." for empty events', () => {
    const result = formatHistory([]);
    expect(result).toBe('No history found.');
  });
});
