import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
  uploadToSupabase: vi.fn(),
}));
vi.mock('../services/audio', () => ({
  downloadFile: vi.fn().mockResolvedValue(undefined),
  convertToWav: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../services/suno-voice', () => ({
  getValidationPhrase: vi.fn(),
  generateValidationPhrase: vi.fn(),
  waitForValidationPhrase: vi.fn(),
  createCustomVoice: vi.fn(),
  waitForVoiceId: vi.fn(),
  checkVoiceAvailability: vi.fn(),
}));
vi.mock('../services/metaPixelCapi', () => ({
  generateServerEventId: vi.fn(() => 'evt-test'),
  sendInitiateCheckoutEvent: vi.fn().mockResolvedValue(true),
  sendAddPaymentInfoEvent: vi.fn().mockResolvedValue(true),
  sendSubmitApplicationEvent: vi.fn().mockResolvedValue(true),
  sendLeadEvent: vi.fn().mockResolvedValue(true),
  sendCompleteRegistrationEvent: vi.fn().mockResolvedValue(true),
  sendPurchaseEvent: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/email', () => ({
  sendPersonalizedEmail: vi.fn().mockResolvedValue(true),
  sendConfirmationEmail: vi.fn().mockResolvedValue(true),
  sendAdminNotification: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/ai', () => ({ generateLyrics: vi.fn() }));
vi.mock('../services/workflow', () => ({
  setProgress: vi.fn(),
  updateRequestStatus: vi.fn().mockResolvedValue(undefined),
  runBackgroundSunoWorkflow: vi.fn(),
  resumeSunoTaskWorkflow: vi.fn(),
  processSunoVoice: vi.fn(),
}));

import { uploadToSupabase } from '../services/supabase';
import { getValidationPhrase } from '../services/suno-voice';
import publicRouter from '../routes/public';

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api', publicRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const addr = server?.address();
  if (!addr || typeof addr === 'string') throw new Error('Sem endereço');
  return `http://127.0.0.1:${addr.port}`;
}

afterAll(() => {
  server?.close();
  server = null;
});

beforeEach(() => {
  vi.clearAllMocks();
  (uploadToSupabase as ReturnType<typeof vi.fn>).mockResolvedValue('https://preview.example.com/sunovoice/phrase_test.wav');
});

function sampleBase64(bytes = 4096): string {
  return 'data:audio/wav;base64,' + Buffer.alloc(bytes, 1).toString('base64');
}

function validBody() {
  return {
    voiceSampleBase64: sampleBase64(),
    voiceSampleFilename: 'sample.wav',
    voiceSampleMimeType: 'audio/wav',
    language: 'Português',
  };
}

describe('POST /api/song/voice/validation-phrase', () => {
  it('devolve a frase + validationTaskId quando a amostra é válida', async () => {
    const base = await startServer();
    (getValidationPhrase as ReturnType<typeof vi.fn>).mockResolvedValue({
      taskId: 'vt-123',
      phrase: 'Canta comigo ao luar',
    });

    const res = await fetch(`${base}/api/song/voice/validation-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.phrase).toBe('Canta comigo ao luar');
    expect(body.data.validationTaskId).toBe('vt-123');
    expect(uploadToSupabase).toHaveBeenCalledTimes(1);
    const bucket = (uploadToSupabase as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(bucket).toBe('preview');
    expect(getValidationPhrase).toHaveBeenCalledTimes(1);
    expect(getValidationPhrase).toHaveBeenCalledWith('https://preview.example.com/sunovoice/phrase_test.wav', 'pt');
  });

  it('rejeita pedido sem amostra de voz', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/song/voice/validation-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: 'Português' }),
    });
    expect(res.status).toBe(400);
    expect(getValidationPhrase).not.toHaveBeenCalled();
  });

  it('rejeita formato de áudio inválido', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/song/voice/validation-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), voiceSampleMimeType: 'application/pdf' }),
    });
    expect(res.status).toBe(400);
    expect(getValidationPhrase).not.toHaveBeenCalled();
  });

  it('rejeita amostra demasiado pequena (< 1024 bytes)', async () => {
    const base = await startServer();
    const res = await fetch(`${base}/api/song/voice/validation-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validBody(), voiceSampleBase64: sampleBase64(512) }),
    });
    expect(res.status).toBe(400);
    expect(getValidationPhrase).not.toHaveBeenCalled();
  });

  it('devolve mensagem amigável quando a Suno Voice falha', async () => {
    const base = await startServer();
    (getValidationPhrase as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Suno Voice validation failed after 30 attempts')
    );
    const res = await fetch(`${base}/api/song/voice/validation-phrase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody()),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('frase de validação');
  });
});
