import fs from 'fs';
import path from 'path';
import { logWarn } from '../utils/logger';
import { WizardFormData } from './types';

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
  } catch (err: unknown) {
    logWarn('[Prompt Loader] Falha ao ler prompt; usando fallback.', {
      filename,
      error: err instanceof Error ? err.message : String(err)
    });
  }
  return fallback;
}

function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLower(value: unknown): string {
  return clean(value)
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

function languageInstruction(lang?: string): string {
  const instructions: Record<string, string> = {
    'português': 'Escreva em português de Angola natural. Use "tu" e "nós". Evite expressões do Brasil ("a gente", "pô", "você") e de Portugal ("giro", "bica"). Não force gírias ou termos locais — só usa se vierem dos dados do utilizador.',
    'kimbundu': 'Pode mesclear português com Kimbundu quando a história pedir (ex.: termos como "muene", "kota", "kibai"). Não forces a lista — usa só o que encaixar naturalmente.',
    'umbundu': 'Pode mesclear português com UmBundu quando a história pedir (ex.: termos como "ochi", "suku", "etu"). Não forces a lista — usa só o que encaixar naturalmente.',
    'kikongo': 'Pode mesclear português com Kikongo quando a história pedir (ex.: termos como "ngolo", "kiese", "zola"). Não forces a lista — usa só o que encaixar naturalmente.',
    'lingala': 'Pode mesclear português com Lingala quando a história pedir (ex.: termos como "bolingo", "moto", "kolela"). Não forces a lista — usa só o que encaixar naturalmente.',
    'inglês': 'Escreva completamente em inglês. Natural, poético e autêntico.',
  };
  return instructions[lang ?? 'português'] || instructions['português'];
}

function buildFormContext(formData: WizardFormData) {
  const sections = [
    { title: 'DADOS BIOGRÁFICOS', items: [
      ['Nome do Destinatário', clean(formData.recipientName)],
      ['Género do Destinatário', clean(formData.recipientGender)],
      ['Relação com quem oferece', clean(formData.recipientRelation)],
    ]},
    { title: 'CONTEXTO DA MÚSICA', items: [
      ['Ocasião Especial', clean(formData.occasion)],
      ['Estilo Musical', clean(formData.musicStyle)],
      ['Tipo de Voz', clean(formData.voiceType)],
    ]},
    { title: 'HISTÓRIA DA RELAÇÃO', items: [
      ['O que torna a pessoa especial', clean(formData.whatMakesSpecial)],
      ['Local da memória', clean(formData.whereItHappened)],
    ]},
    { title: 'MENSAGEM CENTRAL', items: [
      ['O que nunca deve esquecer', clean(formData.messageFromTheHeart)],
      ['Idioma', languageDisplayName(clean(formData.language))],
    ]},
  ];

  return sections
    .map(s => {
      const validItems = s.items.filter(([, value]) => value.length > 0);
      if (validItems.length === 0) return '';
      return `-- ${s.title} --\n${validItems.map(([label, value]) => `- ${label}: ${value}`).join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function selectPrompt(formData: WizardFormData) {
  const relacao = normalizeLower(formData.recipientRelation);
  const ocasiao = normalizeLower(formData.occasion);

  const promptMestre = getPromptFromFile('mestre.txt', `Voce e um compositor profissional especializado em musicas emocionais e personalizadas, em Portugues de Angola.
Seu objetivo e criar uma musica que pareça ter sido escrita exclusivamente para uma unica pessoa.

REGRAS:
1. Nunca escreva letras genericas — use os detalhes fornecidos pelo utilizador.
2. Cada verso deve conter uma imagem sensorial (visao, som, cheiro, tato, paladar) tirada dos dados fornecidos. Nao inventes imagens prontas nem repitas formulas.
3. Escreva como um compositor humano experiente, nao como uma IA.
4. Portugues de Angola natural e fluido — sem forcar girias ou expressoes locais (ex.: candongueiro, bue, xe). So usa termos locais se vierem dos dados do utilizador.
5. Nenhuma linha repetida mais de 3 vezes.
6. Concordancia de genero: se feminino use "obrigada", "querida", "és a mais linda"; se masculino use "obrigado", "querido", "és o mais lindo".

ESTRUTURA (nesta ordem):
[Verso 1] — Estabelece o cenario e a memoria inicial.
[Pre-Refrão] — Tensao emocional crescente.
[Refrão] — A alma da mensagem. Memoravel e ritmico.
[Verso 2] — Aprofunda a historia com detalhes intimos.
[Ponte Emocional] — Viragem ou promessa para o futuro.
[Refrão Final] — Explosao emocional, encerramento marcante.

Cada marcador deve ter 2 a 4 linhas de verso.
Total: 30 a 45 linhas (incluindo marcadores).

GANCHO: Se fornecido, o refrão DEVE incorporar ou girar em torno dessa frase.

DEDICATORIA: Carta curta (2-3 frases) em prosa, sem repetir a letra.`);

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

  const formContext = buildFormContext(formData);
  const recipientName = clean(formData.recipientName);
  const whereItHappened = clean(formData.whereItHappened);
  const hookPhrase = clean(formData.hookPhrase);

  return `${promptMestre}

ORIENTAÇÃO ESPECÍFICA PARA ESTA RELAÇÃO/OCASIÃO:
${basePrompt}

DADOS DO FORMULÁRIO (use estas informações reais para escrever a letra):
${formContext}

INSTRUÇÕES FINAIS:
- A letra DEVE usar o nome do destinatário${recipientName ? ` ("${recipientName}")` : ''} de forma natural e emocionante.
${whereItHappened ? `- Refira o local ("${whereItHappened}") na letra quando fizer sentido.\n` : ''}${hookPhrase ? `- GANCHO: O refrão DEVE incorporar ou girar em torno desta frase: "${hookPhrase}".\n` : ''}- Evite letras genéricas e gírias forçadas. O tom deve refletir o estilo musical escolhido.
- O campo "letterText" é uma dedicatória CURTA (2-3 frases) em prosa, sem repetir a letra.

INSTRUÇÃO DE IDIOMA:
${languageInstruction(formData.language || 'português')}`;
}
