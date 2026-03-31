import type Database from 'better-sqlite3';
import type { EntityType, Event, EventType } from '../types.js';
import { BaseRepository } from './base-repository.js';

export interface RecordEventOpts {
  entityType: EntityType;
  entityId: string;
  eventType: EventType;
  oldValue?: string | null;
  newValue?: string | null;
  sessionId?: string | null;
}

/** BaseRepository-compatible type (id coerced to string for generic constraint) */
type EventBase = Omit<Event, 'id'> & { id: string };

export class EventModel extends BaseRepository<EventBase> {
  constructor(db: Database.Database) {
    super(db, 'events');
  }

  record(opts: RecordEventOpts): Event;
  /** @deprecated Use options object overload instead */
  record(
    entityType: EntityType,
    entityId: string,
    eventType: EventType,
    oldValue?: string | null,
    newValue?: string | null,
    sessionId?: string | null,
  ): Event;
  record(
    optsOrEntityType: RecordEventOpts | EntityType,
    entityId?: string,
    eventType?: EventType,
    oldValue?: string | null,
    newValue?: string | null,
    sessionId?: string | null,
  ): Event {
    let opts: RecordEventOpts;
    if (typeof optsOrEntityType === 'object') {
      opts = optsOrEntityType;
    } else {
      opts = {
        entityType: optsOrEntityType,
        entityId: entityId!,
        eventType: eventType!,
        oldValue,
        newValue,
        sessionId,
      };
    }

    const stmt = this.db.prepare(
      `INSERT INTO events (entity_type, entity_id, event_type, old_value, new_value, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      opts.entityType,
      opts.entityId,
      opts.eventType,
      opts.oldValue ?? null,
      opts.newValue ?? null,
      opts.sessionId ?? null,
    );
    return this.db
      .prepare(`SELECT * FROM events WHERE id = ?`)
      .get(result.lastInsertRowid) as Event;
  }

  getByEntity(entityType: EntityType, entityId: string): Event[] {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC, id ASC`,
    );
    return stmt.all(entityType, entityId) as Event[];
  }

  getBySession(sessionId: string): Event[] {
    const stmt = this.db.prepare(
      `SELECT * FROM events WHERE session_id = ? ORDER BY created_at ASC, id ASC`,
    );
    return stmt.all(sessionId) as Event[];
  }

  getRecent(limit: number = 20): Event[] {
    const stmt = this.db.prepare(
      `SELECT * FROM events ORDER BY created_at DESC, id DESC LIMIT ?`,
    );
    return stmt.all(limit) as Event[];
  }
}
