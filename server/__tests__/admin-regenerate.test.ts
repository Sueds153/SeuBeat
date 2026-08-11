import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import express from 'express';
import type http from 'node:http';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = 'test-secret-1234567890';
process.env.ADMIN_PASSWORD = 'test-admin-password';

vi.mock('../services/supabase', () => ({
  getAdminSupabase: vi.fn(),
  getPublicSupabase: vi.fn(),
}));

vi.mock('../services/ai', () => ({
  generateLyrics: vi.fn(),
}));

import { getAdminSupabase } from '../services/supabase';
import { generateLyrics } from '../services/ai';
import adminRouter from '../routes/admin';

let server: http.Server | null = null;

async function startServer(): Promise<string> {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
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

function authHeader(): string {
  const token = jwt.sign({ role: 'admin', iat: Date.now() }, 'test-secret-1234567890', { expiresIn: '1h' });
  return `Bearer ${token}`;
}

const REQUEST_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function buildRequestRow(status = 'failed') {
  return {
    id: REQUEST_ID,
    status,
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
    songs: [] as Array<Record<string, unknown>>,
    users: { name: 'Ze', email: 'ze@z.pt', phone: '244900000000' },
  };
}

function buildSupabaseMock(opts: { requestRow: unknown; createdSong?: unknown; updatedSong?: unknown }) {
  let songsOp = 'insert';
  const songsChain = {
    insert: vi.fn(() => {
      songsOp = 'insert';
      return songsChain;
    }),
    update: vi.fn(() => {
      songsOp = 'update';
      return songsChain;
    }),
    select: vi.fn(() => songsChain),
    eq: vi.fn(() => songsChain),
    single: vi.fn(async () => ({
      data: songsOp === 'update' ? opts.updatedSong : opts.createdSong,
      error: null,
    })),
  };

  const songRequestsUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: [{ id: REQUEST_ID }], error: null }),
  });
  const from = vi.fn((table: string) => {
    if (table === 'songs') return songsChain;
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: opts.requestRow, error: null }),
      update: songRequestsUpdate,
    };
  });
  (getAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, songRequestsUpdate, songsChain };
}

beforeEach(() => {
  vi.clearAllMocks();
  (generateLyrics as ReturnType<typeof vi.fn>).mockResolvedValue({
    result: { songTitle: 'T', lyrics: ['a', 'b'], lyricsSnippet: 'S', letterText: 'L' },
    provider: 'gemini',
  });
});

describe('POST /api/admin/request/:id/regenerate-lyrics', () => {
  it('recupera pedido falhado sem música: gera letra, cria song e marca lyrics_ready', async () => {
    const base = await startServer();
    const createdSong = { id: 'song-9', title: 'T', lyrics: ['a', 'b'], lyrics_snippet: 'S', letter_text: 'L' };
    const { songRequestsUpdate } = buildSupabaseMock({ requestRow: buildRequestRow('failed'), createdSong });

    const res = await fetch(`${base}/api/admin/request/${REQUEST_ID}/regenerate-lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recovered).toBe(true);
    expect(body.song.id).toBe('song-9');
    expect(generateLyrics).toHaveBeenCalledTimes(1);
    expect(generateLyrics).toHaveBeenCalledWith(
      expect.objectContaining({ recipientName: 'Ana', userNick: 'Ze', musicStyle: 'Semba' }),
      expect.objectContaining({ requestId: REQUEST_ID, email: 'ze@z.pt' })
    );
    expect(songRequestsUpdate).toHaveBeenCalledWith({ status: 'lyrics_ready', error_details: null });
  });

  it('com música existente atualiza a song e não toca no status', async () => {
    const base = await startServer();
    const existingSong = { id: 'song-0', title: 'Old', lyrics: ['x'], letter_text: '' };
    const requestRow = buildRequestRow('lyrics_ready');
    requestRow.songs = [existingSong];
    const updatedSong = { ...existingSong, title: 'T', lyrics: ['a', 'b'], lyrics_snippet: 'S', letter_text: 'L' };
    const { songRequestsUpdate, songsChain } = buildSupabaseMock({ requestRow, updatedSong });

    const res = await fetch(`${base}/api/admin/request/${REQUEST_ID}/regenerate-lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recovered).toBe(false);
    expect(songRequestsUpdate).not.toHaveBeenCalled();
    expect(songsChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'T', lyrics: ['a', 'b'], lyrics_snippet: 'S', letter_text: 'L' })
    );
    expect(songsChain.insert).not.toHaveBeenCalled();
  });

  it('devolve 404 quando o pedido não existe', async () => {
    const base = await startServer();
    buildSupabaseMock({ requestRow: null });

    const res = await fetch(`${base}/api/admin/request/${REQUEST_ID}/regenerate-lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(generateLyrics).not.toHaveBeenCalled();
  });
});
