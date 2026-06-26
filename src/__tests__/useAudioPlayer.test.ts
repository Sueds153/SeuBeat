import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useAudioPlayer', () => {
  beforeAll(() => {
    globalThis.Audio = vi.fn().mockImplementation(() => ({
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      muted: false,
      currentTime: 0,
      duration: 60,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof Audio;
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default values', async () => {
    const { useAudioPlayer } = await import('../hooks/useAudioPlayer');
    const { result } = renderHook(() => useAudioPlayer({ audioUrl: '' }));

    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isMuted).toBe(false);
    expect(result.current.audioProgress).toBe(0);
  });

  it('toggles isPlaying on togglePlay', async () => {
    const { useAudioPlayer } = await import('../hooks/useAudioPlayer');
    const { result } = renderHook(() => useAudioPlayer({ audioUrl: 'https://example.com/audio.mp3' }));

    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(true);

    act(() => { result.current.togglePlay(); });
    expect(result.current.isPlaying).toBe(false);
  });

  it('toggles isMuted on toggleMute', async () => {
    const { useAudioPlayer } = await import('../hooks/useAudioPlayer');
    const { result } = renderHook(() => useAudioPlayer({ audioUrl: 'https://example.com/audio.mp3' }));

    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(true);

    act(() => { result.current.toggleMute(); });
    expect(result.current.isMuted).toBe(false);
  });

  it('sets isPlaying via setIsPlaying', async () => {
    const { useAudioPlayer } = await import('../hooks/useAudioPlayer');
    const { result } = renderHook(() => useAudioPlayer({ audioUrl: 'https://example.com/audio.mp3' }));

    act(() => { result.current.setIsPlaying(true); });
    expect(result.current.isPlaying).toBe(true);
  });
});
