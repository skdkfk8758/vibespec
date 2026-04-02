import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { initCodexIntegrationSchema, createCodexIntegration, updateCodexIntegration, getByFindingId, listByRunId } from '../src/core/engine/codex-integration-db.js';

describe('codex-integration-db', () => {
  let db: Database.Database;
  beforeEach(() => { db = new Database(':memory:'); initCodexIntegrationSchema(db); });

  it('AC01: 레코드 생성', () => { const r = createCodexIntegration(db, { finding_id: 'f1', run_id: 'r1' }); expect(r.finding_id).toBe('f1'); expect(r.status).toBe('pending'); });
  it('AC02: 테이블 필드', () => { const info = db.pragma('table_info(codex_integrations)') as Array<{name:string}>; const cols = info.map(c=>c.name); expect(cols).toContain('fallback_reason'); expect(cols).toContain('prompt_context'); });
  it('AC03: getByFindingId', () => { createCodexIntegration(db, { finding_id: 'f2', run_id: 'r1' }); expect(getByFindingId(db, 'f2')!.finding_id).toBe('f2'); });
  it('AC03: null', () => { expect(getByFindingId(db, 'x')).toBeNull(); });
  it('AC03: listByRunId', () => { createCodexIntegration(db, { finding_id: 'f3', run_id: 'r2' }); createCodexIntegration(db, { finding_id: 'f4', run_id: 'r2' }); expect(listByRunId(db, 'r2')).toHaveLength(2); });
  it('AC03: empty', () => { expect(listByRunId(db, 'x')).toHaveLength(0); });
  it('AC04: status update', () => { const r = createCodexIntegration(db, { finding_id: 'f5', run_id: 'r3' }); updateCodexIntegration(db, r.id, { status: 'running' }); expect(getByFindingId(db, 'f5')!.status).toBe('running'); });
  it('AC04: multi-field', () => { const r = createCodexIntegration(db, { finding_id: 'f6', run_id: 'r4' }); updateCodexIntegration(db, r.id, { status: 'passed', verification_result: 'PASS', attempt: 2 }); const u = getByFindingId(db, 'f6')!; expect(u.status).toBe('passed'); expect(u.attempt).toBe(2); });
});
