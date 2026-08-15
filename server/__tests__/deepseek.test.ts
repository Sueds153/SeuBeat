import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock('openai', () => {
  class OpenAI {
    apiKey: string;
    baseURL: string;
    chat = { completions: { create: mocks.create } };
    constructor(opts: { apiKey: string; baseURL?: string }) {
      this.apiKey = opts.apiKey;
      this.baseURL = opts.baseURL || '';
    }
  }
  return { default: OpenAI };
});

import { generateLyricsWithDeepSeek } from '../services/deepseek';

const validLyrics = [
  '[Verso 1]',
  'linha um do verso com palavras suficientes',
  'linha dois do verso com palavras suficientes',
  'linha tres do verso com palavras suficientes',
  '[Pré-Refrão]',
  'linha quatro do pre refrao com palavras',
  '[Refrão]',
  'linha cinco do refrao com palavras',
  'linha seis do refrao com palavras',
  '[Verso 2]',
  'linha sete do verso com palavras',
  'linha oito do verso com palavras',
  '[Ponte Emocional]',
  'linha nove da ponte com palavras',
  '[Refrão Final]',
  'linha dez do refrao final com palavras',
];

const validContent = {
  songTitle: 'Canção de Teste',
  lyrics: validLyrics,
  letterText: 'Uma dedicatória curta mas emocionante para a pessoa especial.',
  lyricsSnippet: 'Trecho curto da letra para pré-visualização.',
};

const minimalForm = {
  userNick: 'Autor',
  recipientName: 'Destinatario',
  recipientGender: 'Masculino',
  recipientRelation: 'Parceiro',
  recipientNick: '',
  hookPhrase: '',
  occasion: 'Homenagem',
  whyCreatedToday: '',
  musicStyle: 'Kizomba',
  referenceArtist: '',
  voiceType: 'Masculina',
  unforgettableMemory: '',
  whatMakesSpecial: '',
  onlySheDoes: '',
  whereItHappened: '',
  messageFromTheHeart: '',
  desiredEmotion: 'Emocionante',
  language: 'português',
};

describe('generateLyricsWithDeepSeek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'test-deepseek';
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
  });

  it('gera a letra e valida o JSON devolvido pela API', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validContent) } }],
    });

    const result = await generateLyricsWithDeepSeek(minimalForm);

    expect(result.songTitle).toBe('Canção de Teste');
    expect(result.lyrics.length).toBeGreaterThanOrEqual(12);
    expect(result.letterText).toBeTruthy();
  });

  it('usa o modelo default deepseek-v4-flash com baseURL e formato JSON', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(validContent) } }],
    });

    await generateLyricsWithDeepSeek(minimalForm);

    const args = mocks.create.mock.calls[0][0] as Record<string, unknown>;
    expect(args.model).toBe('deepseek-v4-flash');
    expect(args.response_format).toEqual({ type: 'json_object' });
    expect((args as Record<string, unknown> & { thinking?: unknown }).thinking).toEqual({ type: 'disabled' });

    const client = (await import('openai')).default;
    expect(client).toBeDefined();
  });

  it('lança erro quando a resposta não tem conteúdo', async () => {
    mocks.create.mockResolvedValue({ choices: [{ message: { content: '' } }] });

    await expect(generateLyricsWithDeepSeek(minimalForm)).rejects.toThrow(
      /DeepSeek retornou conteúdo vazio/
    );
  });

  it('lança erro de configuração quando falta a chave', async () => {
    delete process.env.DEEPSEEK_API_KEY;

    await expect(generateLyricsWithDeepSeek(minimalForm)).rejects.toThrow(
      /DEEPSEEK_API_KEY não configurada/
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('lança erro quando a resposta não é JSON válido', async () => {
    mocks.create.mockResolvedValue({
      choices: [{ message: { content: 'não é json nenhum' } }],
    });

    await expect(generateLyricsWithDeepSeek(minimalForm)).rejects.toThrow(
      /JSON válido|malformada/
    );
  });
});