import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
  uploadToSupabase: vi.fn(),
}));
vi.mock('../services/audio', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  convertToWav: vi.fn().mockResolvedValue(undefined),
  createPreviewAudio: vi.fn(),
  applyFades: vi.fn(),
  getAudioDuration: vi.fn(),
}));
vi.mock('../services/suno', () => ({
  querySunoTask: vi.fn(),
  generateFullSong: vi.fn(),
}));
vi.mock('../services/suno-voice', () => ({
  generateValidationPhrase: vi.fn(),
  waitForValidationPhrase: vi.fn(),
  createCustomVoice: vi.fn(),
  waitForVoiceId: vi.fn(),
  checkVoiceAvailability: vi.fn(),
}));
vi.mock('../services/email', () => ({
  sendPersonalizedEmail: vi.fn().mockResolvedValue(true),
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendAdminNotification: vi.fn().mockResolvedValue(true),
  sendWorkflowFailedEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('../utils/helpers', () => ({
  getAudioFileInfo: vi.fn(),
  getAppUrl: vi.fn(() => 'https://seubeat.onrender.com'),
}));
vi.mock('../utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { getAdminSupabase, uploadToSupabase } from '../services/supabase';
import {
  generateValidationPhrase,
  waitForValidationPhrase,
  createCustomVoice,
  waitForVoiceId,
  checkVoiceAvailability,
} from '../services/suno-voice';
import { processSunoVoice } from '../services/workflow';

function buildSupabaseMock(row: unknown) {
  const updateCalls: Array<{ table: string; payload: unknown }> = [];
  const client = {
    from: (table: string) => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        single: () => Promise.resolve({ data: row, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        update: (payload: unknown) => {
          updateCalls.push({ table, payload });
          return {
            eq: () => ({
              then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          };
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      };
      return builder;
    },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
  };
  return { updateCalls, client };
}

beforeEach(() => {
  vi.clearAllMocks();
  (uploadToSupabase as ReturnType<typeof vi.fn>).mockResolvedValue('https://public.example.com/sunovoice/sample.wav');
});

describe('processSunoVoice', () => {
  it('reutiliza o validation_task_id do wizard (após verificar que a task é válida) e cria a voz a partir da gravação da frase', async () => {
    const row = { language: 'Português', elevenlabs_voice_id: '{"validation_task_id":"vt-1","phrase":"frase do wizard"}' };
    const { updateCalls, client } = buildSupabaseMock(row);
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (waitForValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'vt-1', validateInfo: 'frase do wizard', status: 'success' });
    (createCustomVoice as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-1', voiceId: null, status: 'processing' });
    (waitForVoiceId as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-1', voiceId: 'voice-1', status: 'success' });
    (checkVoiceAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });

    const result = await processSunoVoice('req-1', 'song-1', 'http://sample.example.com/x.wav');

    expect(result).toBe('voice-1');
    expect(generateValidationPhrase).not.toHaveBeenCalled();
    expect(waitForValidationPhrase).toHaveBeenCalledTimes(1);
    expect(waitForValidationPhrase).toHaveBeenCalledWith('vt-1', 5);
    expect(createCustomVoice).toHaveBeenCalledTimes(1);
    expect(createCustomVoice).toHaveBeenCalledWith(
      'vt-1',
      'https://public.example.com/sunovoice/sample.wav',
      'SeuBeat_req-1',
      'Custom voice from SeuBeat',
      '',
      'professional'
    );
    const voiceUpdate = updateCalls.find((u) => u.table === 'song_requests');
    expect(voiceUpdate).toBeDefined();
    const meta = JSON.parse(String((voiceUpdate!.payload as Record<string, unknown>).elevenlabs_voice_id));
    expect(meta.id).toBe('voice-1');
    expect(meta.taskId).toBe('create-1');
    expect(typeof meta.ts).toBe('number');
  });

  it('sem validation_task_id usa o fallback legado (gera a frase) mas continua a criar a voz', async () => {
    const row = { language: 'Português', elevenlabs_voice_id: null };
    const { client } = buildSupabaseMock(row);
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (generateValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'val-1' });
    (waitForValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'val-1', validateInfo: 'frase', status: 'wait_validating' });
    (createCustomVoice as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-2', voiceId: null, status: 'processing' });
    (waitForVoiceId as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-2', voiceId: 'voice-2', status: 'success' });
    (checkVoiceAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });

    const result = await processSunoVoice('req-2', 'song-2', 'http://sample.example.com/y.wav');

    expect(result).toBe('voice-2');
    expect(generateValidationPhrase).toHaveBeenCalledTimes(1);
    expect(createCustomVoice).toHaveBeenCalledWith(
      'val-1',
      'https://public.example.com/sunovoice/sample.wav',
      'SeuBeat_req-2',
      'Custom voice from SeuBeat',
      '',
      'professional'
    );
  });

  it('devolve null e guarda failed quando a criação da voz falha (degradação silenciosa controlada)', async () => {
    const row = { language: 'Português', elevenlabs_voice_id: '{"validation_task_id":"vt-3"}' };
    const { updateCalls, client } = buildSupabaseMock(row);
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (waitForValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'vt-3', validateInfo: 'alguma frase', status: 'success' });
    (createCustomVoice as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Suno Voice creation failed: it did not sound like the phrase'));

    const result = await processSunoVoice('req-3', 'song-3', 'http://sample.example.com/z.wav');

    expect(result).toBeNull();
    const failedUpdate = updateCalls.find((u) => u.table === 'song_requests');
    expect(failedUpdate).toBeDefined();
    expect(String((failedUpdate!.payload as Record<string, unknown>).elevenlabs_voice_id)).toContain('failed');
  });

  it('recupera task de validação expirada gerando uma nova frase (fallback)', async () => {
    const row = { language: 'Português', elevenlabs_voice_id: '{"validation_task_id":"vt-expired","phrase":"frase antiga"}' };
    const { client } = buildSupabaseMock(row);
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (waitForValidationPhrase as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('Suno Voice validation phrase not ready after 5 attempts'))
      .mockResolvedValueOnce({ taskId: 'val-fresh', validateInfo: 'frase nova', status: 'success' });
    (generateValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'val-fresh' });
    (createCustomVoice as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-4', voiceId: null, status: 'processing' });
    (waitForVoiceId as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-4', voiceId: 'voice-4', status: 'success' });
    (checkVoiceAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });

    const result = await processSunoVoice('req-4', 'song-4', 'http://sample.example.com/w.wav');

    expect(result).toBe('voice-4');
    expect(waitForValidationPhrase).toHaveBeenCalledTimes(2);
    expect(generateValidationPhrase).toHaveBeenCalledTimes(1);
    expect(createCustomVoice).toHaveBeenCalledWith(
      'val-fresh',
      'https://public.example.com/sunovoice/sample.wav',
      'SeuBeat_req-4',
      'Custom voice from SeuBeat',
      '',
      'professional'
    );
  });

  it('descarta a task reutilizada quando a frase devolvida não corresponde à que o cliente gravou', async () => {
    const row = { language: 'Português', elevenlabs_voice_id: '{"validation_task_id":"vt-mismatch","phrase":"frase A"}' };
    const { client } = buildSupabaseMock(row);
    (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue(client);
    (waitForValidationPhrase as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ taskId: 'vt-mismatch', validateInfo: 'frase B', status: 'success' })
      .mockResolvedValueOnce({ taskId: 'val-fresh2', validateInfo: 'frase nova', status: 'success' });
    (generateValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'val-fresh2' });
    (createCustomVoice as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-5', voiceId: null, status: 'processing' });
    (waitForVoiceId as ReturnType<typeof vi.fn>).mockResolvedValue({ taskId: 'create-5', voiceId: 'voice-5', status: 'success' });
    (checkVoiceAvailability as ReturnType<typeof vi.fn>).mockResolvedValue({ isAvailable: true });

    const result = await processSunoVoice('req-5', 'song-5', 'http://sample.example.com/v.wav');

    expect(result).toBe('voice-5');
    expect(generateValidationPhrase).toHaveBeenCalledTimes(1);
    expect(createCustomVoice).toHaveBeenCalledWith(
      'val-fresh2',
      'https://public.example.com/sunovoice/sample.wav',
      'SeuBeat_req-5',
      'Custom voice from SeuBeat',
      '',
      'professional'
    );
  });
});
