import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminSupabase: vi.fn(),
  generateLyrics: vi.fn(),
  sendLyricsRecoveredEmail: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: () => mocks.getAdminSupabase(),
}));

vi.mock('../services/ai', () => ({
  generateLyrics: (...args: unknown[]) => mocks.generateLyrics(...args),
}));

vi.mock('../services/email', () => ({
  sendLyricsRecoveredEmail: (...args: unknown[]) => mocks.sendLyricsRecoveredEmail(...args),
}));

vi.mock('../utils/logger', () => ({
  logInfo: (...args: unknown[]) => mocks.logInfo(...args),
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
  logError: (...args: unknown[]) => mocks.logError(...args),
}));

import {
  pickRecoveryCandidates,
  buildRecoveryFormData,
  processFailedLyricsRecovery,
} from '../services/failedLyricsRecoveryScheduler';

interface MockResult {
  data?: unknown;
  error?: unknown;
}

interface SupabaseConfig {
  candidates?: MockResult;
  recoverable?: MockResult;
  claim?: MockResult;
  songInsert?: MockResult;
  statusUpdate?: MockResult;
}

function buildSupabaseMock(config: SupabaseConfig = {}) {
  const results: Record<string, MockResult> = {
    candidates: { data: [], error: null },
    recoverable: { data: [], error: null },
    claim: { data: { id: 'claimed' }, error: null },
    songInsert: { data: { id: 'song-1' }, error: null },
    statusUpdate: { data: [{ id: 'req-1' }], error: null },
    ...config,
  };
  let lastOp = 'select';

  let chain!: Record<string, unknown>;
  const from = vi.fn(() => chain);
  const insert = vi.fn().mockReturnValue(Promise.resolve(results.songInsert));

  chain = {
    select: () => {
      lastOp = 'select';
      return chain;
    },
    eq: () => chain,
    in: () => chain,
    is: () => chain,
    not: () => chain,
    neq: () => chain,
    gte: () => chain,
    filter: () => {
      lastOp = 'claim';
      return chain;
    },
    order: () => {
      lastOp = 'candidates';
      return chain;
    },
    limit: () => {
      lastOp = 'recoverable';
      return chain;
    },
    update: () => {
      lastOp = 'statusUpdate';
      return chain;
    },
    insert,
    maybeSingle: () => Promise.resolve(results.claim),
    single: () => Promise.resolve(results.candidates),
    then: (resolve: (v: MockResult) => unknown) => resolve(results[lastOp]),
  };

  mocks.getAdminSupabase.mockReturnValue({ from });
  return { from, insert };
}

const baseCandidate = {
  id: 'req-1',
  email: 'a@b.pt',
  recipient_name: 'Ana',
  recipient_gender: 'Feminino',
  relationship: 'Parceiro',
  recipient_nick: 'Nicky',
  occasion: 'Aniversário',
  music_style: 'Semba',
  voice_type: 'Feminina',
  memory: 'memoria',
  special_traits: 'traits',
  only_she_does: 'so ela',
  where_it_happened: 'onde',
  why_created_today: 'porque',
  reference_artist: 'artista',
  heart_message: 'mensagem',
  hook_phrase: 'frase',
  desired_emotion: 'Feliz',
  language: 'português',
  users: { name: 'Ze' },
  songs: [],
  created_at: new Date().toISOString(),
  error_details: { kind: 'transient' },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminSupabase.mockReturnValue(null);
  mocks.generateLyrics.mockResolvedValue({
    result: { songTitle: 'T', lyrics: ['a', 'b'], lyricsSnippet: 'S', letterText: 'L' },
    provider: 'gemini',
  });
});

describe('pickRecoveryCandidates', () => {
  it('devolve um candidato por email, dentro da janela e sem música', () => {
    const now = Date.now();
    const newest = { ...baseCandidate, id: 'newest' };
    const dup = { ...baseCandidate, id: 'dup', created_at: new Date(now - 2000).toISOString() };
    const old = { ...baseCandidate, id: 'old', created_at: new Date(now - 49 * 3600 * 1000).toISOString() };
    const withSong = { ...baseCandidate, id: 'with-song', songs: [{ id: 's1' }] };
    const noEmail = { ...baseCandidate, id: 'no-email', email: null };

    const picked = pickRecoveryCandidates([newest, dup, old, withSong, noEmail], now);
    expect(picked.map((r) => r.id)).toEqual(['newest']);
  });

  it('ignora requests sem created_at válido', () => {
    const bad = { ...baseCandidate, id: 'bad', created_at: 'not-a-date' };
    expect(pickRecoveryCandidates([bad])).toEqual([]);
  });
});

describe('buildRecoveryFormData', () => {
  it('mapeia os campos da BD para o WizardFormData', () => {
    const fd = buildRecoveryFormData(baseCandidate);
    expect(fd.userNick).toBe('Ze');
    expect(fd.recipientName).toBe('Ana');
    expect(fd.recipientGender).toBe('Feminino');
    expect(fd.recipientRelation).toBe('Parceiro');
    expect(fd.recipientNick).toBe('Nicky');
    expect(fd.occasion).toBe('Aniversário');
    expect(fd.musicStyle).toBe('Semba');
    expect(fd.voiceType).toBe('Feminina');
    expect(fd.unforgettableMemory).toBe('memoria');
    expect(fd.whatMakesSpecial).toBe('traits');
    expect(fd.onlySheDoes).toBe('so ela');
    expect(fd.whereItHappened).toBe('onde');
    expect(fd.whyCreatedToday).toBe('porque');
    expect(fd.referenceArtist).toBe('artista');
    expect(fd.messageFromTheHeart).toBe('mensagem');
    expect(fd.hookPhrase).toBe('frase');
    expect(fd.desiredEmotion).toBe('Feliz');
    expect(fd.language).toBe('português');
  });

  it('aplica defaults quando os campos opcionais faltam', () => {
    const fd = buildRecoveryFormData({ id: 'x', email: 'e@e.pt' });
    expect(fd.userNick).toBe('Autor');
    expect(fd.recipientName).toBe('Destinatario');
    expect(fd.musicStyle).toBe('Kizomba');
    expect(fd.language).toBe('português');
  });
});

describe('processFailedLyricsRecovery', () => {
  it('recupera pedido falhado: gera letra, cria song e marca lyrics_ready', async () => {
    const { insert } = buildSupabaseMock({
      candidates: { data: [baseCandidate], error: null },
      recoverable: { data: [], error: null },
    });

    await processFailedLyricsRecovery();

    expect(mocks.generateLyrics).toHaveBeenCalledTimes(1);
    expect(mocks.generateLyrics).toHaveBeenCalledWith(
      expect.objectContaining({ recipientName: 'Ana', userNick: 'Ze', musicStyle: 'Semba' }),
      expect.objectContaining({ requestId: 'req-1', email: 'a@b.pt' })
    );
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        request_id: 'req-1',
        title: 'T',
        lyrics: ['a', 'b'],
        lyrics_snippet: 'S',
        letter_text: 'L',
        mureka_status: 'not_started',
      }),
    ]);
    expect(mocks.sendLyricsRecoveredEmail).toHaveBeenCalledWith('a@b.pt', 'Ana', 'req-1');
  });

  it('não regenera email que já tem outro pedido recuperável', async () => {
    buildSupabaseMock({
      candidates: { data: [baseCandidate], error: null },
      recoverable: { data: [{ id: 'outro-pedido' }], error: null },
    });

    await processFailedLyricsRecovery();

    expect(mocks.generateLyrics).not.toHaveBeenCalled();
    expect(mocks.sendLyricsRecoveredEmail).not.toHaveBeenCalled();
  });

  it('não regenera quando outro worker já reclamou o pedido', async () => {
    buildSupabaseMock({
      candidates: { data: [baseCandidate], error: null },
      recoverable: { data: [], error: null },
      claim: { data: null, error: null },
    });

    await processFailedLyricsRecovery();

    expect(mocks.generateLyrics).not.toHaveBeenCalled();
    expect(mocks.sendLyricsRecoveredEmail).not.toHaveBeenCalled();
  });

  it('não rebenta quando a geração falha e não envia email', async () => {
    mocks.generateLyrics.mockRejectedValue(new Error('503 high demand'));
    buildSupabaseMock({
      candidates: { data: [baseCandidate], error: null },
      recoverable: { data: [], error: null },
    });

    await expect(processFailedLyricsRecovery()).resolves.toBeUndefined();
    expect(mocks.sendLyricsRecoveredEmail).not.toHaveBeenCalled();
    expect(mocks.logError).toHaveBeenCalled();
  });

  it('sai cedo quando não há candidatos', async () => {
    buildSupabaseMock({
      candidates: { data: [], error: null },
      recoverable: { data: [], error: null },
    });

    await processFailedLyricsRecovery();

    expect(mocks.generateLyrics).not.toHaveBeenCalled();
  });

  it('não gera quando todos os candidatos já têm música', async () => {
    const withSong = { ...baseCandidate, id: 'with-song', songs: [{ id: 's1' }] };
    buildSupabaseMock({
      candidates: { data: [withSong], error: null },
      recoverable: { data: [], error: null },
    });

    await processFailedLyricsRecovery();

    expect(mocks.generateLyrics).not.toHaveBeenCalled();
    expect(mocks.sendLyricsRecoveredEmail).not.toHaveBeenCalled();
  });
});
