import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import path from 'path';

export type GeminiLyricsComposition = {
  songTitle: string;
  lyrics: string[];
  lyricsSnippet: string;
  letterText: string;
};

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 45000);
const GEMINI_MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS || 2);

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    songTitle: { type: Type.STRING, description: 'Titulo criativo e emocional da musica, em portugues.' },
    lyrics: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Letra completa da musica em portugues, separada por secoes.'
    },
    lyricsSnippet: { type: Type.STRING, description: 'Trecho curto e forte do refrao, com 2 a 4 linhas.' },
    letterText: { type: Type.STRING, description: 'Carta de dedicatoria personalizada em portugues.' }
  },
  required: ['songTitle', 'lyrics', 'lyricsSnippet', 'letterText']
};

function assertGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY nao configurada.');
  }
  return apiKey;
}

// Lazy-initialize Gemini client.
export const getGeminiClient = () => {
  const apiKey = assertGeminiApiKey();
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'seubeat-server',
      }
    }
  });
};

function repairMojibake(text: string): string {
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

// Helper to read prompts dynamically with safe fallbacks.
export function getPromptFromFile(filename: string, fallback: string): string {
  try {
    const filePath = path.join(process.cwd(), 'prompts', filename);
    if (fs.existsSync(filePath)) {
      return repairMojibake(fs.readFileSync(filePath, 'utf-8').trim());
    }
  } catch (err: any) {
    console.warn(`[Prompt Loader] Falha ao ler ${filename}; usando fallback.`, {
      error: err?.message || String(err)
    });
  }
  return fallback;
}

function clean(value: unknown, fallback = 'Nao informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function buildFormContext(formData: any) {
  return [
    ['Nome do destinatario', clean(formData.recipientName, 'Destinatario especial')],
    ['Apelido do destinatario', clean(formData.recipientNick, 'Nao informado')],
    ['Nome/apelido de quem oferece', clean(formData.userNick, 'Autor da homenagem')],
    ['Relacao', clean(formData.recipientRelation, 'Nao informado')],
    ['Ocasiao', clean(formData.occasion, 'Nao informado')],
    ['Motivo para criar hoje', clean(formData.whyCreatedToday)],
    ['Estilo musical', clean(formData.musicStyle, 'Kizomba')],
    ['Artista de referencia', clean(formData.referenceArtist, 'Nao informado')],
    ['Tipo de voz desejada', clean(formData.voiceType, 'Sem preferencia')],
    ['O que torna a pessoa especial', clean(formData.whatMakesSpecial)],
    ['Detalhe unico que so essa pessoa faz', clean(formData.onlySheDoes)],
    ['Memoria principal', clean(formData.unforgettableMemory)],
    ['Local da memoria', clean(formData.whereItHappened)],
    ['Emocao desejada', clean(formData.desiredEmotion, 'Emocao')],
    ['Mensagem do coracao', clean(formData.messageFromTheHeart)],
    ['Idioma', clean(formData.language, 'Portugues')]
  ]
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n');
}

export function selectPrompt(formData: any) {
  const relacao = clean(formData.recipientRelation, '').toLowerCase();
  const ocasiao = clean(formData.occasion, '').toLowerCase();

  const promptMestre = getPromptFromFile('mestre.txt', `Voce e um compositor profissional especializado em musicas altamente emocionais e personalizadas.
Seu objetivo e criar uma cancao que pareca ter sido escrita exclusivamente para uma unica pessoa.

REGRAS OBRIGATORIAS:
- Escreva em portugues correto, natural e emocional.
- Nunca escreva letras genericas ou frases que serviriam para qualquer pessoa.
- Use os dados do formulario como materia-prima principal da letra.
- Inclua nome, relacao, ocasiao, memoria, local, apelidos, emocao desejada e mensagem do coracao quando existirem.
- Transforme detalhes simples em imagens poeticas concretas.
- Evite cliches vazios, exageros artificiais e linguagem que pareca IA.
- Respeite o estilo musical escolhido e a referencia artistica sem copiar letras, melodias ou marcas registradas.
- A letra deve soar cantavel, memoravel e pessoal.

ESTRUTURA OBRIGATORIA DA LETRA:
[Verso 1]
[Pre-Refrao]
[Refrao]
[Verso 2]
[Ponte Emocional]
[Refrao Final]

O refrao deve conter a mensagem principal que a pessoa nunca deve esquecer.`);

  const romancePrompt = getPromptFromFile('romance.txt', `Crie uma cancao romantica sincera, focada na historia do casal, nas memorias reais, nos pequenos gestos e no futuro desejado. O refrao deve fazer a pessoa sentir-se amada e unica.`);
  const maePrompt = getPromptFromFile('mae.txt', `Crie uma homenagem para mae com gratidao, cuidado, sacrificio, protecao e amor incondicional. O tom deve ser profundo sem ser melodramatico.`);
  const paiPrompt = getPromptFromFile('pai.txt', `Crie uma homenagem para pai com respeito, orgulho, ensinamentos, trabalho, exemplo de vida e gratidao.`);
  const filhoPrompt = getPromptFromFile('filho.txt', `Crie uma musica para filho ou filha com amor, protecao, orgulho, crescimento, sonhos e esperanca.`);
  const familiaPrompt = getPromptFromFile('familia.txt', `Crie uma musica familiar calorosa sobre infancia, cumplicidade, apoio mutuo, brincadeiras e memorias partilhadas.`);
  const amizadePrompt = getPromptFromFile('amizade.txt', `Crie uma musica de amizade verdadeira sobre lealdade, apoio, historias vividas, alegria e presenca nos momentos importantes.`);
  const avoPrompt = getPromptFromFile('avo.txt', `Crie uma homenagem para avos com carinho, sabedoria, memorias de infancia, cuidado e amor que atravessa geracoes.`);
  const professorPrompt = getPromptFromFile('professor.txt', `Crie uma homenagem para professor ou professora destacando inspiracao, conhecimento, apoio, impacto positivo e gratidao.`);
  const pastorPrompt = getPromptFromFile('pastor.txt', `Crie uma musica de gratidao e fe para lider espiritual, com respeito, orientacao, apoio e bencao.`);
  const colegaPrompt = getPromptFromFile('colega.txt', `Crie uma homenagem profissional com trabalho em equipa, superacao, conquistas, companheirismo e reconhecimento.`);
  const saudadePrompt = getPromptFromFile('saudade.txt', `Crie uma cancao de saudade madura, com memorias bonitas, gratidao pelo passado e crescimento, sem acusacoes.`);
  const paramimPrompt = getPromptFromFile('paramim.txt', `Crie uma musica de autoestima e superacao para a propria pessoa, com conquistas, sonhos, resiliencia e autoamor.`);
  const outroPrompt = getPromptFromFile('outro.txt', `Analise cuidadosamente a relacao e a ocasiao descritas. Adapte completamente a letra ao contexto, sem usar um molde generico.`);
  const casamentoPrompt = getPromptFromFile('casamento.txt', 'Crie uma cancao de casamento sobre uniao, promessa, altar, aliancas, familia e inicio de uma vida a dois.');
  const pedidoDesculpasPrompt = getPromptFromFile('pedido_desculpas.txt', 'Crie uma cancao de pedido de desculpas com vulnerabilidade, arrependimento humilde, responsabilidade e desejo sincero de reconstruir.');
  const memorialPrompt = getPromptFromFile('memorial.txt', 'Crie uma cancao in memoriam com tom suave, respeitoso, saudade, amor que permanece e memorias vivas.');
  const homenagemPrompt = getPromptFromFile('homenagem.txt', 'Crie uma cancao de reconhecimento com admiracao, trajetoria, aplauso, impacto e grandeza humana.');

  let basePrompt = outroPrompt;

  if (ocasiao.includes('casamento')) {
    basePrompt = casamentoPrompt;
  } else if (ocasiao.includes('desculpa')) {
    basePrompt = pedidoDesculpasPrompt;
  } else if (ocasiao.includes('memorial') || ocasiao.includes('saudade')) {
    basePrompt = memorialPrompt;
  } else if (ocasiao.includes('homenagem')) {
    basePrompt = homenagemPrompt;
  } else if (relacao.includes('mae') || relacao.includes('mãe')) {
    basePrompt = maePrompt;
  } else if (relacao.includes('pai')) {
    basePrompt = paiPrompt;
  } else if (relacao.includes('avo') || relacao.includes('avó') || relacao.includes('avô')) {
    basePrompt = avoPrompt;
  } else if (relacao.includes('filh')) {
    basePrompt = filhoPrompt;
  } else if (relacao.includes('irma') || relacao.includes('irmã') || relacao.includes('irmão')) {
    basePrompt = familiaPrompt;
  } else if (relacao.includes('amig')) {
    basePrompt = amizadePrompt;
  } else if (relacao.includes('professor')) {
    basePrompt = professorPrompt;
  } else if (relacao.includes('pastor')) {
    basePrompt = pastorPrompt;
  } else if (relacao.includes('colega')) {
    basePrompt = colegaPrompt;
  } else if (relacao.includes('ex-')) {
    basePrompt = saudadePrompt;
  } else if (relacao.includes('mim')) {
    basePrompt = paramimPrompt;
  } else if (relacao.includes('namorad') || relacao.includes('espos') || relacao.includes('marido') || relacao.includes('parceir')) {
    basePrompt = romancePrompt;
  }

  return `${promptMestre}

---

ORIENTACAO ESPECIFICA PARA ESTA RELACAO/OCASIAO:
${basePrompt}

---

DADOS OBRIGATORIOS DO FORMULARIO:
${buildFormContext(formData)}

---

SAIDA OBRIGATORIA:
Responda apenas com JSON valido, sem markdown, sem comentarios e sem texto fora do JSON.
O JSON deve conter exatamente estes campos:
{
  "songTitle": "string",
  "lyrics": ["string", "string", "..."],
  "lyricsSnippet": "string",
  "letterText": "string"
}

Requisitos de qualidade:
- A letra deve ter pelo menos 18 linhas no total.
- Use detalhes especificos do formulario em mais de uma secao da musica.
- O lyricsSnippet deve ser retirado do melhor momento do refrao.
- A letterText deve ser uma dedicatória em prosa, intima, clara e personalizada, sem repetir a letra inteira.`;
}

function parseJsonOutput(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Gemini retornou texto sem JSON valido.');
    return JSON.parse(match[0]);
  }
}

export function validateGeminiComposition(value: unknown): GeminiLyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta Gemini malformada: objeto JSON em falta.');
  }

  const data = value as Record<string, unknown>;
  const songTitle = clean(data.songTitle, '');
  const lyricsSnippet = clean(data.lyricsSnippet, '');
  const letterText = clean(data.letterText, '');
  const lyrics = Array.isArray(data.lyrics)
    ? data.lyrics.map(line => clean(line, '')).filter(Boolean)
    : [];

  const missing = [
    songTitle ? null : 'songTitle',
    lyrics.length ? null : 'lyrics',
    lyricsSnippet ? null : 'lyricsSnippet',
    letterText ? null : 'letterText'
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Resposta Gemini malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.join('\n').length < 400 || lyrics.length < 6) {
    throw new Error('Resposta Gemini malformada: lyrics demasiado curtas.');
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} excedeu ${timeoutMs}ms.`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateLyricsWithGemini(formData: any): Promise<GeminiLyricsComposition> {
  const ai = getGeminiClient();
  const prompt = selectPrompt(formData);
  const recipient = clean(formData.recipientName, 'destinatario');
  const style = clean(formData.musicStyle, 'nao informado');
  let lastError: unknown;

  for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt++) {
    try {
      console.log('[Gemini] A gerar letra personalizada.', {
        attempt,
        model: GEMINI_MODEL,
        recipientLength: recipient.length,
        style
      });

      if (process.env.GEMINI_FORCE_INVALID_RESPONSE === 'true') {
        return validateGeminiComposition({ songTitle: 'Teste invalido' });
      }

      const resultResponse = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: attempt === 1 ? 0.85 : 0.65,
          }
        }),
        GEMINI_TIMEOUT_MS,
        'Chamada Gemini'
      );

      const textOutput = resultResponse.text || '';
      const parsed = parseJsonOutput(textOutput);
      return validateGeminiComposition(parsed);
    } catch (err: any) {
      lastError = err;
      console.warn('[Gemini] Tentativa falhou.', {
        attempt,
        error: err?.message || String(err)
      });
      if (attempt < GEMINI_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 750 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida ao gerar letra com Gemini.');
}
