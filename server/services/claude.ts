import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { ClaudeLyricsComposition } from './types';
import { logWarn, logInfo, logError } from '../utils/logger';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || 60000);
const CLAUDE_MAX_ATTEMPTS = Number(process.env.CLAUDE_MAX_ATTEMPTS || 2);

function repairMojibake(text: string): string {
  if (!/[ÃÂâ]/.test(text)) return text;
  try {
    return Buffer.from(text, 'latin1').toString('utf8');
  } catch {
    return text;
  }
}

function getPromptFromFile(filename: string, fallback: string): string {
  try {
    const filePath = path.join(process.cwd(), 'prompts', filename);
    if (fs.existsSync(filePath)) {
      return repairMojibake(fs.readFileSync(filePath, 'utf-8').trim());
    }
  } catch (err: any) {
    logWarn('[Prompt Loader] Falha ao ler prompt; usando fallback.', {
      filename,
      error: err?.message || String(err)
    });
  }
  return fallback;
}

function clean(value: unknown, fallback = 'Não informado'): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeLower(value: unknown): string {
  return clean(value, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function languageDisplayName(lang: string): string {
  const names: Record<string, string> = {
    'português': 'Português de Angola',
    'kimbundu': 'Português mesclado com Kimbundu (língua nacional angolana)',
    'umbundu': 'Português mesclado com UmBundu (língua nacional angolana)',
    'kikongo': 'Português mesclado com Kikongo (língua nacional angolana)',
    'lingala': 'Português mesclado com Lingala',
    'inglês': 'Inglês',
  };
  return names[lang] || 'Português de Angola';
}

function languageInstruction(lang: string): string {
  const instructions: Record<string, string> = {
    'português': 'Escreva a letra COMPLETAMENTE em português de Angola, com expressões naturais e autênticas.',
    'kimbundu': 'Escreva a letra MESCLANDO português com palavras e expressões em Kimbundu (língua nacional angolana). Incorpore termos como "muene", "kota", "kibai", "ngana", "kizua" naturalmente na letra.',
    'umbundu': 'Escreva a letra MESCLANDO português com palavras e expressões em UmBundu (língua nacional angolana). Incorpore termos como "ochi", "suku", "etu", "ociwa" naturalmente na letra.',
    'kikongo': 'Escreva a letra MESCLANDO português com palavras e expressões em Kikongo (língua nacional angolana). Incorpore termos como "ngolo", "kiese", "zola", "kamba" naturalmente na letra.',
    'lingala': 'Escreva a letra MESCLANDO português com palavras e expressões em Lingala. Incorpore termos como "bolingo", "moto", "kolela", "zala" naturalmente na letra.',
    'inglês': 'Escreva a letra COMPLETAMENTE em INGLÊS. Use inglês natural, poético e autêntico.',
  };
  return instructions[lang] || 'Escreva a letra em português de Angola.';
}

function buildFormContext(formData: any) {
  const c = (val: any) => clean(val, 'Não informado');
  return [
    ['Destinatário (Nome)', c(formData.recipientName)],
    ['Relação', c(formData.recipientRelation)],
    ['Apelido Carinhoso do Destinatário', c(formData.recipientNick)],
    ['Como quem oferece gosta de ser chamado (Apelido)', c(formData.userNick)],
    ['Ocasião Especial', c(formData.occasion)],
    ['Motivo da criação hoje', c(formData.whyCreatedToday)],
    ['Estilo Musical', c(formData.musicStyle)],
    ['Artista de Referência', c(formData.referenceArtist)],
    ['Tipo de Voz', c(formData.voiceType)],
    ['O que torna a pessoa especial', c(formData.whatMakesSpecial)],
    ['Algo que só ela faz', c(formData.onlySheDoes)],
    ['Memória inesquecível', c(formData.unforgettableMemory)],
    ['Local da memória', c(formData.whereItHappened)],
    ['O que nunca deve esquecer (Mensagem do Coração)', c(formData.messageFromTheHeart)],
    ['Variante do Idioma', languageDisplayName(c(formData.language))]
  ]
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n');
}

export function selectPrompt(formData: any) {
  const relacao = normalizeLower(formData.recipientRelation);
  const ocasiao = normalizeLower(formData.occasion);

  const promptMestre = getPromptFromFile('mestre.txt', `Você é um Compositor e Poeta nível Sênior, especializado em "Storytelling Musical" e letras altamente personalizadas em Português de Portugal e Brasil.
Seu objetivo é criar uma canção que soe como um presente único, capturando a essência da relação e memórias compartilhadas.

REGRAS DE OURO PARA COMPOSIÇÃO:
1. PERSONALIZAÇÃO RADICAL: Use cada detalhe fornecido (nomes, apelidos, memórias, locais, trejeitos únicos). Se o formulário diz que a pessoa "faz um café incrível às 7h", isso deve estar na letra.
2. EMOÇÃO AUTÊNTICA: Evite clichês como "amor eterno" ou "te amo demais" sem contexto. Prefira "a forma como sorris quando o comboio chega" ou "aquele abraço no Largo do Chiado".
3. ESTRUTURA PROFISSIONAL:
   - Verso 1: Estabelece o cenário, o local ou uma memória inicial.
   - Pré-Refrão: Cria tensão emocional, prepara para a mensagem principal.
   - Refrão: A alma da música. Deve ser memorável, rítmico e conter o nome da pessoa ou o motivo central.
   - Verso 2: Aprofunda a história, traz detalhes novos ou o "detalhe único" que só ela faz.
   - Ponte: Momento de reflexão, mudança de tom ou uma promessa para o futuro.
   - Refrão Final: Explosão emocional, encerramento marcante.
4. LINGUAGEM: Português natural, fluído e rítmico. Nada de "IA-speak" ou frases genéricas.
5. ESTILO: Adapte o vocabulário ao estilo musical escolhido (ex: mais urbano para Rap, mais doce para MPB/Bossa, rítmico para Kizomba).

DEDICATÓRIA (letterText): Escreva uma carta íntima, curta e poderosa em prosa, que resume o sentimento da música. Não repita a letra aqui.`);

  const prompts = {
    romance: getPromptFromFile('romance.txt', 'Crie uma canção romântica sincera, focada na história do casal, memórias reais, pequenos gestos e futuro desejado.'),
    mae: getPromptFromFile('mae.txt', 'Crie uma homenagem para mãe com gratidão, cuidado, sacrifício, proteção e amor incondicional. Sem melodrama exagerado.'),
    pai: getPromptFromFile('pai.txt', 'Crie uma homenagem para pai com respeito, orgulho, ensinamentos, exemplo de vida e gratidão.'),
    filho: getPromptFromFile('filho.txt', 'Crie uma música para filho ou filha com amor, proteção, orgulho, crescimento e esperança.'),
    familia: getPromptFromFile('familia.txt', 'Crie uma música familiar calorosa sobre infância, cumplicidade, apoio mútuo e memórias partilhadas.'),
    amizade: getPromptFromFile('amizade.txt', 'Crie uma música de amizade verdadeira sobre lealdade, apoio, histórias vividas e presença.'),
    avo: getPromptFromFile('avo.txt', 'Crie uma homenagem para avós com carinho, sabedoria, memórias de infância e amor geracional.'),
    professor: getPromptFromFile('professor.txt', 'Crie uma homenagem para professor(a) destacando inspiração, conhecimento, impacto positivo e gratidão.'),
    pastor: getPromptFromFile('pastor.txt', 'Crie uma música de gratidão e fé para líder espiritual, com respeito e orientação.'),
    colega: getPromptFromFile('colega.txt', 'Crie uma homenagem profissional com trabalho em equipa, superação e reconhecimento.'),
    saudade: getPromptFromFile('saudade.txt', 'Crie uma canção de saudade madura, com memórias bonitas e gratidão pelo passado.'),
    paramim: getPromptFromFile('paramim.txt', 'Crie uma música de autoestima e superação pessoal, com conquistas e resiliência.'),
    casamento: getPromptFromFile('casamento.txt', 'Crie uma canção de casamento sobre união, promessa, altar e o início da vida a dois.'),
    desculpas: getPromptFromFile('pedido_desculpas.txt', 'Crie uma canção de pedido de desculpas com vulnerabilidade, arrependimento humilde e desejo de reconstruir.'),
    memorial: getPromptFromFile('memorial.txt', 'Crie uma canção in memoriam com tom suave, respeitoso, saudade e amor que permanece.'),
    homenagem: getPromptFromFile('homenagem.txt', 'Crie uma canção de reconhecimento com admiração, trajetória e impacto humano.'),
    outro: getPromptFromFile('outro.txt', 'Analise a relação e ocasião e adapte completamente o tom ao contexto descrito.')
  };

  let basePrompt = prompts.outro;
  if (ocasiao.includes('casamento')) basePrompt = prompts.casamento;
  else if (ocasiao.includes('desculpa')) basePrompt = prompts.desculpas;
  else if (ocasiao.includes('memorial') || ocasiao.includes('saudade')) basePrompt = prompts.memorial;
  else if (ocasiao.includes('homenagem')) basePrompt = prompts.homenagem;
  else if (relacao.includes('mae')) basePrompt = prompts.mae;
  else if (relacao.includes('pai')) basePrompt = prompts.pai;
  else if (relacao.includes('avo')) basePrompt = prompts.avo;
  else if (relacao.includes('filh')) basePrompt = prompts.filho;
  else if (relacao.includes('irma')) basePrompt = prompts.familia;
  else if (relacao.includes('amig')) basePrompt = prompts.amizade;
  else if (relacao.includes('professor')) basePrompt = prompts.professor;
  else if (relacao.includes('pastor')) basePrompt = prompts.pastor;
  else if (relacao.includes('colega')) basePrompt = prompts.colega;
  else if (relacao.includes('ex-')) basePrompt = prompts.saudade;
  else if (relacao.includes('mim')) basePrompt = prompts.paramim;
  else if (relacao.includes('namorad') || relacao.includes('espos') || relacao.includes('marido') || relacao.includes('parceir')) basePrompt = prompts.romance;

  return `${promptMestre}

ORIENTAÇÃO ESPECÍFICA PARA ESTA RELAÇÃO/OCASIÃO:
${basePrompt}

DADOS DETALHADOS DO FORMULÁRIO A SEREM INTEGRADOS OBRIGATORIAMENTE (USE ESSAS INFORMAÇÕES REAIS PARA ESCREVER A LETRA):
${buildFormContext(formData)}

INSTRUÇÕES ADICIONAIS DE PERSONALIZAÇÃO E QUALIDADE:
- A letra DEVE usar o nome do destinatário ("${formData.recipientName || 'Destinatário'}"), apelidos carinhosos ("${formData.recipientNick || ''}"), local ("${formData.whereItHappened || ''}") e memórias detalhadas ("${formData.unforgettableMemory || ''}") de forma natural e emocionante.
- Evite letras genéricas. O tom e vocabulário devem refletir a emoção desejada ("${formData.desiredEmotion || 'Emocionante'}"), o estilo musical ("${formData.musicStyle || 'Kizomba'}"), e respeitar as características líricas do artista de referência ("${formData.referenceArtist || 'Artista'}").
- O campo "letterText" é uma dedicatória CURTA (2-3 frases) em prosa emocionante, sem repetir a letra.

INSTRUÇÃO DE IDIOMA (CUMPRA OBRIGATORIAMENTE):
${languageInstruction(formData.language || 'português')}`;
}

export function validateClaudeComposition(value: unknown): ClaudeLyricsComposition {
  if (!value || typeof value !== 'object') {
    throw new Error('Resposta Claude malformada: objeto JSON em falta.');
  }

  const data = value as Record<string, unknown>;
  const songTitle = clean(data.songTitle, '');
  const lyricsSnippet = clean(data.lyricsSnippet, '');
  const letterText = clean(data.letterText, '');
  
  let lyrics: string[] = [];
  if (Array.isArray(data.lyrics)) {
    lyrics = data.lyrics.map(line => clean(line, '')).filter(Boolean);
  } else if (typeof data.lyrics === 'string') {
    lyrics = data.lyrics.split('\n').map(line => clean(line, '')).filter(Boolean);
  }

  const missing = [
    songTitle ? null : 'songTitle',
    lyrics.length ? null : 'lyrics',
    letterText ? null : 'letterText'
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(`Resposta Claude malformada: campos em falta (${missing.join(', ')}).`);
  }

  if (lyrics.length < 12 || lyrics.join('\n').length < 100) {
    throw new Error('Resposta Claude malformada: letra demasiado curta.');
  }

  return { songTitle, lyrics, lyricsSnippet, letterText };
}

function extractJSON(text: string): any {
  const cleanText = text.trim();
  try {
    return JSON.parse(cleanText);
  } catch {}

  const jsonMatch = cleanText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(cleanText.slice(firstBrace, lastBrace + 1));
    } catch {}
  }

  throw new Error('Não foi possível extrair um objeto JSON válido da resposta do Claude.');
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      if (controller) controller.abort();
      reject(new Error(`${label} excedeu o limite de ${timeoutMs}ms.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function shouldRetryClaude(err: any) {
  const message = err?.message || String(err || '');
  return /timeout|excedeu|JSON|malformada|429|500|502|503|504/i.test(message);
}

export async function generateLyricsWithClaude(formData: any): Promise<ClaudeLyricsComposition> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY não configurada no servidor.');
  }

  const prompt = selectPrompt(formData);
  const anthropic = new Anthropic({ apiKey });

  let lastError: any;

  for (let attempt = 1; attempt <= CLAUDE_MAX_ATTEMPTS; attempt++) {
    try {
      logInfo(`[Claude] Tentativa ${attempt} de geração de letra...`);
      
      const abortController = new AbortController();
      
      const responsePromise = anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        system: `Você é um compositor de estúdio profissional.
Você deve produzir a letra da música e a dedicatória exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, preâmbulo ou conclusão fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "Título Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "linha 2 do verso...",
    "[Pré-Refrão]",
    "linha 1 do pré-refrão...",
    "[Refrão]",
    "linha 1 do refrão...",
    "linha 2 do refrão..."
  ],
  "letterText": "Dedicatória curta (2-3 frases) em prosa, sem repetir a letra."
}`,
        messages: [
          {
            role: 'user',
            content: `Gere a musica baseada nestes dados. Retorne apenas o JSON:\n\n${prompt}`
          }
        ]
      });

      const response = await withTimeout(
        responsePromise,
        CLAUDE_TIMEOUT_MS,
        'Geração Claude',
        abortController
      );

      const block = response.content[0];
      if (!block || block.type !== 'text') {
        throw new Error('Claude retornou conteúdo sem texto ou formato inesperado.');
      }

      const json = extractJSON(block.text);
      return validateClaudeComposition(json);
    } catch (err: any) {
      lastError = err;
      logError(`[Claude] Erro na tentativa ${attempt}`, err);
      
      if (!shouldRetryClaude(err)) break;
      if (attempt < CLAUDE_MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Falha desconhecida ao gerar letra com Claude.');
}
