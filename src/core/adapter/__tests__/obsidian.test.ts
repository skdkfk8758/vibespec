import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObsidianAdapter, resetAvailabilityCache } from '../obsidian.js';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

import { execSync } from 'node:child_process';

const mockExecSync = vi.mocked(execSync);

describe('ObsidianAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAvailabilityCache();
  });

  describe('isAvailable', () => {
    it('should return true when obsidian CLI is installed', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from('obsidian 1.0.0'));

      expect(ObsidianAdapter.isAvailable()).toBe(true);
    });

    it('should return false when obsidian CLI is not installed', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('command not found: obsidian');
      });

      expect(ObsidianAdapter.isAvailable()).toBe(false);
    });

    it('should cache the result after first call', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from('obsidian 1.0.0'));

      expect(ObsidianAdapter.isAvailable()).toBe(true);
      expect(ObsidianAdapter.isAvailable()).toBe(true);
      expect(ObsidianAdapter.isAvailable()).toBe(true);

      // execSync should only be called once due to caching
      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should cache false result as well', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('command not found');
      });

      expect(ObsidianAdapter.isAvailable()).toBe(false);
      expect(ObsidianAdapter.isAvailable()).toBe(false);

      expect(mockExecSync).toHaveBeenCalledTimes(1);
    });

    it('should not propagate exceptions', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('unexpected error');
      });

      expect(() => ObsidianAdapter.isAvailable()).not.toThrow();
    });
  });

  describe('search', () => {
    let adapter: ObsidianAdapter;

    beforeEach(() => {
      adapter = new ObsidianAdapter();
    });

    it('should parse JSON results from obsidian search', () => {
      const mockResults = [
        { file: 'note1.md', matches: ['match1'], score: 0.9 },
        { file: 'note2.md', matches: ['match2'], score: 0.7 },
      ];
      mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockResults)));

      const results = adapter.search('test query');

      expect(results).toEqual(mockResults);
      expect(mockExecSync).toHaveBeenCalledWith(
        'obsidian search query="test query" format=json',
        expect.any(Object),
      );
    });

    it('should return empty array when obsidian is not available or fails', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('obsidian not found');
      });

      const results = adapter.search('test query');

      expect(results).toEqual([]);
    });

    it('should return empty array on invalid JSON', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from('not valid json'));

      const results = adapter.search('test query');

      expect(results).toEqual([]);
    });

    it('should not propagate exceptions', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('crash');
      });

      expect(() => adapter.search('test')).not.toThrow();
    });
  });

  describe('setProperty', () => {
    let adapter: ObsidianAdapter;

    beforeEach(() => {
      adapter = new ObsidianAdapter();
    });

    it('should execute property set command', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      adapter.setProperty('note.md', 'status', 'done');

      expect(mockExecSync).toHaveBeenCalledWith(
        'obsidian property:set file="note.md" name="status" value="done"',
        expect.any(Object),
      );
    });

    it('should silently ignore failures', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('obsidian error');
      });

      expect(() => adapter.setProperty('note.md', 'status', 'done')).not.toThrow();
    });
  });

  describe('append', () => {
    let adapter: ObsidianAdapter;

    beforeEach(() => {
      adapter = new ObsidianAdapter();
    });

    it('should execute append command', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      adapter.append('note.md', 'new content');

      expect(mockExecSync).toHaveBeenCalledWith(
        'obsidian append file="note.md" content="new content"',
        expect.any(Object),
      );
    });

    it('should silently ignore failures', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('obsidian error');
      });

      expect(() => adapter.append('note.md', 'content')).not.toThrow();
    });
  });

  describe('getTags', () => {
    let adapter: ObsidianAdapter;

    beforeEach(() => {
      adapter = new ObsidianAdapter();
    });

    it('should parse JSON results from obsidian tags command', () => {
      const mockTags = [
        { tag: 'typescript', count: 5 },
        { tag: 'error', count: 3 },
      ];
      mockExecSync.mockReturnValueOnce(Buffer.from(JSON.stringify(mockTags)));

      const tags = adapter.getTags();

      expect(tags).toEqual(mockTags);
      expect(mockExecSync).toHaveBeenCalledWith(
        'obsidian tags format=json',
        expect.any(Object),
      );
    });

    it('should return empty array on failure', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('obsidian error');
      });

      const tags = adapter.getTags();

      expect(tags).toEqual([]);
    });

    it('should not propagate exceptions', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('crash');
      });

      expect(() => adapter.getTags()).not.toThrow();
    });
  });
});
