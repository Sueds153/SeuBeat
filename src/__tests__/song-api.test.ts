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

describe('fetchResumeData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches resume data for a request id', async () => {
    const mockData = {
      success: true,
      data: {
        formData: { recipientName: 'Maria', email: 'maria@ex.com' },
        aiSongTitle: 'Para a Maria',
        aiLyrics: ['Verso 1', 'Verso 2'],
        dbSongRequestId: 'req-123',
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const { fetchResumeData } = await import('../api/song');
    const result = await fetchResumeData('req-123');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/song/resume-data/req-123', { signal: undefined });
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404 });

    const { fetchResumeData } = await import('../api/song');
    const result = await fetchResumeData('missing');
    expect(result).toBeNull();
  });

  it('returns null on 400 (expired status)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 400 });

    const { fetchResumeData } = await import('../api/song');
    const result = await fetchResumeData('stale');
    expect(result).toBeNull();
  });
});
