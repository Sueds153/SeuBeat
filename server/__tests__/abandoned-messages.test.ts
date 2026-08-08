import { describe, it, expect } from 'vitest';
import {
  bucketForElapsed,
  bucketLabel,
  buildAbandonedMessage,
  normalizePhoneToE164,
  ABANDONED_BUCKET_ORDER,
} from '../services/abandonedMessages';

describe('bucketForElapsed', () => {
  it('devolve null antes de 30min', () => {
    expect(bucketForElapsed(29 * 60 * 1000)).toBeNull();
  });

  it('devolve 30min aos 30min', () => {
    expect(bucketForElapsed(30 * 60 * 1000)).toBe('30min');
  });

  it('devolve 24h às 24h', () => {
    expect(bucketForElapsed(24 * 60 * 60 * 1000)).toBe('24h');
  });

  it('devolve 48h às 48h', () => {
    expect(bucketForElapsed(48 * 60 * 60 * 1000)).toBe('48h');
  });

  it('devolve 72h às 72h e acima', () => {
    expect(bucketForElapsed(72 * 60 * 60 * 1000)).toBe('72h');
    expect(bucketForElapsed(10 * 24 * 60 * 60 * 1000)).toBe('72h');
  });

  it('24h é mais prioritário que 72h quando ainda não passou 72h', () => {
    const h = 60 * 60 * 1000;
    expect(bucketForElapsed(30 * h)).toBe('24h');
  });
});

describe('bucketLabel', () => {
  it('devolve label conhecida', () => {
    expect(bucketLabel('30min')).toContain('30min');
  });

  it('devolve a própria key para bucket desconhecido', () => {
    expect(bucketLabel('xx' as never)).toBe('xx');
  });
});

describe('buildAbandonedMessage', () => {
  it('usa o primeiro nome do destinatário', () => {
    const msg = buildAbandonedMessage('30min', 'João Pedro', 'https://seubeat.ao/wizard?resume=x');
    expect(msg).toContain('João');
    expect(msg).toContain('https://seubeat.ao/wizard?resume=x');
  });

  it('tem fallback amigo(a) para nome vazio', () => {
    const msg = buildAbandonedMessage('30min', '', 'https://link');
    expect(msg).toContain('amigo(a)');
  });

  it('gera um template por bucket com link', () => {
    for (const key of ABANDONED_BUCKET_ORDER) {
      const msg = buildAbandonedMessage(key, 'Maria', 'https://link');
      expect(msg).toContain('Maria');
      expect(msg).toContain('https://link');
    }
  });

  it('lança erro para bucket desconhecido', () => {
    expect(() => buildAbandonedMessage('xx' as never, 'A', 'https://link')).toThrow();
  });
});

describe('normalizePhoneToE164', () => {
  it('prefixa 244 para número local de 9 dígitos que começa em 9', () => {
    expect(normalizePhoneToE164('929423278')).toBe('244929423278');
    expect(normalizePhoneToE164('+244 929 423 278')).toBe('244929423278');
    expect(normalizePhoneToE164('+244 923 456 789')).toBe('244923456789');
  });

  it('mantém número já em 244 com 12 dígitos', () => {
    expect(normalizePhoneToE164('244929423278')).toBe('244929423278');
    expect(normalizePhoneToE164('+244929423278')).toBe('244929423278');
  });

  it('devolve null para formatos inválidos', () => {
    expect(normalizePhoneToE164('')).toBeNull();
    expect(normalizePhoneToE164(null)).toBeNull();
    expect(normalizePhoneToE164(undefined)).toBeNull();
    expect(normalizePhoneToE164('123456789')).toBeNull();
    expect(normalizePhoneToE164('2441234')).toBeNull();
    expect(normalizePhoneToE164('abc')).toBeNull();
  });
});