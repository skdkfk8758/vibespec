import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryDb } from '../../db/connection.js';
import { initSchema } from '../../db/schema.js';
import { EventModel } from '../event.js';
import type Database from 'better-sqlite3';

describe('EventModel', () => {
  let db: Database.Database;
  let events: EventModel;

  beforeEach(() => {
    db = createMemoryDb();
    initSchema(db);
    events = new EventModel(db);
  });

  it('should record events and getByEntity returns them in chronological order', () => {
    const e1 = events.record('plan', 'p1', 'created');
    const e2 = events.record('plan', 'p1', 'status_changed', '"draft"', '"active"');
    const e3 = events.record('plan', 'p1', 'updated', null, '"new title"');

    const result = events.getByEntity('plan', 'p1');
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(e1.id);
    expect(result[1].id).toBe(e2.id);
    expect(result[2].id).toBe(e3.id);
    expect(result[0].event_type).toBe('created');
    expect(result[1].event_type).toBe('status_changed');
    expect(result[2].event_type).toBe('updated');
  });

  it('should filter by session with getBySession', () => {
    events.record('plan', 'p1', 'created', null, null, 'session-a');
    events.record('task', 't1', 'created', null, null, 'session-b');
    events.record('plan', 'p1', 'updated', null, null, 'session-a');

    const sessionA = events.getBySession('session-a');
    expect(sessionA).toHaveLength(2);
    expect(sessionA.every((e) => e.session_id === 'session-a')).toBe(true);

    const sessionB = events.getBySession('session-b');
    expect(sessionB).toHaveLength(1);
    expect(sessionB[0].entity_id).toBe('t1');
  });

  it('should return recent events with limit', () => {
    for (let i = 0; i < 5; i++) {
      events.record('plan', `p${i}`, 'created');
    }

    const recent = events.getRecent(3);
    expect(recent).toHaveLength(3);
    // Most recent first (DESC)
    expect(recent[0].entity_id).toBe('p4');
    expect(recent[1].entity_id).toBe('p3');
    expect(recent[2].entity_id).toBe('p2');
  });

  it('should use default limit of 20 for getRecent', () => {
    for (let i = 0; i < 25; i++) {
      events.record('task', `t${i}`, 'created');
    }

    const recent = events.getRecent();
    expect(recent).toHaveLength(20);
  });

  it('should store old_value and new_value as JSON strings correctly', () => {
    const oldVal = JSON.stringify({ status: 'draft' });
    const newVal = JSON.stringify({ status: 'active' });

    const evt = events.record('plan', 'p1', 'status_changed', oldVal, newVal, 'sess-1');

    expect(evt.old_value).toBe(oldVal);
    expect(evt.new_value).toBe(newVal);

    const parsed_old = JSON.parse(evt.old_value!);
    const parsed_new = JSON.parse(evt.new_value!);
    expect(parsed_old).toEqual({ status: 'draft' });
    expect(parsed_new).toEqual({ status: 'active' });

    // Verify via getByEntity as well
    const fetched = events.getByEntity('plan', 'p1');
    expect(fetched[0].old_value).toBe(oldVal);
    expect(fetched[0].new_value).toBe(newVal);
  });
});
