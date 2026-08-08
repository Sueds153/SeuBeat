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

describe('recoverByEmail', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('posts email and returns resume url when found', async () => {
    const mockData = {
      success: true,
      status: 'lyrics_ready',
      resumeUrl: '/wizard?resume=req-9&step=payment',
      requestId: 'req-9',
      recipientName: 'Maria',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const { recoverByEmail } = await import('../api/song');
    const result = await recoverByEmail('maria@ex.com');
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/song/recover-by-email',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'maria@ex.com' }),
      })
    );
  });

  it('returns not-found error on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ status: 404 });

    const { recoverByEmail } = await import('../api/song');
    const result = await recoverByEmail('nao@existe.com');
    expect(result).toEqual({ success: false, error: 'Não encontrámos nenhuma música para esse email.' });
  });

  it('propagates generating status message', async () => {
    const mockData = {
      success: true,
      status: 'lyrics_generating',
      message: 'Ainda a gerar.',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      json: () => Promise.resolve(mockData),
    });

    const { recoverByEmail } = await import('../api/song');
    const result = await recoverByEmail('a@b.com');
    expect(result).toEqual(mockData);
  });

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const { recoverByEmail } = await import('../api/song');
    const result = await recoverByEmail('a@b.com');
    expect(result).toBeNull();
  });
});
