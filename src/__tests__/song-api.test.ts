import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('fetchSong', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed data on successful fetch', async () => {
    const mockData = { success: true, data: { id: 'abc', title: 'Canção' } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const { fetchSong } = await import('../api/song');
    const result = await fetchSong('abc');
    expect(result).toEqual(mockData);
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 404,
    });

    const { fetchSong } = await import('../api/song');
    const result = await fetchSong('notfound');
    expect(result).toBeNull();
  });

  it('handles aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const { fetchSong } = await import('../api/song');
    await expect(fetchSong('abc', controller.signal)).rejects.toThrow('Aborted');
  });
});

describe('fetchSongWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clears timeout on successful fetch', async () => {
    const mockData = { success: true, data: { id: 'abc' } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const { fetchSongWithTimeout } = await import('../api/song');
    const promise = fetchSongWithTimeout('abc');
    vi.advanceTimersByTime(5000);
    const result = await promise;
    expect(result).toEqual(mockData);
  });
});
