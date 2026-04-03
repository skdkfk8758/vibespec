import { describe, it, expect } from 'vitest';
import {
  RetryConfigSchema,
  DEFAULT_RETRY_CONFIG,
} from '../retry.js';

describe('RetryConfig 타입 + 기본값', () => {
  describe('AC01: RetryConfig 인터페이스 필드 검증', () => {
    it('AC01: maxRetries 필드가 존재한다', () => {
      const config = DEFAULT_RETRY_CONFIG;
      expect(config).toHaveProperty('maxRetries');
      expect(typeof config.maxRetries).toBe('number');
    });

    it('AC01: backoffMs 필드가 존재한다', () => {
      const config = DEFAULT_RETRY_CONFIG;
      expect(config).toHaveProperty('backoffMs');
      expect(Array.isArray(config.backoffMs)).toBe(true);
    });

    it('AC01: fallbackAgentMap 필드가 존재한다', () => {
      const config = DEFAULT_RETRY_CONFIG;
      expect(config).toHaveProperty('fallbackAgentMap');
      expect(typeof config.fallbackAgentMap).toBe('object');
    });
  });

  describe('AC02: DEFAULT_RETRY_CONFIG 기본값 검증', () => {
    it('AC02: maxRetries가 3이다', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
    });

    it('AC02: backoffMs가 [1000, 2000, 4000]이다', () => {
      expect(DEFAULT_RETRY_CONFIG.backoffMs).toEqual([1000, 2000, 4000]);
    });

    it('AC02: fallbackAgentMap이 빈 객체이다', () => {
      expect(DEFAULT_RETRY_CONFIG.fallbackAgentMap).toEqual({});
    });
  });

  describe('AC03: Zod 스키마 검증', () => {
    it('AC03: maxRetries < 1인 경우 거부한다', () => {
      const result = RetryConfigSchema.safeParse({
        maxRetries: 0,
        backoffMs: [1000],
        fallbackAgentMap: {},
      });
      expect(result.success).toBe(false);
    });

    it('AC03: maxRetries가 음수인 경우 거부한다', () => {
      const result = RetryConfigSchema.safeParse({
        maxRetries: -1,
        backoffMs: [1000],
        fallbackAgentMap: {},
      });
      expect(result.success).toBe(false);
    });

    it('AC03: backoffMs가 빈 배열인 경우 거부한다', () => {
      const result = RetryConfigSchema.safeParse({
        maxRetries: 3,
        backoffMs: [],
        fallbackAgentMap: {},
      });
      expect(result.success).toBe(false);
    });

    it('AC03: 올바른 config는 통과한다', () => {
      const result = RetryConfigSchema.safeParse({
        maxRetries: 3,
        backoffMs: [1000, 2000, 4000],
        fallbackAgentMap: {},
      });
      expect(result.success).toBe(true);
    });

    it('AC03: fallbackAgentMap에 string 값이 있어도 통과한다', () => {
      const result = RetryConfigSchema.safeParse({
        maxRetries: 2,
        backoffMs: [500],
        fallbackAgentMap: { 'agent-a': 'agent-b' },
      });
      expect(result.success).toBe(true);
    });
  });
});
