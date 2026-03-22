import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianAdapter } from '../obsidian.js';

// Mock obsidian-ts module
const mockFile = {
  create: vi.fn(),
  read: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
};
const mockSearch = {
  context: vi.fn(),
};
const mockProperty = {
  set: vi.fn(),
};
const mockTag = {
  list: vi.fn(),
};

vi.mock('obsidian-ts', () => ({
  isCompatible: vi.fn().mockResolvedValue(true),
  file: mockFile,
  search: mockSearch,
  property: mockProperty,
  tag: mockTag,
}));

describe('ObsidianAdapter', () => {
  let adapter: ObsidianAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new ObsidianAdapter('MyVault', 'VibeSpec/Errors');
  });

  describe('isAvailable', () => {
    it('should return true when obsidian CLI is compatible', async () => {
      expect(await ObsidianAdapter.isAvailable('MyVault')).toBe(true);
    });

    it('should return false when import fails', async () => {
      const { isCompatible } = await import('obsidian-ts');
      vi.mocked(isCompatible).mockRejectedValueOnce(new Error('not found'));

      expect(await ObsidianAdapter.isAvailable('MyVault')).toBe(false);
    });
  });

  describe('createNote', () => {
    it('should create a note with correct path', async () => {
      mockFile.create.mockResolvedValueOnce(undefined);

      await adapter.createNote('abc123', '# Test');

      expect(mockFile.create).toHaveBeenCalledWith({
        vault: 'MyVault',
        path: 'VibeSpec/Errors/abc123.md',
        content: '# Test',
        overwrite: false,
      });
    });

    it('should silently ignore errors', async () => {
      mockFile.create.mockRejectedValueOnce(new Error('fail'));

      await expect(adapter.createNote('abc123', '# Test')).resolves.toBeUndefined();
    });
  });

  describe('readNote', () => {
    it('should read a note content', async () => {
      mockFile.read.mockResolvedValueOnce('# Test Content');

      const result = await adapter.readNote('abc123');

      expect(result).toBe('# Test Content');
      expect(mockFile.read).toHaveBeenCalledWith({
        vault: 'MyVault',
        path: 'VibeSpec/Errors/abc123.md',
      });
    });

    it('should return null on failure', async () => {
      mockFile.read.mockRejectedValueOnce(new Error('not found'));

      const result = await adapter.readNote('abc123');
      expect(result).toBeNull();
    });
  });

  describe('updateNote', () => {
    it('should overwrite existing note', async () => {
      mockFile.create.mockResolvedValueOnce(undefined);

      await adapter.updateNote('abc123', '# Updated');

      expect(mockFile.create).toHaveBeenCalledWith({
        vault: 'MyVault',
        path: 'VibeSpec/Errors/abc123.md',
        content: '# Updated',
        overwrite: true,
      });
    });

    it('should silently ignore errors', async () => {
      mockFile.create.mockRejectedValueOnce(new Error('fail'));
      await expect(adapter.updateNote('abc123', '# X')).resolves.toBeUndefined();
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      mockFile.delete.mockResolvedValueOnce(undefined);

      await adapter.deleteNote('abc123');

      expect(mockFile.delete).toHaveBeenCalledWith({
        vault: 'MyVault',
        path: 'VibeSpec/Errors/abc123.md',
      });
    });

    it('should silently ignore errors', async () => {
      mockFile.delete.mockRejectedValueOnce(new Error('fail'));
      await expect(adapter.deleteNote('abc123')).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('should transform obsidian-ts search results', async () => {
      mockSearch.context.mockResolvedValueOnce([
        { file: 'note1.md', matches: [{ line: 1, text: 'match1' }, { line: 2, text: 'match2' }] },
        { file: 'note2.md', matches: [{ line: 1, text: 'match3' }] },
      ]);

      const results = await adapter.search('test query');

      expect(results).toEqual([
        { file: 'note1.md', matches: ['match1', 'match2'], score: 2 },
        { file: 'note2.md', matches: ['match3'], score: 1 },
      ]);
      expect(mockSearch.context).toHaveBeenCalledWith({
        vault: 'MyVault',
        query: 'test query',
        path: 'VibeSpec/Errors',
      });
    });

    it('should return empty array on failure', async () => {
      mockSearch.context.mockRejectedValueOnce(new Error('fail'));
      const results = await adapter.search('test');
      expect(results).toEqual([]);
    });
  });

  describe('setProperty', () => {
    it('should set a property on a file', async () => {
      mockProperty.set.mockResolvedValueOnce(undefined);

      await adapter.setProperty('note.md', 'status', 'done');

      expect(mockProperty.set).toHaveBeenCalledWith({
        vault: 'MyVault',
        path: 'note.md',
        name: 'status',
        value: 'done',
      });
    });

    it('should silently ignore errors', async () => {
      mockProperty.set.mockRejectedValueOnce(new Error('fail'));
      await expect(adapter.setProperty('note.md', 'status', 'done')).resolves.toBeUndefined();
    });
  });

  describe('getTags', () => {
    it('should return transformed tag list', async () => {
      mockTag.list.mockResolvedValueOnce([
        { tag: 'typescript', count: 5 },
        { tag: 'error', count: 3 },
      ]);

      const tags = await adapter.getTags();

      expect(tags).toEqual([
        { tag: 'typescript', count: 5 },
        { tag: 'error', count: 3 },
      ]);
    });

    it('should handle missing count', async () => {
      mockTag.list.mockResolvedValueOnce([
        { tag: 'test' },
      ]);

      const tags = await adapter.getTags();
      expect(tags).toEqual([{ tag: 'test', count: 0 }]);
    });

    it('should return empty array on failure', async () => {
      mockTag.list.mockRejectedValueOnce(new Error('fail'));
      const tags = await adapter.getTags();
      expect(tags).toEqual([]);
    });
  });

  describe('listNotes', () => {
    it('should list note paths', async () => {
      mockFile.list.mockResolvedValueOnce([
        'VibeSpec/Errors/abc.md',
        'VibeSpec/Errors/def.md',
      ]);

      const paths = await adapter.listNotes();

      expect(paths).toEqual(['VibeSpec/Errors/abc.md', 'VibeSpec/Errors/def.md']);
      expect(mockFile.list).toHaveBeenCalledWith({
        vault: 'MyVault',
        folder: 'VibeSpec/Errors',
        ext: 'md',
      });
    });

    it('should return empty array on failure', async () => {
      mockFile.list.mockRejectedValueOnce(new Error('fail'));
      const paths = await adapter.listNotes();
      expect(paths).toEqual([]);
    });
  });
});
