import fs from 'fs';
import path from 'path';
import { logWarn } from '../utils/logger';

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

const ARTIST_LYRICAL_STYLES: Record<string, string> = {
  'Anselmo Ralph': 'Use vocabulário romântico urbano, refrões fortes e repetitivos, linguagem direta ao coração. As letras devem soar como uma canção do Anselmo Ralph.',
  'Matias Damásio': 'Use tom poético e nostálgico, metáforas sobre amor, perda e reencontro. Refrões emocionais. As letras devem soar como uma canção do Matias Damásio.',
  'Gerilson Insrael': 'Use flow afro-pop, refrões contagiantes, linguagem jovem e atual com vibe dançante mas conteúdo romântico. As letras devem soar como uma canção do Gerilson Insrael.',
  'Chelsea Dinorath': 'Use tom neo-kizomba moderno com influência R&B, voz suave e refrões melódicos envolventes. As letras devem soar como uma canção da Chelsea Dinorath.',
  'Ary': 'Use batida rítmica de semba com alma, letra dançante mas com conteúdo emocional profundo e autêntico. As letras devem soar como uma canção do Ary.',
  'Cef': 'Use flow ghetto zouk, refrões pegajosos e repetitivos, vibe romântica com batida dançante e linguagem acessível. As letras devem soar como uma canção do Cef.',
  'Nelson Freitas': 'Use estilo zouk internacional com R&B, refrões que alternam português e inglês, produção lírica polida e romântica. As letras devem soar como uma canção do Nelson Freitas.',
  'Outro': 'Crie uma letra original com identidade própria, adaptando o tom e vocabulário ao estilo musical escolhido sem se prender a um artista específico.',
};

const STYLE_LYRICAL_INSTRUCTIONS: Record<string, string> = {
  kizomba: 'Use linguagem romântica e envolvente, ritmo lento e sensual, refrão repetitivo e cativante próprio da tarraxinha angolana.',
  semba: 'Use ritmo acelerado e alegre, linguagem dançante e tradicional angolana, refrão contagiante com guitarra viva.',
  afrobeat: 'Use energia vibrante, percussão marcante, refrão poderoso e dançante, flow moderno afro-pop.',
  gospel: 'Use tom de fé e gratidão, linguagem inspiradora e edificante, coro emocionante com referências espirituais.',
  acoustic: 'Use tom intimista e poético, letra simples mas profunda, voz suave e melodia minimalista.',
  'romantic pop': 'Use romantismo radiofónico, refrão forte e memorável, linguagem universal e emocional com produção polida.',
  zouk: 'Use romantismo caribenho, sintetizadores suaves, refrão melódico e envolvente com vibe tropical.',
  balada: 'Use tom emocional e orquestrado, piano e cordas, construção dramática com refrão explosivo.',
  pop: 'Use melodia cativante, refrão pegajoso, linguagem acessível e produção moderna e radiofónica.',
  'r&b': 'Use flow suave e sensual, groove envolvente, letra emocional com alma e sentimento à moda R&B.',
  rap: 'Use flow ritmado, palavra poderosa, batida urbana, lírica afiada com consciência e autenticidade.',
  funk: 'Use groove contagiante, batida dançante, percussão marcada, letra vibrante com swing e atitude.',
  trap: 'Use flow moderno e atitude urbana, 808 pesado, refrão curto e impactante, linguagem jovem e autêntica.',
  reggae: 'Use vibração positiva e descontraída, ritmo offbeat, bass profundo, linguagem relaxada com consciência.',
  samba: 'Use gingado brasileiro, percussão festiva, alegria contagiante, letra que celebra a vida com energia carnavalesca.',
  hino: 'Use tom épico e solene, linguagem corporativa e inspiradora, coro majestoso com estrutura de hino institucional.',
};

function styleLyricalInstruction(musicStyle: string): string {
  if (!musicStyle) return '';
  const key = musicStyle.trim().toLowerCase();
  const instruction = STYLE_LYRICAL_INSTRUCTIONS[key];
  if (instruction) return `- INSTRUÇÃO ESPECÍFICA PARA "${musicStyle}": ${instruction}`;
  return '';
}

function referenceArtistInstruction(artistName: string): string {
  if (!artistName || artistName === 'Outro') return '';
  const instruction = ARTIST_LYRICAL_STYLES[artistName];
  if (instruction) return `- ${instruction}.`;
  return '';
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
    ['Género do Destinatário', c(formData.recipientGender)],
    ['Relação', c(formData.recipientRelation)],
    ['Apelido Carinhoso do Destinatário', c(formData.recipientNick)],
    ['Como quem oferece gosta de ser chamado (Apelido)', c(formData.userNick)],
    ['Ocasião Especial', c(formData.occasion)],
    ['Motivo da criação hoje', c(formData.whyCreatedToday)],
    ['Estilo Musical', c(formData.musicStyle)],
    ['Artista de Referência', c(formData.referenceArtist)],
    ['Tipo de Voz', c(formData.voiceType)],
    ['O que torna a pessoa especial', c(formData.whatMakesSpecial)],
    ['Algo que só essa pessoa faz', c(formData.onlySheDoes)],
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
   - Verso 2: Aprofunda a história, traz detalhes novos ou o "detalhe único" que só essa pessoa faz.
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
    aniversario: getPromptFromFile('aniversario.txt', 'Crie uma canção de aniversário celebrando a vida, alegria e gratidão. O Refrão Final deve incluir "Feliz Aniversário [Destinatário]" como mensagem de encerramento.'),
    aniversarioNamoro: getPromptFromFile('aniversario_namoro.txt', 'Crie uma canção de aniversário de namoro celebrando o tempo juntos e o amor que dura. O Refrão Final deve incluir "Feliz Aniversário de namoro" como mensagem de encerramento.'),
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
  if (ocasiao.includes('aniversario')) {
    basePrompt = ocasiao.includes('namoro') ? prompts.aniversarioNamoro : prompts.aniversario;
  } else if (ocasiao.includes('casamento')) basePrompt = prompts.casamento;
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
- Evite letras genéricas. O tom e vocabulário devem refletir a emoção desejada ("${formData.desiredEmotion || 'Emocionante'}") e o estilo musical ("${formData.musicStyle || 'Kizomba'}").${referenceArtistInstruction(formData.referenceArtist) ? '\n' + referenceArtistInstruction(formData.referenceArtist) : ''}${styleLyricalInstruction(formData.musicStyle) ? '\n' + styleLyricalInstruction(formData.musicStyle) : ''}
- O campo "letterText" é uma dedicatória CURTA (2-3 frases) em prosa emocionante, sem repetir a letra.

INSTRUÇÃO DE IDIOMA (CUMPRA OBRIGATORIAMENTE):
${languageInstruction(formData.language || 'português')}`;
}
