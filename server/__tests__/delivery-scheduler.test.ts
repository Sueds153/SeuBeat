import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminSupabase: vi.fn(),
  sendPersonalizedEmail: vi.fn((..._args: unknown[]) => Promise.resolve(true)),
  sendDeliveryWhatsApp: vi.fn((..._args: unknown[]) => Promise.resolve('sent')),
  sendFeedbackRequestWhatsApp: vi.fn((..._args: unknown[]) => Promise.resolve('sent')),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: () => mocks.getAdminSupabase(),
}));
vi.mock('../services/email', () => ({
  sendPersonalizedEmail: (...args: unknown[]) => mocks.sendPersonalizedEmail(...args),
}));
vi.mock('../services/whatsapp', () => ({
  sendDeliveryWhatsApp: (...args: unknown[]) => mocks.sendDeliveryWhatsApp(...args),
  sendFeedbackRequestWhatsApp: (...args: unknown[]) => mocks.sendFeedbackRequestWhatsApp(...args),
}));
vi.mock('../utils/logger', () => ({
  logInfo: (...args: unknown[]) => mocks.logInfo(...args),
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
  logError: (...args: unknown[]) => mocks.logError(...args),
}));
vi.mock('../utils/helpers', () => ({
  getAppUrl: () => 'https://seubeat.onrender.com',
}));

interface UpdateCall {
  table: string;
  payload: Record<string, unknown>;
}

function buildSupabaseMock(pendingRows: Record<string, unknown>[]) {
  const updateCalls: UpdateCall[] = [];
  const from = vi.fn((table: string) => {
    let mode: 'select' | 'update' = 'select';
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      lte: () => chain,
      not: () => chain,
      upsert: () => chain,
      update: (payload: Record<string, unknown>) => {
        mode = 'update';
        updateCalls.push({ table, payload });
        return chain;
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => unknown) => {
        if (mode === 'update') return resolve({ data: [{ id: 'req-1' }], error: null });
        if (table === 'song_requests') return resolve({ data: pendingRows, error: null });
        return resolve({ data: [], error: null });
      },
    };
    return chain;
  });
  mocks.getAdminSupabase.mockReturnValue({ from });
  return { from, updateCalls };
}

function pendingRow(overrides: Record<string, unknown> = {}, songOverrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    recipient_name: 'Ana',
    status: 'approved',
    deliver_at: '2026-09-24T00:00:00.000Z',
    email: 'cliente@test.com',
    phone: null,
    final_mixed_audio_url: null,
    songs: [
      { id: 'song-1', title: 'Para Ana', letter_text: 'Carta', audio_url: null, full_song_url: null, ...songOverrides },
    ],
    ...overrides,
  };
}

async function runSchedulerOnce(pendingRows: Record<string, unknown>[]) {
  vi.resetModules();
  const sb = buildSupabaseMock(pendingRows);
  const mod = await import('../services/deliveryScheduler');
  mod.startDeliveryScheduler();
  // deliverPendingSongs() é fire-and-forget dentro de start — espera os microtasks/tick.
  await new Promise(r => setTimeout(r, 25));
  return sb;
}

describe('deliveryScheduler — guarda: nunca entregar pedido sem áudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adia a entrega quando a música não tem áudio (não marca delivered)', async () => {
    const sb = await runSchedulerOnce([pendingRow()]);

    expect(sb.updateCalls).toHaveLength(0);
    expect(mocks.sendPersonalizedEmail).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      '[DeliveryScheduler] Pedido aprovado sem áudio — entrega adiada',
      { requestId: 'req-1', songId: 'song-1' }
    );
  });

  it('entrega normalmente quando songs.audio_url existe (comportamento pré-existente)', async () => {
    const sb = await runSchedulerOnce([pendingRow({}, { audio_url: 'https://cdn.example.com/full.mp3' })]);

    const delivered = sb.updateCalls.find(
      u => u.table === 'song_requests' && u.payload.status === 'delivered'
    );
    expect(delivered).toBeTruthy();
    expect(delivered!.payload).toMatchObject({ delivered_at: expect.any(String), deliver_at: null });
    expect(mocks.sendPersonalizedEmail).toHaveBeenCalledWith(
      'cliente@test.com',
      'Ana',
      'https://seubeat.onrender.com/song/ana?id=song-1',
      'Carta'
    );
    expect(mocks.logWarn).not.toHaveBeenCalledWith(
      '[DeliveryScheduler] Pedido aprovado sem áudio — entrega adiada',
      expect.anything()
    );
  });

  it('entrega quando o áudio misturado está no pedido (final_mixed_audio_url)', async () => {
    const sb = await runSchedulerOnce([
      pendingRow({ final_mixed_audio_url: 'https://cdn.example.com/mixed.mp3' }),
    ]);

    const delivered = sb.updateCalls.find(
      u => u.table === 'song_requests' && u.payload.status === 'delivered'
    );
    expect(delivered).toBeTruthy();
  });

  it('sem linha de música não entrega (songId em falta)', async () => {
    const sb = await runSchedulerOnce([pendingRow({ songs: [] })]);

    expect(sb.updateCalls).toHaveLength(0);
    expect(mocks.sendPersonalizedEmail).not.toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledWith('[DeliveryScheduler] songId em falta', { requestId: 'req-1' });
  });
});
