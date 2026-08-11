import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Estado partilhado para o mock do Supabase (recriado por teste)
const supabaseState: { query: any } = { query: null };

vi.mock('../services/supabase', () => ({
  getAdminSupabase: () => supabaseState.query,
}));

function buildSupabaseMock(opts: { data?: unknown; count?: number } = {}) {
  const result = () => ({ data: opts.data ?? null, count: opts.count ?? 0, error: null });
  const insert = vi.fn(() => query);
  const update = vi.fn(() => query);
  const select = vi.fn(() => query);
  const eq = vi.fn(() => query);
  const gte = vi.fn(() => query);
  const order = vi.fn(() => query);
  const limit = vi.fn(() => query);

  const query: any = {
    from: () => query,
    insert,
    update,
    select,
    eq,
    gte,
    order,
    limit,
    then: (resolve: (v: unknown) => unknown) => resolve(result()),
  };

  return query;
}

const fetchMock = vi.fn();

async function importSender(overrides: Record<string, string> = {}) {
  vi.resetModules();
  const env: Record<string, string> = {
    WHATSAPP_API_TOKEN: 'test-token',
    WHATSAPP_PHONE_NUMBER_ID: '123456789',
    WHATSAPP_PHONE: '244922058136',
    WHATSAPP_ENABLED_BUCKETS: '30min',
    WHATSAPP_DAILY_CAP: '30',
    WHATSAPP_START_HOUR: '0',
    WHATSAPP_END_HOUR: '24',
    WHATSAPP_MIN_SEND_DELAY_MS: '0',
    WHATSAPP_MAX_SEND_DELAY_MS: '5',
    ...overrides,
  };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('../services/whatsappSender');
}

async function importUnconfigured() {
  vi.resetModules();
  vi.stubEnv('WHATSAPP_API_TOKEN', '');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '');
  return import('../services/whatsappSender');
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  supabaseState.query = buildSupabaseMock({});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('whatsappSender (Cloud API)', () => {
  it('getWhatsAppAppUrl devolve link wa.me limpo', async () => {
    const wa = await importUnconfigured();
    const url = await wa.getWhatsAppAppUrl('+244 922 000 000', 'olá');
    expect(url).toBe('https://wa.me/244922000000?text=ol%C3%A1');
  });

  it('isConfigured false sem env e getLinkStatus.linked false', async () => {
    const wa = await importUnconfigured();
    expect(wa.isConfigured()).toBe(false);
    const st = await wa.getLinkStatus();
    expect(st.linked).toBe(false);
  });

  it('isConfigured true com env e getLinkStatus.linked true com phone', async () => {
    const wa = await importSender();
    expect(wa.isConfigured()).toBe(true);
    const st = await wa.getLinkStatus();
    expect(st.linked).toBe(true);
    expect(st.phone).toBe('244922058136');
  });

  it('getConfigStatus expõe templates e buckets ativos', async () => {
    const wa = await importSender();
    const st = await wa.getConfigStatus();
    expect(st.configured).toBe(true);
    expect(st.phoneNumberId).toBe('123456789');
    expect(st.enabledBuckets).toEqual(['30min']);
    const t = st.templates.find((x: { bucket: string }) => x.bucket === '30min');
    expect(t?.name).toBe('seubeat_abandono_30min');
  });

  it('runSendBulk lança erro quando não configurado', async () => {
    const wa = await importUnconfigured();
    await expect(
      wa.runSendBulk([{ requestId: 'r1', phone: '244900000001', bucket: '30min' }])
    ).rejects.toThrow('WHATSAPP_API_TOKEN');
  });

  it('sendTemplate faz POST com payload de template e devolve messageId', async () => {
    const wa = await importSender();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.123' }] }),
    });

    const r = await wa.sendTemplate('244900000001', 'seubeat_abandono_30min', ['Rui', 'https://seubeat.ao/wizard?resume=x']);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.messageId).toBe('wamid.123');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('graph.facebook.com');
    expect(init.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer test-token' }));
    const body = JSON.parse(String(init.body));
    expect(body.type).toBe('template');
    expect(body.to).toBe('244900000001');
    expect(body.template.name).toBe('seubeat_abandono_30min');
    expect(body.template.language.code).toBe('pt_PT');
    expect(body.template.components[0].parameters).toHaveLength(2);
  });

  it('sendTemplate mapeia 401 para token inválido', async () => {
    const wa = await importSender();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth access token', type: 'OAuthException' } }),
    });
    const r = await wa.sendTemplate('244900000001', 'seubeat_abandono_30min', ['Rui', 'https://x']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Token da WhatsApp API inválido');
  });

  it('sendTemplate mapeia 132000 para template não aprovado', async () => {
    const wa = await importSender();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: 132000, message: 'Template is in paused state' } }),
    });
    const r = await wa.sendTemplate('244900000001', 'seubeat_abandono_30min', ['Rui', 'https://x']);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('não aprovado');
  });

  it('mapWhatsAppApiError trata 131030 (número sem WhatsApp)', async () => {
    const wa = await importSender();
    const m = wa.mapWhatsAppApiError(404, { error: { code: 131030, message: 'not a whatsapp user' } });
    expect(m.message).toBe('Número sem WhatsApp ativo.');
  });

  it('runSendBulk agenda, envia, marca contacto e regista log sent', async () => {
    const wa = await importSender();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ messages: [{ id: 'wamid.42' }] }),
    });

    const res = await wa.runSendBulk([
      { requestId: 'r1', phone: '244900000001', bucket: '30min', params: ['Rui', 'https://x'] },
    ]);
    expect(res.scheduled).toBe(true);

    await wait(30);

    const prog = wa.getSendProgress();
    expect(prog.sent).toBe(1);
    expect(prog.total).toBe(1);
    expect(prog.processed).toBe(1);
    expect(prog.failed).toBe(0);
    expect(prog.running).toBe(false);

    const supabase = supabaseState.query;
    expect(supabase.insert).toHaveBeenCalled();
    const insertRow = supabase.insert.mock.calls[0][0];
    expect(insertRow.status).toBe('sent');
    expect(insertRow.request_id).toBe('r1');
    expect(insertRow.message_id).toBe('wamid.42');
    // markContacted via update em song_requests
    expect(supabase.update).toHaveBeenCalledWith(expect.objectContaining({ manual_contacted_at: expect.any(String) }));
  });

  it('runSendBulk regista skipped para cliente sem telefone', async () => {
    const wa = await importSender();
    await wa.runSendBulk([{ requestId: 'r2', phone: '', bucket: '30min', params: ['Ana', 'https://x'] }]);
    await wait(30);
    const prog = wa.getSendProgress();
    expect(prog.skippedNoWhatsApp).toBe(1);
    expect(prog.sent).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runSendBulk respeita o cap diário', async () => {
    supabaseState.query = buildSupabaseMock({ count: 30 });
    const wa = await importSender();
    await wa.runSendBulk([
      { requestId: 'r1', phone: '244900000001', bucket: '30min', params: ['Rui', 'https://x'] },
      { requestId: 'r2', phone: '244900000002', bucket: '30min', params: ['Ana', 'https://x'] },
    ]);
    await wait(30);
    const prog = wa.getSendProgress();
    expect(prog.sent).toBe(0);
    expect(prog.error).toContain('Cap diário');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('runSendBulk respeita a janela horária', async () => {
    const wa = await importSender({ WHATSAPP_START_HOUR: '0', WHATSAPP_END_HOUR: '0' });
    await wa.runSendBulk([{ requestId: 'r1', phone: '244900000001', bucket: '30min', params: ['Rui', 'https://x'] }]);
    await wait(30);
    const prog = wa.getSendProgress();
    expect(prog.sent).toBe(0);
    expect(prog.error).toContain('Janela');
  });

  it('runSendBulk regista failed quando a API devolve erro fatal', async () => {
    const wa = await importSender();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 132000, message: 'not approved' } }),
    });
    await wa.runSendBulk([{ requestId: 'r1', phone: '244900000001', bucket: '30min', params: ['Rui', 'https://x'] }]);
    await wait(30);
    const prog = wa.getSendProgress();
    expect(prog.failed).toBe(1);
    expect(prog.sent).toBe(0);
    const insertRow = supabaseState.query.insert.mock.calls[0][0];
    expect(insertRow.status).toBe('failed');
  });

  it('handleDeliveryWebhook atualiza o log mais recente com delivered', async () => {
    supabaseState.query = buildSupabaseMock({ data: [{ id: 'log-1' }] });
    const wa = await importSender();
    await wa.handleDeliveryWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  { status: 'delivered', recipient_id: '244900000001', message: { id: 'wamid.99' } },
                ],
              },
            },
          ],
        },
      ],
    });
    const supabase = supabaseState.query;
    expect(supabase.select).toHaveBeenCalledWith('id');
    expect(supabase.update).toHaveBeenCalled();
    const upd = supabase.update.mock.calls[0][0];
    expect(upd.status).toBe('delivered');
    expect(upd.message_id).toBe('wamid.99');
  });
});
