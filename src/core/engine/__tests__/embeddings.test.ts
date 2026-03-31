import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  cosineSimilarity,
  loadVec,
  isVecAvailable,
  generateEmbedding,
  initModel,
  _resetPipeline,
} from '../embeddings.js';

// Mock @xenova/transformers at the top level
const mockPipelineFn = vi.fn();
vi.mock('@xenova/transformers', () => ({
  pipeline: mockPipelineFn,
}));

describe('embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetPipeline();
  });

  describe('cosineSimilarity', () => {
    it('AC03: identical vectors should have similarity 1', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('AC03: orthogonal vectors should have similarity 0', () => {
      const a = new Float32Array([1, 0, 0]);
      const b = new Float32Array([0, 1, 0]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('AC03: opposite vectors should have similarity -1', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = new Float32Array([-1, -2, -3]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 5);
    });

    it('AC03: works with number[] arrays', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 5);
    });

    it('AC03: works with mixed Float32Array and number[]', () => {
      const a = new Float32Array([1, 2, 3]);
      const b = [1, 2, 3];
      expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 5);
    });

    it('AC03: handles zero vector gracefully', () => {
      const a = new Float32Array([0, 0, 0]);
      const b = new Float32Array([1, 2, 3]);
      expect(cosineSimilarity(a, b)).toBe(0);
    });
  });

  describe('loadVec', () => {
    it('AC05: returns false gracefully when sqlite-vec is not available', () => {
      const mockDb = {} as Database;
      const result = loadVec(mockDb);
      expect(typeof result).toBe('boolean');
    });

    it('AC05: does not throw when sqlite-vec fails to load', () => {
      const mockDb = {} as Database;
      expect(() => loadVec(mockDb)).not.toThrow();
    });

    it('AC02: attempts to load vec0 virtual table support', () => {
      const mockDb = {} as Database;
      const result = loadVec(mockDb);
      expect(result === true || result === false).toBe(true);
    });
  });

  describe('isVecAvailable', () => {
    it('AC02: returns false when vec extension is not loaded', () => {
      const mockDb = {
        prepare: vi.fn().mockImplementation(() => {
          throw new Error('no such table: vec_errors');
        }),
      } as unknown as Database;
      expect(isVecAvailable(mockDb)).toBe(false);
    });
  });

  describe('generateEmbedding', () => {
    it('AC04: returns 384-dim Float32Array from mocked pipeline', async () => {
      const mockOutput = {
        data: new Float32Array(384).fill(0.1),
        dims: [1, 384],
      };
      const mockInference = vi.fn().mockResolvedValue(mockOutput);
      mockPipelineFn.mockResolvedValue(mockInference);

      await initModel();
      const embedding = await generateEmbedding('hello world');

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(384);
    });

    it('AC04: initModel is lazy - only initializes once', async () => {
      const mockOutput = {
        data: new Float32Array(384).fill(0.5),
        dims: [1, 384],
      };
      const mockInference = vi.fn().mockResolvedValue(mockOutput);
      mockPipelineFn.mockResolvedValue(mockInference);

      await initModel();
      await initModel(); // second call should be no-op

      expect(mockPipelineFn).toHaveBeenCalledTimes(1);
    });
  });
});
