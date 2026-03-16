import type Database from 'better-sqlite3';
import type { Event } from '../types.js';

export class EventModel {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  record(
    entityType: string,
    entityId: string,
    eventType: string,
    oldValue?: string | null,
    newValue?: string | null,
    sessionId?: string | null,
  ): Event {
    const stmt = this.db.prepare(
      `INSERT INTO events (entity_type, entity_id, event_type, old_value, new_value, session_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const result = stmt.run(
      entityType,
      entityId,
      eventType,
      oldValue ?? null,
      newValue ?? null,
      sessionId ?? null,
    );
    return this.db
      .prepare(`SELECT * FROM events WHERE id = ?`)
      .get(result.lastInsertRowid) as Event;
  }

  getByEntity(entityType: string, entityId: string): Event[] {
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
