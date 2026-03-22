import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine } from '../sync.js';
import { ErrorKBEngine } from '../error-kb.js';
import type { ObsidianAdapter } from '../../adapter/obsidian.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function createMockObsidian(): ObsidianAdapter {
  return {
    createNote: vi.fn().mockResolvedValue(undefined),
    readNote: vi.fn().mockResolvedValue(null),
    updateNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    setProperty: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([]),
    listNotes: vi.fn().mockResolvedValue([]),
  } as unknown as ObsidianAdapter;
}

describe('SyncEngine', () => {
  let tmpDir: string;
  let kb: ErrorKBEngine;
  let mockObs: ObsidianAdapter;
  let sync: SyncEngine;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-'));
    kb = new ErrorKBEngine(tmpDir);
    mockObs = createMockObsidian();
    sync = new SyncEngine(kb, mockObs);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('local-only entries', () => {
    it('should create vault notes for local-only entries', async () => {
      kb.add({ title: 'Local Error', severity: 'high', tags: ['test'] });
      vi.mocked(mockObs.listNotes).mockResolvedValue([]);

      const result = await sync.fullSync();

      expect(result.created_in_vault).toBe(1);
      expect(mockObs.createNote).toHaveBeenCalledTimes(1);
    });

    it('should not write in dry-run mode', async () => {
      kb.add({ title: 'Local Error', severity: 'high', tags: [] });
      vi.mocked(mockObs.listNotes).mockResolvedValue([]);

      const result = await sync.fullSync({ dryRun: true });

      expect(result.created_in_vault).toBe(1);
      expect(mockObs.createNote).not.toHaveBeenCalled();
    });
  });

  describe('vault-only entries', () => {
    it('should skip vault-only entries by default', async () => {
      vi.mocked(mockObs.listNotes).mockResolvedValue(['VibeSpec/Errors/vault123.md']);

      const result = await sync.fullSync();

      expect(result.skipped_vault_only).toEqual(['vault123']);
      expect(result.created_in_local).toBe(0);
    });

    it('should import vault-only entries with --import flag', async () => {
      vi.mocked(mockObs.listNotes).mockResolvedValue(['VibeSpec/Errors/vault456.md']);
      vi.mocked(mockObs.readNote).mockResolvedValue(
        '---\ntitle: Vault Error\nseverity: medium\ntags: []\nstatus: open\noccurrences: 1\nfirst_seen: 2026-03-23T00:00:00.000Z\nlast_seen: 2026-03-23T00:00:00.000Z\n---\n\n## Cause\n\nSome cause\n',
      );

      const result = await sync.fullSync({ import: true });

      expect(result.created_in_local).toBe(1);
    });
  });

  describe('conflict resolution (LWW)', () => {
    it('should update vault when local is newer', async () => {
      const entry = kb.add({ title: 'Conflict Error', severity: 'high', tags: [] });

      vi.mocked(mockObs.listNotes).mockResolvedValue([`VibeSpec/Errors/${entry.id}.md`]);
      vi.mocked(mockObs.readNote).mockResolvedValue(
        `---\ntitle: Conflict Error\nseverity: high\ntags: []\nstatus: open\noccurrences: 1\nfirst_seen: 2020-01-01T00:00:00.000Z\nlast_seen: 2020-01-01T00:00:00.000Z\n---\n\nOld content`,
      );

      const result = await sync.fullSync();

      expect(result.updated_in_vault).toBe(1);
      expect(result.conflicts).toEqual([{ id: entry.id, resolution: 'local_wins' }]);
      expect(mockObs.updateNote).toHaveBeenCalledTimes(1);
    });

    it('should update local when vault is newer', async () => {
      const entry = kb.add({ title: 'Old Local', severity: 'low', tags: [] });

      vi.mocked(mockObs.listNotes).mockResolvedValue([`VibeSpec/Errors/${entry.id}.md`]);
      vi.mocked(mockObs.readNote).mockResolvedValue(
        `---\ntitle: Old Local\nseverity: critical\ntags: [updated]\nstatus: resolved\noccurrences: 5\nfirst_seen: 2020-01-01T00:00:00.000Z\nlast_seen: 2099-12-31T23:59:59.000Z\n---\n\nUpdated vault content`,
      );

      const result = await sync.fullSync();

      expect(result.updated_in_local).toBe(1);
      expect(result.conflicts).toEqual([{ id: entry.id, resolution: 'vault_wins' }]);

      // Verify local was updated
      const updated = kb.show(entry.id);
      expect(updated!.severity).toBe('critical');
      expect(updated!.status).toBe('resolved');
    });
  });

  describe('error handling', () => {
    it('should collect errors without failing entire sync', async () => {
      kb.add({ title: 'Error Entry', severity: 'high', tags: [] });
      vi.mocked(mockObs.listNotes).mockResolvedValue([]);
      vi.mocked(mockObs.createNote).mockRejectedValue(new Error('Network error'));

      const result = await sync.fullSync();

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
