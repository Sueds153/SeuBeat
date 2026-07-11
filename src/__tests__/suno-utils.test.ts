import { describe, it, expect } from 'vitest';
import { extractAudioUrl } from '../../server/services/suno';

describe('Suno utility functions', () => {
  const SUCCESS_STATUSES = new Set(['success', 'completed', 'done', 'finished', 'succeeded']);
  const FAILED_STATUSES = new Set(['failed', 'failure', 'error', 'cancelled', 'canceled']);

  function extractTaskId(payload: any): string | null {
    function firstString(...values: unknown[]): string | null {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    }
    return firstString(
      payload?.taskId,
      payload?.task_id,
      payload?.data?.taskId,
      payload?.data?.task_id,
      payload?.id,
      payload?.data?.id
    );
  }

  function extractStatus(payload: any): string {
    function firstString(...values: unknown[]): string | null {
      for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
      return null;
    }
    const rawStatus = firstString(
      payload?.status,
      payload?.state,
      payload?.data?.status,
      payload?.data?.state,
      payload?.task_status,
      payload?.data?.task_status
    );
    return (rawStatus || 'processing').toLowerCase();
  }

  function isQuotaError(status: number, body: string): boolean {
    return status === 429 || body.includes('quota') || body.includes('rate limit') || body.includes('exceeded');
  }

  function getRetryDelay(attempt: number, retryAfter?: string | null): number {
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
    }
    return Math.min(1000 * Math.pow(2, attempt - 1) + (attempt > 1 ? 250 : 0), 30000);
  }

  describe('extractTaskId', () => {
    it('extracts taskId from top-level field', () => {
      expect(extractTaskId({ taskId: 'abc-123' })).toBe('abc-123');
    });

    it('extracts task_id from top-level field', () => {
      expect(extractTaskId({ task_id: 'abc-456' })).toBe('abc-456');
    });

    it('extracts nested taskId from data', () => {
      expect(extractTaskId({ data: { taskId: 'nested-id' } })).toBe('nested-id');
    });

    it('extracts from data.task_id', () => {
      expect(extractTaskId({ data: { task_id: 'nested-dash' } })).toBe('nested-dash');
    });

    it('fallback to id field', () => {
      expect(extractTaskId({ id: 'direct-id' })).toBe('direct-id');
    });

    it('returns null for empty payload', () => {
      expect(extractTaskId({})).toBeNull();
    });

    it('returns null for null/undefined', () => {
      expect(extractTaskId(null)).toBeNull();
      expect(extractTaskId(undefined)).toBeNull();
    });
  });

  describe('extractStatus', () => {
    it('extracts from status field', () => {
      expect(extractStatus({ status: 'Success' })).toBe('success');
    });

    it('extracts from state field', () => {
      expect(extractStatus({ state: 'processing' })).toBe('processing');
    });

    it('extracts from data.status', () => {
      expect(extractStatus({ data: { status: 'COMPLETED' } })).toBe('completed');
    });

    it('defaults to processing', () => {
      expect(extractStatus({})).toBe('processing');
    });
  });

  describe('isQuotaError', () => {
    it('returns true for status 429', () => {
      expect(isQuotaError(429, '')).toBe(true);
    });

    it('returns true when body mentions quota', () => {
      expect(isQuotaError(200, 'quota exceeded')).toBe(true);
    });

    it('returns true when body mentions rate limit', () => {
      expect(isQuotaError(200, 'rate limit reached')).toBe(true);
    });

    it('returns false for normal errors', () => {
      expect(isQuotaError(500, 'internal error')).toBe(false);
      expect(isQuotaError(401, 'unauthorized')).toBe(false);
      expect(isQuotaError(200, 'ok')).toBe(false);
    });
  });

  describe('getRetryDelay', () => {
    it('uses retry-after header when present', () => {
      expect(getRetryDelay(1, '5')).toBe(5000);
    });

    it('ignores invalid retry-after', () => {
      const delay = getRetryDelay(2);
      expect(delay).toBeGreaterThanOrEqual(2000);
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('caps delay at 30 seconds', () => {
      const delay = getRetryDelay(10);
      expect(delay).toBeLessThanOrEqual(30000);
    });
  });

  describe('extractAudioUrl', () => {
    it('prefers sourceAudioUrl and ignores Suno cover image URLs', () => {
      const payload = {
        data: {
          response: {
            sunoData: [
              {
                sourceAudioUrl: 'https://cdn1.suno.ai/song-id.mp3',
                audioUrl: 'https://tempfile.aiquickdraw.com/r/song-id.mp3',
                imageUrl: 'https://musicfile.removeai.ai/song-id.jpeg',
                sourceImageUrl: 'https://cdn2.suno.ai/image_song-id.jpeg'
              }
            ]
          }
        }
      };

      expect(extractAudioUrl(payload)).toBe('https://cdn1.suno.ai/song-id.mp3');
    });

    it('does not return image URLs from generic URL fields', () => {
      const payload = {
        data: {
          response: {
            sunoData: [
              {
                url: 'https://cdn2.suno.ai/image_song-id.jpeg',
                sourceImageUrl: 'https://cdn2.suno.ai/image_song-id.jpeg'
              }
            ]
          },
          fallback: {
            sourceAudioUrl: 'https://cdn1.suno.ai/fallback-song.mp3'
          }
        }
      };

      expect(extractAudioUrl(payload)).toBe('https://cdn1.suno.ai/fallback-song.mp3');
    });
  });
});
