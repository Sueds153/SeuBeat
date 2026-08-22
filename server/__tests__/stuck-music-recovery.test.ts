import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminSupabase: vi.fn(),
  runBackgroundSunoWorkflow: vi.fn(),
  resumeSunoTaskWorkflow: vi.fn(),
  querySunoTask: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  getAdminSupabase: () => mocks.getAdminSupabase(),
}));

vi.mock('../services/workflow', () => ({
  runBackgroundSunoWorkflow: (...args: unknown[]) => mocks.runBackgroundSunoWorkflow(...args),
  resumeSunoTaskWorkflow: (...args: unknown[]) => mocks.resumeSunoTaskWorkflow(...args),
}));

vi.mock('../services/suno', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/suno')>();
  return {
    ...actual,
    querySunoTask: (...args: unknown[]) => mocks.querySunoTask(...args),
  };
});

vi.mock('../utils/logger', () => ({
  logInfo: (...args: unknown[]) => mocks.logInfo(...args),
  logWarn: (...args: unknown[]) => mocks.logWarn(...args),
  logError: (...args: unknown[]) => mocks.logError(...args),
}));

import { processStuckMusicRecovery } from '../services/stuckMusicRecoveryScheduler';

interface MockResult {
  data?: unknown;
  error?: unknown;
}

interface SupabaseConfig {
  candidates?: MockResult;
  claim?: MockResult;
}

function buildSupabaseMock(config: SupabaseConfig = {}) {
  const results: Record<string, MockResult> = {
    candidates: { data: [], error: null },
    claim: { data: { id: 'claimed' }, error: null },
    ...config,
  };
  let lastOp = 'select';

  let chain!: Record<string, unknown>;
  const from = vi.fn(() => chain);
  const update = vi.fn((..._args: unknown[]) => chain);

  chain = {
    select: () => {
      lastOp = 'select';
      return chain;
    },
    eq: () => chain,
    in: () => chain,
    is: () => chain,
    not: () => chain,
    lt: () => chain,
    order: () => {
      lastOp = 'candidates';
      return chain;
    },
    update,
    maybeSingle: () => Promise.resolve(results.claim),
    then: (resolve: (v: MockResult) => unknown) => resolve(results[lastOp]),
  };

  mocks.getAdminSupabase.mockReturnValue({ from });
  return { from, update };
}

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'song-1',
    request_id: 'req-1',
    title: 'Nair, Minha Benguela',
    lyrics: ['linha 1', 'linha 2'],
    mureka_task_id: null,
    mureka_status: 'generating',
    updated_at: '2026-08-20T17:30:45.000Z',
    song_requests: [
      { id: 'req-1', status: 'music_processing', music_style: 'kizomba', voice_type: 'Feminina', desired_emotion: 'Feliz', deleted_at: null },
    ],
    ...overrides,
  };
}

describe('processStuckMusicRecovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.querySunoTask.mockResolvedValue({ taskId: 'task-1', audioUrl: null, status: 'processing' });
  });

  it('reinicia o workflow quando a música está presa sem task id', async () => {
    const { from } = buildSupabaseMock({ candidates: { data: [baseRow()], error: null } });
    mocks.runBackgroundSunoWorkflow.mockResolvedValue(undefined);

    await processStuckMusicRecovery();

    expect(from).toHaveBeenCalledWith('songs');
    expect(mocks.runBackgroundSunoWorkflow).toHaveBeenCalledTimes(1);
    expect(mocks.runBackgroundSunoWorkflow).toHaveBeenCalledWith(
      'req-1',
      'song-1',
      'kizomba',
      'Nair, Minha Benguela',
      ['linha 1', 'linha 2'],
      { voiceType: 'Feminina', desiredEmotion: 'Feliz' }
    );
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });

  it('retoma a task Suno quando existe mureka_task_id', async () => {
    const row = baseRow({ mureka_task_id: 'task-1', mureka_status: 'processing' });
    buildSupabaseMock({ candidates: { data: [row], error: null } });
    mocks.resumeSunoTaskWorkflow.mockResolvedValue(undefined);

    await processStuckMusicRecovery();

    expect(mocks.resumeSunoTaskWorkflow).toHaveBeenCalledTimes(1);
    expect(mocks.resumeSunoTaskWorkflow).toHaveBeenCalledWith('req-1', 'song-1', 'task-1');
    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
  });

  it('não duplica quando outro ciclo já reclamou a música', async () => {
    buildSupabaseMock({ candidates: { data: [baseRow()], error: null }, claim: { data: null, error: null } });

    await processStuckMusicRecovery();

    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });

  it('ignora músicas cujo pedido não está em geração ativa', async () => {
    const row = baseRow({ song_requests: [{ id: 'req-1', status: 'lyrics_ready', music_style: 'kizomba', deleted_at: null }] });
    buildSupabaseMock({ candidates: { data: [row], error: null } });

    await processStuckMusicRecovery();

    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });

  it('ignora músicas de pedidos apagados', async () => {
    const row = baseRow({ song_requests: [{ id: 'req-1', status: 'music_processing', music_style: 'kizomba', deleted_at: '2026-08-20T18:00:00.000Z' }] });
    buildSupabaseMock({ candidates: { data: [row], error: null } });

    await processStuckMusicRecovery();

    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });

  it('marca como failed quando a task Suno falhou definitivamente', async () => {
    const row = baseRow({ mureka_task_id: 'task-1', mureka_status: 'processing' });
    const { update } = buildSupabaseMock({ candidates: { data: [row], error: null } });
    mocks.querySunoTask.mockRejectedValue(new Error('Suno task failed: {"status":"failed"}'));

    await processStuckMusicRecovery();

    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
    const failedUpdate = update.mock.calls.find(c => (c[0] as Record<string, unknown>).mureka_status === 'failed');
    expect(failedUpdate).toBeTruthy();
  });

  it('adia quando a consulta Suno falha de forma transitória', async () => {
    const row = baseRow({ mureka_task_id: 'task-1', mureka_status: 'processing' });
    const { update } = buildSupabaseMock({ candidates: { data: [row], error: null } });
    mocks.querySunoTask.mockRejectedValue(new Error('Suno query failed: 500 - erro de rede'));

    await processStuckMusicRecovery();

    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
    const failedUpdate = update.mock.calls.find(c => (c[0] as Record<string, unknown>).mureka_status === 'failed');
    expect(failedUpdate).toBeUndefined();
  });

  it('não faz nada quando não há músicas presas', async () => {
    buildSupabaseMock({ candidates: { data: [], error: null } });

    await processStuckMusicRecovery();

    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });

  it('não faz nada quando o admin supabase está indisponível', async () => {
    mocks.getAdminSupabase.mockReturnValue(null);

    await processStuckMusicRecovery();

    expect(mocks.runBackgroundSunoWorkflow).not.toHaveBeenCalled();
    expect(mocks.resumeSunoTaskWorkflow).not.toHaveBeenCalled();
  });
});