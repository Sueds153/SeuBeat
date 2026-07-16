// Debug: ver o que o Gemini está a devolver exactamente
import { GoogleGenAI } from '@google/genai';
import { config } from 'dotenv';
config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY em falta'); process.exit(1); }

const SYSTEM_PROMPT = `Você é um compositor de estúdio profissional.
Você deve produzir a letra da música e a dedicatória exclusivamente em formato JSON estruturado.
A sua resposta DEVE ser apenas o objeto JSON sem nenhum texto explicativo, preâmbulo ou conclusão fora do JSON.

O JSON gerado deve obrigatoriamente seguir esta estrutura:
{
  "songTitle": "Título Criativo",
  "lyrics": [
    "[Verso 1]",
    "linha 1 do verso...",
    "[Refrão]",
    "linha 1 do refrão..."
  ],
  "letterText": "Dedicatória curta (2-3 frases) em prosa, sem repetir a letra."
}`;

const genAI = new GoogleGenAI({ apiKey });

console.log('A chamar Gemini...');
const start = Date.now();

try {
  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      { role: 'user', parts: [{ text: `Crie uma música de aniversário para Maria (mãe), de Kizomba, em português de Angola. A memória especial foi uma viagem ao Namibe. Retorne apenas o JSON.` }] }
    ],
    config: {
      systemInstruction: { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
      maxOutputTokens: 8192,
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const text = response.text;

  console.log(`\n⏱️  Tempo: ${elapsed}s`);
  console.log(`📏 Tamanho da resposta: ${text?.length || 0} chars`);
  console.log(`\n--- RESPOSTA RAW (primeiros 500 chars) ---`);
  console.log(text?.slice(0, 500));
  console.log(`--- RESPOSTA RAW (últimos 200 chars) ---`);
  console.log(text?.slice(-200));

  // Tentar parse
  try {
    const json = JSON.parse(text);
    console.log('\n✅ JSON válido!');
    console.log(`  songTitle: "${json.songTitle}"`);
    console.log(`  lyrics: ${json.lyrics?.length || 0} linhas`);
    console.log(`  letterText: ${json.letterText?.length || 0} chars`);
  } catch (e) {
    console.log('\n❌ JSON INVÁLIDO:', e.message);
    // Ver se está truncado
    const firstBrace = text?.indexOf('{');
    const lastBrace = text?.lastIndexOf('}');
    console.log(`  Primeiro '{': pos ${firstBrace}`);
    console.log(`  Último '}': pos ${lastBrace}`);
    console.log(`  JSON fechado correctamente: ${lastBrace > firstBrace}`);
  }

} catch (err) {
  console.error('❌ Erro ao chamar Gemini:', err.message);
}
