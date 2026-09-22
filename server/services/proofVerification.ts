import { logInfo, logWarn, logError } from '../utils/logger';

// Lazy-loaded Google GenAI SDK — avoids startup crash if package has issues
let _GoogleGenAI: typeof import('@google/genai')['GoogleGenAI'] | null = null;
async function loadGoogleGenAI() {
  if (!_GoogleGenAI) _GoogleGenAI = (await import('@google/genai')).GoogleGenAI;
  return _GoogleGenAI;
}

// ─── Pricing ────────────────────────────────────────────────────────────────
const PLAN_PRICES: Record<string, number> = {
  standard: 7900,
  express: 9900,
  premium: 14900,
};

const EXPECTED_PHONE = process.env.MULTICAIXA_EXPRESS_PHONE || process.env.MULTICAIXA_REFERENCIA || '929423278';
const EXPECTED_ENTITY = process.env.MULTICAIXA_ENTIDADE || '10116';
const EXPECTED_REFERENCE = process.env.MULTICAIXA_REFERENCIA || '929423278';

// ─── Thresholds (configurable via env) ───────────────────────────────────────
const AUTO_APPROVE_THRESHOLD = Number(process.env.PROOF_AUTO_APPROVE_THRESHOLD || '0.85');
const AUTO_REJECT_THRESHOLD = Number(process.env.PROOF_AUTO_REJECT_THRESHOLD || '0.50');

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ExtractedProof {
  amount: number | null;
  recipientPhone: string | null;
  entity: string | null;
  reference: string | null;
  date: string | null;
  transactionId: string | null;
  isMulticaixa: boolean;
  rawText: string;
  senderPhone?: string | null;
  txStatus?: string | null;
  consistencyFlags?: string[];
}

// ─── Timeout helper ───────────────────────────────────────────────────────────
const AI_TIMEOUT_MS = 10_000;
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

export interface VerificationResult {
  verified: boolean;
  confidence: number;
  decision: 'auto_approve' | 'manual_review' | 'auto_reject';
  extracted: ExtractedProof;
  checks: CheckResult[];
  provider: string;
  error?: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  weight: number;
}

// ─── Vision Prompt ───────────────────────────────────────────────────────────
const VISION_PROMPT = `Analisa este comprovativo de pagamento Multicaixa (Angola). Lê TODOS os dados visíveis e verifica consistência entre eles.

Extrai EXATAMENTE estes dados em JSON (sem texto fora do JSON):
{
  "amount": número ou null se não visível,
  "recipientPhone": "929423278" ou null,
  "entity": "10116" ou null (entidade de pagamento),
  "reference": "929423278" ou null (referência de pagamento),
  "date": "YYYY-MM-DD HH:mm" ou null,
  "transactionId": "nº da transação" ou null — OBRIGATÓRIO em comprovativos Multicaixa legítimos,
  "isMulticaixa": true/false (se é comprovativo Multicaixa),
  "senderPhone": "phone do remetente" ou null (se visível),
  "txStatus": "Concluído"/"Pendente"/"Falhado" ou null (estado da transação),
  "consistencyFlags": ["inconsistências detetadas"] ou [],
  "rawText": "todo o texto visível no comprovativo, sem formatação"
}

Regras IMPORTANTES:
- O valor pode aparecer como "9.900 Kz", "9900", "9 900 Kz", etc — converte sempre para número inteiro
- Se houver múltiplos valores, escolhe o VALOR PRINCIPAL da transação
- O phone pode aparecer como "+244 929 423 278" ou "929423278" — normaliza para só dígitos
- A data pode estar em formato "DD/MM/YYYY HH:mm" ou "DD-MM-YYYY"
- transactionId: TODO comprovativo Multicaixa tem um nº de transação (ex: "TXN123456", "Ref: 123456"). Se não consegues ler, coloca null — mas indica no consistencyFlags
- Verifica consistência: se o valor é muito diferente do esperado, ou se há múltiplos valores contraditórios, ou se o phone/entidade não parece válido — adiciona a consistencyFlags
- Procura sinais de manipulação: fontes diferentes, layout quebrado, cores inconsistentes, texto sobreposto — adiciona a consistencyFlags
- Se não consegues ler algo, coloca null — não inventes
- isMulticaixa deve ser true se vires layout, cores ou logo da Multicaixa`;

// ─── Gemini Vision ───────────────────────────────────────────────────────────
async function analyzeWithGemini(buffer: Buffer, mimeType: string): Promise<ExtractedProof> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY não configurada');

  const GoogleGenAI = await loadGoogleGenAI();
  const genAI = new GoogleGenAI({ apiKey });
  const base64 = buffer.toString('base64');
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const response = await genAI.models.generateContent({
    model,
    contents: [{
      role: 'user',
      parts: [
        { text: VISION_PROMPT },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: base64 } },
      ],
    }],
    config: {
      maxOutputTokens: 2048,
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const text = response.text;
  if (!text) throw new Error('Gemini retornou resposta vazia');

  const parsed = JSON.parse(text) as Record<string, unknown>;
  return normalizeExtracted(parsed, 'Gemini');
}

// ─── OpenAI Vision (fallback) ────────────────────────────────────────────────
async function analyzeWithOpenAI(buffer: Buffer, mimeType: string): Promise<ExtractedProof> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada');

  const OpenAI = (await import('openai')).default;
  const openai = new OpenAI({ apiKey });
  const base64 = buffer.toString('base64');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 1024,
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'Responde apenas em JSON válido.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: VISION_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${base64}` } },
        ],
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI retornou resposta vazia');

  const parsed = JSON.parse(content) as Record<string, unknown>;
  return normalizeExtracted(parsed, 'OpenAI');
}

// ─── Normalize extracted data ────────────────────────────────────────────────
function normalizeExtracted(raw: Record<string, unknown>, provider: string): ExtractedProof {
  return {
    amount: typeof raw.amount === 'number' ? raw.amount : parseAmount(String(raw.amount || '')),
    recipientPhone: normalizePhone(String(raw.recipientPhone || '')),
    entity: normalizeDigits(String(raw.entity || '')),
    reference: normalizeDigits(String(raw.reference || '')),
    date: typeof raw.date === 'string' ? raw.date : null,
    transactionId: typeof raw.transactionId === 'string' ? raw.transactionId : null,
    isMulticaixa: Boolean(raw.isMulticaixa),
    rawText: String(raw.rawText || '').slice(0, 2000),
    senderPhone: normalizePhone(String(raw.senderPhone || '')),
    txStatus: typeof raw.txStatus === 'string' ? raw.txStatus : null,
    consistencyFlags: Array.isArray(raw.consistencyFlags) ? raw.consistencyFlags.filter(f => typeof f === 'string') : [],
    _provider: provider,
  } as ExtractedProof & { _provider: string };
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function normalizePhone(s: string): string | null {
  const digits = s.replace(/[^0-9]/g, '');
  // Angola phone: 9 digits starting with 9, or 12 with +244 prefix
  if (digits.length === 9 && digits.startsWith('9')) return digits;
  if (digits.length === 12 && digits.startsWith('244')) return digits.slice(3);
  if (digits.length === 10 && digits.startsWith('2449')) return digits.slice(3);
  return digits.length >= 7 ? digits : null;
}

function normalizeDigits(s: string): string | null {
  const digits = s.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits : null;
}

// Parse AI date strings robustly: ISO, "YYYY-MM-DD HH:mm", DD/MM/YYYY, DD-MM-YYYY.
// Angola receipts use DD/MM/YYYY — prefer day-first when ambiguous (e.g. 05/09 = 5 Sep).
// Returns a Date or null (null → check fails, same as before).
function parseProofDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;

  // Already ISO-ish or "YYYY-MM-DD HH:mm" — Date handles both in V8
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY or DD-MM-YYYY [HH:mm[:ss]]
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, dd, mm, yyyy, hh, mi, ss] = m;
    const day = Number(dd);
    const month = Number(mm);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(
      Number(yyyy),
      month - 1,
      day,
      Number(hh || 0),
      Number(mi || 0),
      Number(ss || 0),
    );
    return isNaN(d.getTime()) ? null : d;
  }

  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ─── Rule-based checks ──────────────────────────────────────────────────────
function runChecks(
  extracted: ExtractedProof,
  plan: string,
  paymentMethod: string,
): CheckResult[] {
  const expectedAmount = PLAN_PRICES[plan] || 0;
  const checks: CheckResult[] = [];

  // Check 1: Is it a Multicaixa proof?
  checks.push({
    name: 'É comprovativo Multicaixa',
    passed: extracted.isMulticaixa,
    expected: 'Sim',
    actual: extracted.isMulticaixa ? 'Sim' : 'Não',
    weight: 0.20,
  });

  // Check 2: Amount matches or exceeds plan price
  const amountOk = extracted.amount !== null && extracted.amount >= expectedAmount;
  checks.push({
    name: `Valor ≥ ${expectedAmount.toLocaleString('pt')} Kz`,
    passed: amountOk,
    expected: `≥ ${expectedAmount.toLocaleString('pt')} Kz`,
    actual: extracted.amount !== null ? `${extracted.amount.toLocaleString('pt')} Kz` : 'Não lido',
    weight: 0.20,
  });

  // Check 3: Recipient matches
  if (paymentMethod === 'express') {
    const phoneOk = extracted.recipientPhone !== null &&
      (extracted.recipientPhone.includes(EXPECTED_PHONE) || EXPECTED_PHONE.includes(extracted.recipientPhone));
    checks.push({
      name: `Destinatário (phone ${EXPECTED_PHONE})`,
      passed: phoneOk,
      expected: EXPECTED_PHONE,
      actual: extracted.recipientPhone || 'Não lido',
      weight: 0.20,
    });
  } else {
    const entityOk = extracted.entity !== null && extracted.entity.includes(EXPECTED_ENTITY);
    const refOk = extracted.reference !== null && extracted.reference.includes(EXPECTED_REFERENCE);
    checks.push({
      name: `Entidade (${EXPECTED_ENTITY}) + Referência (${EXPECTED_REFERENCE})`,
      passed: entityOk && refOk,
      expected: `${EXPECTED_ENTITY} / ${EXPECTED_REFERENCE}`,
      actual: `${extracted.entity || '?'} / ${extracted.reference || '?'}`,
      weight: 0.20,
    });
  }

  // Check 4: Has text content (proof isn't blank/corrupt)
  checks.push({
    name: 'Texto visível no comprovativo',
    passed: extracted.rawText.length > 20,
    expected: 'Texto legível',
    actual: `${extracted.rawText.length} caracteres`,
    weight: 0.05,
  });

  // Check 5: Amount doesn't wildly exceed (possible overpay — still approve but note)
  const amountReasonable = extracted.amount === null || extracted.amount <= expectedAmount * 3;
  checks.push({
    name: 'Valor razoável (< 3x o esperado)',
    passed: amountReasonable,
    expected: `< ${(expectedAmount * 3).toLocaleString('pt')} Kz`,
    actual: extracted.amount !== null ? `${extracted.amount.toLocaleString('pt')} Kz` : 'Não lido',
    weight: 0.05,
  });

  // Check 6: Transaction ID exists (critical for Multicaixa proofs)
  const txId = extracted.transactionId;
  const txIdOk = txId !== null && txId.length >= 3;
  checks.push({
    name: 'Transaction ID legível',
    passed: txIdOk,
    expected: 'Nº de transação presente',
    actual: txId || 'Não lido',
    weight: 0.15,
  });

  // Check 7: Date is recent (< 48h)
  let dateOk = false;
  let dateActual = 'Não lido';
  if (extracted.date) {
    const proofDate = parseProofDate(extracted.date);
    if (proofDate) {
      const now = Date.now();
      const diffMs = now - proofDate.getTime();
      const diffH = diffMs / (1000 * 60 * 60);
      if (diffMs < 0) {
        dateActual = `${extracted.date} (futuro)`;
        dateOk = false;
      } else if (diffH > 48) {
        dateActual = `${extracted.date} (>48h antigo)`;
        dateOk = false;
      } else {
        dateActual = `${extracted.date} (${Math.round(diffH)}h atrás)`;
        dateOk = true;
      }
    } else {
      dateActual = `${extracted.date} (data inválida)`;
      dateOk = false;
    }
  }
  checks.push({
    name: 'Data recente (< 48h)',
    passed: dateOk,
    expected: 'Data das últimas 48h',
    actual: dateActual,
    weight: 0.10,
  });

  // Check 8: Amount consistency with plan
  let amountConsistent = true;
  if (extracted.amount !== null && expectedAmount > 0) {
    const ratio = extracted.amount / expectedAmount;
    amountConsistent = ratio >= 0.95 && ratio <= 5;
  }
  checks.push({
    name: 'Valor consistente com o plano',
    passed: amountConsistent,
    expected: '0.95x–5x o preço do plano',
    actual: extracted.amount !== null ? `${(extracted.amount / expectedAmount).toFixed(1)}x (${extracted.amount.toLocaleString('pt')} Kz)` : 'Não lido',
    weight: 0.05,
  });

  return checks;
}

function computeConfidence(checks: CheckResult[]): number {
  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passedWeight = checks.filter(c => c.passed).reduce((sum, c) => sum + c.weight, 0);
  return totalWeight > 0 ? Math.round((passedWeight / totalWeight) * 100) / 100 : 0;
}

// ─── Main verification function ─────────────────────────────────────────────
export async function verifyPaymentProof(
  buffer: Buffer,
  mimeType: string,
  plan: string,
  paymentMethod: string,
): Promise<VerificationResult> {
  const startTime = Date.now();
  let extracted: ExtractedProof | null = null;
  let provider = 'none';

  // Layer 1: AI Vision (try Gemini, fallback OpenAI) — each with 15s timeout
  try {
    extracted = await withTimeout(analyzeWithGemini(buffer, mimeType), AI_TIMEOUT_MS, 'Gemini');
    provider = 'Gemini';
  } catch (geminiErr: unknown) {
    logWarn('[ProofVerification] Gemini vision falhou, a tentar OpenAI', { error: geminiErr instanceof Error ? geminiErr.message : String(geminiErr) });
    try {
      extracted = await withTimeout(analyzeWithOpenAI(buffer, mimeType), AI_TIMEOUT_MS, 'OpenAI');
      provider = 'OpenAI';
    } catch (openaiErr: unknown) {
      logError('[ProofVerification] Ambos os providers de vision falharam', openaiErr);
      // If AI fails entirely, return low confidence — don't auto-approve
      return {
        verified: false,
        confidence: 0,
        decision: 'manual_review',
        extracted: { amount: null, recipientPhone: null, entity: null, reference: null, date: null, transactionId: null, isMulticaixa: false, rawText: '', senderPhone: null, txStatus: null, consistencyFlags: [] },
        checks: [],
        provider: 'none',
        error: `AI vision indisponível: ${geminiErr instanceof Error ? geminiErr.message : 'unknown'}`,
      };
    }
  }

  // Layer 2: Rule-based checks
  const checks = runChecks(extracted, plan, paymentMethod);
  const confidence = computeConfidence(checks);

  // Layer 3: Decision
  let decision: 'auto_approve' | 'manual_review' | 'auto_reject';
  if (confidence >= AUTO_APPROVE_THRESHOLD) {
    decision = 'auto_approve';
  } else if (confidence >= AUTO_REJECT_THRESHOLD) {
    decision = 'manual_review';
  } else {
    decision = 'auto_reject';
  }

  // Layer 4: Hard anti-fraud override — transaction_id is mandatory
  if (decision === 'auto_approve') {
    const txId = extracted.transactionId;
    if (!txId || txId.length < 3) {
      decision = 'manual_review';
      logWarn('[ProofVerification] auto_approve bloqueado — transaction_id não lido');
    }
  }

  const elapsed = Date.now() - startTime;
  logInfo('[ProofVerification] Verificação concluída', {
    provider,
    confidence,
    decision,
    elapsed: `${elapsed}ms`,
    checksPassed: checks.filter(c => c.passed).length,
    checksTotal: checks.length,
    amount: extracted.amount,
    isMulticaixa: extracted.isMulticaixa,
  });

  return {
    verified: decision === 'auto_approve',
    confidence,
    decision,
    extracted,
    checks,
    provider,
  };
}

// ─── Re-analyze (for admin re-check) ────────────────────────────────────────
export async function reAnalyzeProof(
  buffer: Buffer,
  mimeType: string,
  plan: string,
  paymentMethod: string,
): Promise<VerificationResult> {
  return verifyPaymentProof(buffer, mimeType, plan, paymentMethod);
}
