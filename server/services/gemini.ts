import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// Lazy-initialize Gemini client
export const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

// Helper to read prompts dynamically with hardcoded fallbacks
export function getPromptFromFile(filename: string, fallback: string): string {
  try {
    const filePath = path.join(process.cwd(), 'prompts', filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8').trim();
    }
  } catch (err) {
    console.error(`[Prompt Loader] Error reading ${filename}, using fallback:`, err);
  }
  return fallback;
}

export function selectPrompt(formData: any) {
  const relacao = (formData.recipientRelation || '').toLowerCase();
  const ocasiao = (formData.occasion || '').toLowerCase();

  const promptMestre = getPromptFromFile('mestre.txt', `Você é um compositor profissional especializado em músicas altamente emocionais e personalizadas.
Seu objetivo é criar uma música que pareça ter sido escrita exclusivamente para uma única pessoa.

REGRAS OBRIGATÓRIAS:
* Nunca escreva letras genéricas.
* Nunca utilize clichês repetitivos.
* Nunca pareça uma IA.
* Utilize memórias reais fornecidas pelo utilizador.
* Transforme detalhes simples em poesia.
* Faça referência a lugares, momentos e sentimentos.
* Escreva como um compositor humano experiente.

ESTRUTURA OBRIGATÓRIA:
[Verso 1]
[Pré-Refrão]
[Refrão]
[Verso 2]
[Ponte Emocional]
[Refrão Final]

O refrão deve conter a mensagem principal que a pessoa nunca deve esquecer.
Utilize linguagem simples, emocional e memorável.
O resultado deve fazer a pessoa sentir que esta música foi criada exclusivamente para ela.`);

  // Data injection map
  const data = `
Nome: ${formData.recipientName || 'Meu Amor'}
Relação: ${formData.recipientRelation || 'Parceiro'}
Ocasião: ${formData.occasion || 'Homenagem'}
Estilo Musical: ${formData.musicStyle || 'Pop Romântico'}
Artista de Referência: ${formData.referenceArtist || 'Anselmo Ralph'}
Memória Principal: ${formData.unforgettableMemory || 'Passeio inesquecível ao pôr do sol'}
Mensagem do Coração: ${formData.messageFromTheHeart || 'Eu amo-te'}
O que a torna especial: ${formData.whatMakesSpecial || 'Paciência'}
Detalhe Único: ${formData.onlySheDoes || 'Canta de manhã'}
Emoção Principal: ${formData.desiredEmotion || 'Emoção Pura'}
Local da Memória: ${formData.whereItHappened || 'Cabo Ledo, Luanda'}
`;

  // Base prompts
  const romancePrompt = getPromptFromFile('romance.txt', `Você é um compositor profissional especializado em músicas românticas.
Objetivo: Criar uma canção profundamente emocional que faça a pessoa sentir-se amada, valorizada e única.
A música deve focar em:
- História do casal
- Memórias especiais
- Sonhos em comum
- Pequenos detalhes únicos
- Conexão emocional
IMPORTANTE: Transforme detalhes simples em poesia. Não escreva frases genéricas. Não utilize clichês. O refrão deve ser memorável e conter a principal mensagem de amor. Faça parecer que apenas esta pessoa poderia receber esta música.`);

  const maePrompt = getPromptFromFile('mae.txt', `Você é um compositor especializado em homenagens para mães.
Objetivo: Criar uma música que provoque lágrimas de emoção.
A música deve destacar:
- Sacrifícios feitos pela mãe
- Amor incondicional
- Proteção
- Apoio nos momentos difíceis
- Gratidão
A letra deve parecer uma carta de agradecimento transformada em música. O refrão deve fazer a mãe sentir orgulho e amor.`);

  const paiPrompt = getPromptFromFile('pai.txt', `Você é um compositor especializado em homenagens para pais.
Objetivo: Transmitir respeito, orgulho e gratidão.
A música deve destacar:
- Conselhos
- Ensinamentos
- Trabalho
- Exemplo de vida
- Força
A letra deve transmitir admiração. O refrão deve representar o legado deixado pelo pai.`);

  const filhoPrompt = getPromptFromFile('filho.txt', `Você é um compositor especializado em músicas para filhos.
Objetivo: Transmitir amor, proteção e orgulho.
A música deve abordar:
- Crescimento
- Sonhos
- Futuro
- Momentos especiais
- Orgulho dos pais
A letra deve transmitir carinho e esperança. O refrão deve fazer o filho sentir-se amado e especial.`);

  const familiaPrompt = getPromptFromFile('familia.txt', `Você é um compositor especializado em músicas familiares.
Objetivo: Celebrar a ligação entre irmãos ou família.
A música deve destacar:
- Infância
- Brincadeiras
- Apoio mútuo
- Complicidade
- Memórias em família
O tom deve ser caloroso e verdadeiro. O refrão deve representar uma ligação que nunca desaparece.`);

  const amizadePrompt = getPromptFromFile('amizade.txt', `Você é um compositor especializado em músicas de amizade.
Objetivo: Celebrar uma amizade verdadeira.
A música deve abordar:
- Momentos vividos juntos
- Apoio
- Lealdade
- Diversão
- Histórias partilhadas
A letra deve parecer uma homenagem sincera. O refrão deve representar a importância dessa amizade.`);

  const avoPrompt = getPromptFromFile('avo.txt', `Você é um compositor especializado em homenagens para avós.
Objetivo: Transmitir carinho, respeito e gratidão.
A música deve destacar:
- Sabedoria
- Histórias de vida
- Amor familiar
- Cuidados recebidos
- Memórias de infância
O tom deve ser doce, nostálgico e emocionante. O refrão deve representar o amor eterno da família.`);

  const professorPrompt = getPromptFromFile('professor.txt', `Você é um compositor especializado em homenagens.
Objetivo: Criar uma música para agradecer um professor que marcou uma vida.
A música deve destacar:
- Conhecimento transmitido
- Inspiração
- Apoio
- Impacto positivo
- Gratidão
O refrão deve mostrar como o professor mudou o futuro do aluno.`);

  const pastorPrompt = getPromptFromFile('pastor.txt', `Você é um compositor especializado em músicas de gratidão e fé.
Objetivo: Homenagear um líder espiritual.
A música deve destacar:
- Fe
- Orientação
- Apoio espiritual
- Conselhos
- Inspiração
O tom deve ser respeitoso e emocionante. O refrão deve transmitir bênção e gratidão.`);

  const colegaPrompt = getPromptFromFile('colega.txt', `Você é um compositor especializado em homenagens profissionais.
Objetivo: Reconhecer a importância de um colega.
A música deve destacar:
- Trabalho em equipa
- Superação
- Conquistas
- Companheirismo
- Respeito
O tom deve ser inspirador. O refrão deve transmitir admiração e reconhecimento.`);

  const saudadePrompt = getPromptFromFile('saudade.txt', `Você é um compositor especializado em músicas de saudade e reflexão.
Objetivo: Criar uma canção emocional sem parecer amarga.
A música deve abordar:
- Memórias bonitas
- Aprendizados
- Gratidão pelo passado
- Saudade
- Crescimento pessoal
Evite acusações. Evite negatividade. O tom deve ser maduro e sincero.`);

  const paramimPrompt = getPromptFromFile('paramim.txt', `Você é um compositor especializado em músicas de autoestima e superação.
Objetivo: Criar uma música inspiradora para a própria pessoa.
A música deve destacar:
- Conquistas
- Sonhos
- Crescimento
- Resiliência
- Autoamor
O refrão deve transmitir força e confiança.`);

  const outroPrompt = getPromptFromFile('outro.txt', `Você é um compositor profissional.
Analise cuidadosamente a relação descrita pelo utilizador.
Identifique:
- Tipo de relação
- Emoção predominante
- Objetivo da música
Adapte completamente o estilo da composição. A música deve parecer escrita especificamente para essa situação.`);

  const casamentoPrompt = getPromptFromFile('casamento.txt', "Escreva a canção de casamento perfeita. Celebre a união no altar, as promessas de amor eterno, as alianças e o começo de uma nova vida a dois.");
  const pedidoDesculpasPrompt = getPromptFromFile('pedido_desculpas.txt', "Escreva uma canção de pedido de perdão. Transmita vulnerabilidade sincera, arrependimento humilde e um apelo forte para não deixar o amor acabar.");
  const memorialPrompt = getPromptFromFile('memorial.txt', "Escreva uma canção in memoriam com tom suave e respeitoso. Fale de saudades imensas, de um amor que transcende a vida e de como a pessoa continua viva nas memórias.");
  const homenagemPrompt = getPromptFromFile('homenagem.txt', "Escreva uma canção de reconhecimento e aplauso. Fale sobre o sucesso, a trajetória, a admiração pela pessoa e o quanto ela é inspiradora e grandiosa.");

  let basePrompt = outroPrompt;

  // Occasion overrides (takes priority)
  if (ocasiao.includes('casamento')) {
    basePrompt = casamentoPrompt;
  } else if (ocasiao.includes('desculpa')) {
    basePrompt = pedidoDesculpasPrompt;
  } else if (ocasiao.includes('memorial') || ocasiao.includes('saudade')) {
    basePrompt = memorialPrompt;
  } else if (ocasiao.includes('homenagem')) {
    basePrompt = homenagemPrompt;
  } else {
    // Relationship logic
    if (relacao.includes('mãe') || relacao.includes('mae')) {
      basePrompt = maePrompt;
    } else if (relacao.includes('pai')) {
      basePrompt = paiPrompt;
    } else if (relacao.includes('avó') || relacao.includes('avô') || relacao.includes('avo')) {
      basePrompt = avoPrompt;
    } else if (relacao.includes('filh')) {
      basePrompt = filhoPrompt;
    } else if (relacao.includes('irmã') || relacao.includes('irma') || relacao.includes('irmão') || relacao.includes('irmao')) {
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
    } else if (relacao.includes('namorad') || relacao.includes('espos') || relacao.includes('marido')) {
      basePrompt = romancePrompt;
    }
  }

  // Final prompt composition: PROMPT_MESTRE + PROMPT_RELACAO + DADOS_FORMULARIO
  return `${promptMestre}

---

${basePrompt}

---

DADOS OBRIGATÓRIOS DO FORMULÁRIO:
${data}

Instruções finais:
- Crie a música respeitando exatamente a ESTRUTURA OBRIGATÓRIA.
- Adicione também uma carta de dedicatória tocante em texto contínuo no formato json, sem rimas, baseada na Mensagem do Coração.`;
}
