import { describe, it, expect } from 'vitest';
import { GenerateLyricsSchema, validateInput, validationErrorsArray } from '../middleware/validation';

describe('GenerateLyricsSchema', () => {
  const validData = {
    userNick: 'Rui',
    email: 'rui@exemplo.com',
    phone: '244900000000',
    recipientName: 'Marta',
    recipientGender: 'feminino',
    recipientRelation: 'esposa',
    recipientNick: 'Amor',
    occasion: 'aniversário',
    whyCreatedToday: 'É o aniversário dela e quero surpreendê-la',
    musicStyle: 'kizomba',
    referenceArtist: 'Anselmo Ralph',
    voiceType: 'masculina',
    whatMakesSpecial: 'Ela é incrível',
    onlySheDoes: 'Ela sorri de um jeito único',
    unforgettableMemory: 'A nossa viagem a Cabo Ledo',
    whereItHappened: 'Luanda',
    messageFromTheHeart: 'Nunca te esqueças o quanto te amo',
    desiredEmotion: 'amor',
    language: 'Português',
  };

  it('passes with minimal valid data', () => {
    const result = GenerateLyricsSchema.safeParse({
      userNick: 'Rui',
      phone: '244900000000',
      recipientName: 'Marta',
      recipientGender: 'feminino',
      recipientRelation: 'esposa',
      occasion: 'aniversário',
      musicStyle: 'kizomba',
      voiceType: 'masculina',
      desiredEmotion: 'amor',
    });
    expect(result.success).toBe(true);
  });

  it('passes with all valid fields', () => {
    const result = GenerateLyricsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('passes without userNick (optional)', () => {
    const { userNick, ...rest } = validData;
    const result = GenerateLyricsSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it('fails without recipientName', () => {
    const { recipientName, ...rest } = validData;
    const result = GenerateLyricsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fallbacks to default on invalid music style', () => {
    const result = GenerateLyricsSchema.parse({ ...validData, musicStyle: 'invalid' });
    expect(result.musicStyle).toBe('kizomba');
  });

  it('accepts all valid music styles', () => {
    const styles = ['kizomba', 'semba', 'afrobeat', 'gospel', 'acoustic', 'romantic pop', 'zouk', 'balada', 'pop', 'r&b', 'rap', 'funk', 'trap', 'reggae', 'samba', 'hino'];
    for (const style of styles) {
      const result = GenerateLyricsSchema.safeParse({ ...validData, musicStyle: style });
      expect(result.success).toBe(true);
    }
  });

  it('fallbacks to default on invalid voice type', () => {
    const result = GenerateLyricsSchema.parse({ ...validData, voiceType: 'alien' });
    expect(result.voiceType).toBe('sem preferência');
  });

  it('accepts all valid voice types', () => {
    const types = ['masculina', 'feminina', 'dueto', 'sem preferência'];
    for (const vt of types) {
      const result = GenerateLyricsSchema.safeParse({ ...validData, voiceType: vt });
      expect(result.success).toBe(true);
    }
  });

  it('accepts custom emotion string', () => {
    const result = GenerateLyricsSchema.parse({ ...validData, desiredEmotion: 'raiva' });
    expect(result.desiredEmotion).toBe('raiva');
  });

  it('fails without phone', () => {
    const { phone, ...rest } = validData;
    const result = GenerateLyricsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('defaults language to Português', () => {
    const result = GenerateLyricsSchema.parse(validData);
    expect(result.language).toBe('português');
  });

  it('rejects photo larger than 10MB', () => {
    const bigPhoto = 'a'.repeat(11 * 1024 * 1024);
    const result = GenerateLyricsSchema.safeParse({ ...validData, photoBase64: bigPhoto });
    expect(result.success).toBe(false);
  });

  it('rejects photo mime type longer than 50 chars', () => {
    const longMime = 'x'.repeat(60);
    const result = GenerateLyricsSchema.safeParse({ ...validData, photoMimeType: longMime });
    expect(result.success).toBe(false);
  });

  it('accepts valid photo mime types', () => {
    const types = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'];
    for (const mime of types) {
      const result = GenerateLyricsSchema.safeParse({ ...validData, photoMimeType: mime });
      expect(result.success).toBe(true);
    }
  });

  it('normalizes recipient relation to lowercase', () => {
    const result = GenerateLyricsSchema.parse({ ...validData, recipientRelation: 'Esposa' });
    expect(result.recipientRelation).toBe('esposa');
  });

  it('normalizes music style to lowercase', () => {
    const result = GenerateLyricsSchema.parse({ ...validData, musicStyle: 'Kizomba' });
    expect(result.musicStyle).toBe('kizomba');
  });
});

describe('validateInput', () => {
  it('returns success with valid data', () => {
    const result = validateInput(GenerateLyricsSchema, {
      userNick: 'Rui',
      phone: '244900000000',
      recipientName: 'Marta',
      recipientGender: 'feminino',
      recipientRelation: 'esposa',
      occasion: 'aniversário',
      musicStyle: 'kizomba',
      voiceType: 'masculina',
      desiredEmotion: 'amor',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userNick).toBe('Rui');
    }
  });

  it('returns errors with invalid data', () => {
    const result = validateInput(GenerateLyricsSchema, { userNick: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    }
  });

  it('handles ZodError gracefully', () => {
    const result = validateInput(GenerateLyricsSchema, null);
    expect(result.success).toBe(false);
  });
});

describe('validationErrorsArray', () => {
  it('returns an array of { field, message } from errors', () => {
    const result = validateInput(GenerateLyricsSchema, { userNick: 'x'.repeat(51), recipientName: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const list = validationErrorsArray(result.errors);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      for (const entry of list) {
        expect(typeof entry.field).toBe('string');
        expect(typeof entry.message).toBe('string');
        expect(entry.field.length).toBeGreaterThan(0);
        expect(entry.message.length).toBeGreaterThan(0);
      }
      const fields = list.map((e) => e.field);
      expect(fields).toContain('userNick');
      expect(fields).toContain('recipientName');
    }
  });

  it('returns empty array when errors is empty', () => {
    const list = validationErrorsArray({});
    expect(list).toEqual([]);
  });
});
