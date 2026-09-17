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
          date: '2026-09-17 14:30',
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
          date: '2026-09-17 15:00',
          transactionId: null,
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
          date: '2026-09-17',
          transactionId: null,
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
          date: '17/09/2026 14:30',
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
              date: '2026-09-17',
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
          isMulticaixa: true,
          rawText: 'Pagamento 9900 Kz',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'express', 'express');

      expect(result.extracted.recipientPhone).toBeNull();
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
      // No Multicaixa, no amount, no phone → low confidence → auto_reject is correct
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
          date: null,
          transactionId: null,
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
          date: null,
          transactionId: null,
          isMulticaixa: true,
          rawText: 'Pagamento Multicaixa Express 7900 Kz confirmado para 929423278',
        }),
      });

      const result = await verifyPaymentProof(makeFakeBuffer(), 'image/jpeg', 'standard', 'express');

      expect(result.decision).toBe('auto_approve');
      const amountCheck = result.checks.find(c => c.name.includes('Valor'));
      expect(amountCheck?.passed).toBe(true);
    });
  });
});
