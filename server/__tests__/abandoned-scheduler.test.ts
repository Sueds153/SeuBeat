import { describe, it, expect, beforeEach, vi } from 'vitest';

process.env.WHATSAPP_ENABLED_BUCKETS = '30min';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

vi.mock('../services/email', () => ({
  sendAbandonedFirstReminder: vi.fn().mockResolvedValue(undefined),
  sendAbandonedSecondReminder: vi.fn().mockResolvedValue(undefined),
  sendAbandonedThirdReminder: vi.fn().mockResolvedValue(undefined),
  sendAbandonedFourthReminder: vi.fn().mockResolvedValue(undefined),
  sendAbandonedFifthReminder: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/whatsappSender', () => ({
  sendAbandonedWhatsApp: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';
import { sendAbandonedWhatsApp } from '../services/whatsappSender';
import { sendAbandonedFirstReminder } from '../services/email';
import { checkPaymentStatus, processAbandonedRecovery } from '../services/abandonedRecoveryScheduler';

const mockedGetAdminSupabase = getAdminSupabase as ReturnType<typeof vi.fn>;
const mockedSendWhatsApp = sendAbandonedWhatsApp as ReturnType<typeof vi.fn>;
const mockedEmail30 = sendAbandonedFirstReminder as ReturnType<typeof vi.fn>;
function buildSupabaseMock(opts: {
  requests?: unknown[];
  paymentStatus?: string | null;
}) {
  const payment = opts.paymentStatus
    ? { data: { status: opts.paymentStatus }, error: null }
    : { data: null, error: null };
  const query = {
    from: (table: string) => {
      if (table === 'payments') {
        const paymentQuery = {
          select: () => paymentQuery,
          eq: () => paymentQuery,
          maybeSingle: () => Promise.resolve(payment),
        };
        return paymentQuery;
      }
      return query;
    },
    select: () => query,
    in: () => query,
    is: () => query,
    not: () => query,
    update: vi.fn(() => query),
    eq: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (v: unknown) => unknown) =>
      resolve({ data: opts.requests ?? [], error: null }),
  };
  mockedGetAdminSupabase.mockReturnValue({ from: (table: string) => query.from(table) });
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('checkPaymentStatus', () => {
  it('devolve false sem registo de pagamento (ainda não pagou → envia WhatsApp)', async () => {
    buildSupabaseMock({ paymentStatus: null });
    expect(await checkPaymentStatus('req-1')).toBe(false);
  });

  it('devolve true com pagamento approved (já pagou → não envia)', async () => {
    buildSupabaseMock({ paymentStatus: 'approved' });
    expect(await checkPaymentStatus('req-1')).toBe(true);
  });

  it('devolve true com pagamento delivered (já pagou → não envia)', async () => {
    buildSupabaseMock({ paymentStatus: 'delivered' });
    expect(await checkPaymentStatus('req-1')).toBe(true);
  });

  it('devolve false com pagamento rejeitado (não pagou → envia)', async () => {
    buildSupabaseMock({ paymentStatus: 'rejected' });
    expect(await checkPaymentStatus('req-1')).toBe(false);
  });

  it('devolve false com pagamento pending (ainda não aprovado → envia)', async () => {
    buildSupabaseMock({ paymentStatus: 'pending_verification' });
    expect(await checkPaymentStatus('req-1')).toBe(false);
  });
});

describe('processAbandonedRecovery (WhatsApp)', () => {
  const request = (over: Partial<Record<string, unknown>>) => ({
    id: 'req-1',
    email: 'cliente@teste.com',
    recipient_name: 'Rui',
    phone: '244900000001',
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    abandoned_30min_sent_at: null,
    abandoned_24h_sent_at: null,
    abandoned_48h_sent_at: null,
    abandoned_72h_sent_at: null,
    abandoned_7d_sent_at: null,
    whatsapp_30min_sent_at: null,
    whatsapp_24h_sent_at: null,
    whatsapp_48h_sent_at: null,
    whatsapp_72h_sent_at: null,
    user_id: null,
    users: [],
    songs: [],
    ...over,
  });

  it('envia WhatsApp para cliente sem pagamento no bucket 30min', async () => {
    mockedSendWhatsApp.mockResolvedValue('sent');
    buildSupabaseMock({ requests: [request({})], paymentStatus: null });

    await processAbandonedRecovery();

    expect(mockedSendWhatsApp).toHaveBeenCalledTimes(1);
    const arg = mockedSendWhatsApp.mock.calls[0][0];
    expect(arg.requestId).toBe('req-1');
    expect(arg.bucket).toBe('30min');
    expect(arg.templateName).toBe('seubeat_abandono_30min_v6');
    expect(arg.params[0]).toBe('Rui');
    expect(arg.params[1]).toContain('/wizard?resume=req-1');
  });

  it('NÃO envia WhatsApp quando o cliente já pagou (approved)', async () => {
    mockedSendWhatsApp.mockResolvedValue('sent');
    buildSupabaseMock({ requests: [request({})], paymentStatus: 'approved' });

    await processAbandonedRecovery();

    expect(mockedSendWhatsApp).not.toHaveBeenCalled();
  });

  it('NÃO reenvia WhatsApp quando a flag whatsapp_30min_sent_at já está marcada', async () => {
    mockedSendWhatsApp.mockResolvedValue('sent');
    buildSupabaseMock({
      requests: [request({ whatsapp_30min_sent_at: new Date().toISOString() })],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedSendWhatsApp).not.toHaveBeenCalled();
  });

  it('NÃO marca a flag quando o envio falha', async () => {
    mockedSendWhatsApp.mockResolvedValue('failed');
    // email já enviado (flag marcada) para isolar o fluxo WhatsApp
    const query = buildSupabaseMock({
      requests: [request({ abandoned_30min_sent_at: new Date().toISOString() })],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedSendWhatsApp).toHaveBeenCalledTimes(1);
    expect(query.update).not.toHaveBeenCalled();
  });

  it('email e WhatsApp mantêm dedupe independente (email enviado não bloqueia WhatsApp)', async () => {
    mockedSendWhatsApp.mockResolvedValue('sent');
    // email 30min já foi enviado (flag de email marcada), mas WhatsApp ainda não
    buildSupabaseMock({
      requests: [request({ abandoned_30min_sent_at: new Date().toISOString() })],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedSendWhatsApp).toHaveBeenCalledTimes(1);
    // email não é reenviado
    expect(mockedEmail30).not.toHaveBeenCalled();
  });

  it('envia o 5º lembrete (7 dias) por email para leads >7 dias sem flag', async () => {
    const { sendAbandonedFifthReminder } = await import('../services/email');
    const mockedEmail7d = sendAbandonedFifthReminder as ReturnType<typeof vi.fn>;
    const query = buildSupabaseMock({
      requests: [request({ created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() })],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedEmail7d).toHaveBeenCalledTimes(1);
    expect(mockedEmail7d.mock.calls[0][0]).toBe('cliente@teste.com');
    expect(query.update).toHaveBeenCalled();
  });

  it('NÃO reenvia o 5º lembrete quando abandoned_7d_sent_at já está marcada', async () => {
    const { sendAbandonedFifthReminder } = await import('../services/email');
    const mockedEmail7d = sendAbandonedFifthReminder as ReturnType<typeof vi.fn>;
    const marked = new Date().toISOString();
    buildSupabaseMock({
      requests: [
        request({
          created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          abandoned_30min_sent_at: marked,
          abandoned_24h_sent_at: marked,
          abandoned_48h_sent_at: marked,
          abandoned_72h_sent_at: marked,
          abandoned_7d_sent_at: marked,
        }),
      ],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedEmail7d).not.toHaveBeenCalled();
  });

  it('passa título e snippet da letra (songs) ao lembrete por email', async () => {
    const { sendAbandonedFirstReminder } = await import('../services/email');
    const mockedEmail = sendAbandonedFirstReminder as ReturnType<typeof vi.fn>;
    buildSupabaseMock({
      requests: [
        request({
          created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          songs: [{ title: 'Canção para a Maria', lyrics_snippet: 'No silêncio da noite, o teu nome é melodia…' }],
        }),
      ],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedEmail).toHaveBeenCalledTimes(1);
    const args = mockedEmail.mock.calls[0];
    expect(args[0]).toBe('cliente@teste.com');
    expect(args[1]).toBe('Rui');
    expect(args[3]).toBe('Canção para a Maria');
    expect(args[4]).toBe('No silêncio da noite, o teu nome é melodia…');
  });

  it('passa snippet vazio ao email quando o pedido não tem música (sem quebrar)', async () => {
    const { sendAbandonedFirstReminder } = await import('../services/email');
    const mockedEmail = sendAbandonedFirstReminder as ReturnType<typeof vi.fn>;
    buildSupabaseMock({
      requests: [
        request({
          created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          songs: [],
        }),
      ],
      paymentStatus: null,
    });

    await processAbandonedRecovery();

    expect(mockedEmail).toHaveBeenCalledTimes(1);
    const args = mockedEmail.mock.calls[0];
    expect(args[3]).toBe('');
    expect(args[4]).toBe('');
  });
});