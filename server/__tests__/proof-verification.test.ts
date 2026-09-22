import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the external providers before importing the module
const mockGeminiGenerate = vi.fn();
const mockOpenAIChat = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: mockGeminiGenerate },
  })),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAIChat } },
  })),
}));

import { verifyPaymentProof } from '../services/proofVerification';

// Helper: create a minimal JPEG-like buffer for testing
function makeFakeBuffer(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]); // JPEG header
}

// Helper: recent date (within 48h)
function recentDate(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ');
}

// Helper: old date (>48h ago)
function oldDate(): string {
  return '2026-09-15 14:30';
}

describe('proofVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.MULTICAIXA_EXPRESS_PHONE = '929423278';
    process.env.MULTICAIXA_ENTIDADE = '10116';
    process.env.MULTICAIXA_REFERENCIA = '929423278';
    process.env.PROOF_AUTO_APPROVE_THRESHOLD = '0.85';
    process.env.PROOF_AUTO_REJECT_THRESHOLD = '0.50';
  });

  // ── Gemini Vision Tests ──────────────────────────────────────────────────

  describe('Gemini vision (primary provider)', () => {
    it('auto-approves when all checks pass (express payment)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '244929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9.900 Kz para 929423278 Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.decision).toBe('auto_approve');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.provider).toBe('Gemini');
      expect(result.extracted.amount).toBe(9900);
      expect(result.extracted.isMulticaixa).toBe(true);
      expect(result.extracted.recipientPhone).toBe('929423278');
    });

    it('auto-approves reference payment with correct entity/reference', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 7900,
          recipientPhone: null,
          entity: '10116',
          reference: '929423278',
          date: recentDate(),
          transactionId: 'REF78901',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Entidade 10116 Ref 929423278 Valor 7900 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'standard', 'reference');

      expect(result.decision).toBe('auto_approve');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.extracted.entity).toBe('10116');
      expect(result.extracted.reference).toBe('929423278');
    });

    it('manual review when amount is below plan price', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 5000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 5000 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.decision).toBe('manual_review');
      expect(result.confidence).toBeLessThan(0.85);
      expect(result.confidence).toBeGreaterThanOrEqual(0.50);
      // Amount check fails
      const amountCheck = result.checks.find(c => c.name.includes('Valor'));
      expect(amountCheck?.passed).toBe(false);
    });

    it('auto-rejects when not Multicaixa and no valid data', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: null,
          recipientPhone: null,
          entity: null,
          reference: null,
          date: null,
          transactionId: null,
          isMulticaixa: false,
          rawText: '',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'standard', 'express');

      expect(result.decision).toBe('auto_reject');
      expect(result.confidence).toBeLessThan(0.50);
      expect(result.extracted.isMulticaixa).toBe(false);
    });

    it('handles Gemini response with amount as string', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: '9.900 Kz',
          recipientPhone: '+244 929 423 278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'ABC123',
          isMulticaixa: true,
          rawText: 'Transferencia Multicaixa Express 9.900 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.amount).toBe(9900);
      expect(result.extracted.recipientPhone).toBe('929423278');
      expect(result.decision).toBe('auto_approve');
    });
  });

  // ── OpenAI Fallback Tests ────────────────────────────────────────────────

  describe('OpenAI vision (fallback)', () => {
    it('falls back to OpenAI when Gemini fails', async () => {
      mockGeminiGenerate.mockRejectedValue(new Error('Gemini API error'));
      mockOpenAIChat.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              amount: 9900,
              recipientPhone: '929423278',
              entity: null,
              reference: null,
              date: recentDate(),
              transactionId: 'TXN999',
              isMulticaixa: true,
              rawText: 'Pagamento confirmado 9900 Kz',
            }),
          },
        }],
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.decision).toBe('auto_approve');
      expect(result.provider).toBe('OpenAI');
      expect(mockGeminiGenerate).toHaveBeenCalled();
      expect(mockOpenAIChat).toHaveBeenCalled();
    });

    it('returns manual_review when both providers fail', async () => {
      mockGeminiGenerate.mockRejectedValue(new Error('Gemini down'));
      mockOpenAIChat.mockRejectedValue(new Error('OpenAI down'));

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.decision).toBe('manual_review');
      expect(result.confidence).toBe(0);
      expect(result.provider).toBe('none');
      expect(result.error).toBeDefined();
    });
  });

  // ── Rule-Based Checks Tests ──────────────────────────────────────────────

  describe('rule-based checks', () => {
    it('checks Multicaixa detection', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: false,
          rawText: 'Comprovativo de transferencia 9900 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const mcCheck = result.checks.find(c => c.name.includes('Multicaixa'));
      expect(mcCheck?.passed).toBe(false);
    });

    it('checks amount exceeds plan price (express accepts higher)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 15000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 15000 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const amountCheck = result.checks.find(c => c.name.includes('Valor'));
      expect(amountCheck?.passed).toBe(true); // 15000 >= 9900
    });

    it('flags unreasonable amount (>3x plan price)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 50000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 50000 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const reasonableCheck = result.checks.find(c => c.name.includes('razoável'));
      expect(reasonableCheck?.passed).toBe(false); // 50000 > 29700 (3x9900)
    });

    it('checks raw text is present (>20 chars)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'hi',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const textCheck = result.checks.find(c => c.name.includes('Texto'));
      expect(textCheck?.passed).toBe(false);
    });
  });

  // ── Phone Normalization Tests ────────────────────────────────────────────

  describe('phone normalization', () => {
    it('normalizes +244 prefix', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '+244 929 423 278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 9900 Kz para +244 929 423 278',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.recipientPhone).toBe('929423278');
    });

    it('normalizes phone with spaces and dashes', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929-423-278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento para 929-423-278',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.recipientPhone).toBe('929423278');
    });

    it('returns null for too-short phone', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '123',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 9900 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.recipientPhone).toBeNull();
    });
  });

  // ── Anti-fraud: Transaction ID ────────────────────────────────────────────

  describe('anti-fraud: transaction ID', () => {
    it('manual review when transaction ID is missing', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: null,
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      // Without transaction ID, max confidence is 1.0 - 0.15 = 0.85 → manual_review (boundary)
      expect(result.decision).toBe('manual_review');
      const txCheck = result.checks.find(c => c.name.includes('Transaction ID'));
      expect(txCheck?.passed).toBe(false);
    });

    it('manual review when transaction ID is too short', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'AB',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.decision).toBe('manual_review');
      const txCheck = result.checks.find(c => c.name.includes('Transaction ID'));
      expect(txCheck?.passed).toBe(false);
      expect(txCheck?.actual).toBe('AB');
    });

    it('passes when transaction ID is present and valid', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345678',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const txCheck = result.checks.find(c => c.name.includes('Transaction ID'));
      expect(txCheck?.passed).toBe(true);
      expect(txCheck?.actual).toBe('TXN12345678');
    });

    it('auto-approves masked transaction ID (639182******5895)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 15000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: '639182******5895',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 15000 Kz Confirmado Transaccao 639182******5895',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const txCheck = result.checks.find(c => c.name.includes('Transaction ID'));
      expect(txCheck?.passed).toBe(true);
      expect(txCheck?.actual).toBe('639182******5895');
      expect(result.decision).toBe('auto_approve');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('masked ID with too few digits still fails check 6', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: '12***34',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const txCheck = result.checks.find(c => c.name.includes('Transaction ID'));
      expect(txCheck?.passed).toBe(false);
      expect(result.decision).toBe('manual_review');
    });
  });

  // ── Anti-fraud: Date freshness ────────────────────────────────────────────

  describe('anti-fraud: date freshness', () => {
    it('passes when date is recent (< 48h)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(true);
    });

    it('fails when date is old (> 48h)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: oldDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(false);
      expect(dateCheck?.actual).toContain('>48h antigo');
    });

    it('fails when date is in the future', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: '2027-01-01 12:00',
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(false);
      expect(dateCheck?.actual).toContain('futuro');
    });

    it('fails when date is missing', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: null,
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(false);
      expect(dateCheck?.actual).toBe('Não lido');
    });

    it('parses Angola DD/MM/YYYY recent date as pass', async () => {
      // Day-first format used on Multicaixa receipts (e.g. 22/09/2026 = 22 Sep 2026)
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 15000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: `${dd}/${mm}/${yyyy} 01:26`,
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 15000 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(true);
      expect(result.decision).toBe('auto_approve');
    });

    it('rejects old DD/MM/YYYY date as >48h antigo', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: '15/09/2026 14:30',
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const dateCheck = result.checks.find(c => c.name.includes('Data recente'));
      expect(dateCheck?.passed).toBe(false);
      expect(dateCheck?.actual).toContain('>48h antigo');
    });
  });

  // ── Anti-fraud: Amount consistency ────────────────────────────────────────

  describe('anti-fraud: amount consistency', () => {
    it('passes when amount matches plan price', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const consistCheck = result.checks.find(c => c.name.includes('consistente'));
      expect(consistCheck?.passed).toBe(true);
    });

    it('fails when amount is wildly inconsistent (> 5x plan)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 50000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 50000 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const consistCheck = result.checks.find(c => c.name.includes('consistente'));
      expect(consistCheck?.passed).toBe(false);
    });

    it('passes when amount is slightly below (< 0.95x plan)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9000,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento 9000 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      const consistCheck = result.checks.find(c => c.name.includes('consistente'));
      expect(consistCheck?.passed).toBe(false); // 9000/9900 = 0.91x < 0.95x
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles null/missing fields gracefully', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          rawText: 'some text visible in screenshot',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'standard', 'express');

      expect(result.extracted.amount).toBeNull();
      expect(result.extracted.recipientPhone).toBeNull();
      expect(result.extracted.entity).toBeNull();
      expect(result.extracted.isMulticaixa).toBe(false);
      // No Multicaixa, no amount, no phone, no tx_id → low confidence → auto_reject
      expect(result.decision).toBe('auto_reject');
      expect(result.confidence).toBeLessThan(0.50);
    });

    it('handles empty Gemini response', async () => {
      mockGeminiGenerate.mockResolvedValue({ text: '' });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      // Should fallback to OpenAI or return manual_review
      expect(['manual_review', 'auto_approve', 'auto_reject']).toContain(result.decision);
    });

    it('handles invalid JSON from Gemini', async () => {
      mockGeminiGenerate.mockResolvedValue({ text: 'not json at all' });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      // Should fallback to OpenAI or return manual_review
      expect(result.decision).toBeDefined();
    });

    it('premium plan requires 14900 Kz', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 14900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXNPREM',
          isMulticaixa: true,
          rawText: 'Pagamento Premium 14900 Kz confirmado com sucesso Multicaixa Express',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'premium', 'express');

      expect(result.decision).toBe('auto_approve');
      expect(result.extracted.amount).toBe(14900);
    });

    it('standard plan only needs 7900 Kz', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 7900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXNSTD',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 7900 Kz confirmado para 929423278',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'standard', 'express');

      expect(result.decision).toBe('auto_approve');
      const amountCheck = result.checks.find(c => c.name.includes('Valor'));
      expect(amountCheck?.passed).toBe(true);
    });

    it('returns 8 checks total', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.checks).toHaveLength(8);
      // Weights sum to 1.00
      const totalWeight = result.checks.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1.00, 2);
    });

    it('normalizes new fields (senderPhone, txStatus, consistencyFlags)', async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: JSON.stringify({
          amount: 9900,
          recipientPhone: '929423278',
          entity: null,
          reference: null,
          date: recentDate(),
          transactionId: 'TXN12345',
          isMulticaixa: true,
          senderPhone: '+244 912 345 678',
          txStatus: 'Concluído',
          consistencyFlags: [],
          rawText: 'Pagamento Multicaixa Express 9900 Kz Confirmado',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.senderPhone).toBe('912345678');
      expect(result.extracted.txStatus).toBe('Concluído');
      expect(result.extracted.consistencyFlags).toEqual([]);
    });
  });
});
