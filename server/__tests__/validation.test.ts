import { describe, it, expect } from 'vitest';
import { GenerateLyricsSchema, validateInput } from '../middleware/validation';

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

  it('fails without userNick', () => {
    const { userNick, ...rest } = validData;
    const result = GenerateLyricsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fails without recipientName', () => {
    const { recipientName, ...rest } = validData;
    const result = GenerateLyricsSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('fails with invalid music style', () => {
    const result = GenerateLyricsSchema.safeParse({ ...validData, musicStyle: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid music styles', () => {
    const styles = ['kizomba', 'semba', 'afrobeat', 'gospel', 'acoustic', 'romantic pop', 'zouk', 'balada', 'pop', 'r&b', 'rap', 'funk', 'trap', 'reggae', 'samba', 'hino'];
    for (const style of styles) {
      const result = GenerateLyricsSchema.safeParse({ ...validData, musicStyle: style });
      expect(result.success).toBe(true);
    }
  });

  it('fails with invalid voice type', () => {
    const result = GenerateLyricsSchema.safeParse({ ...validData, voiceType: 'alien' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid voice types', () => {
    const types = ['masculina', 'feminina', 'dueto', 'sem preferência'];
    for (const vt of types) {
      const result = GenerateLyricsSchema.safeParse({ ...validData, voiceType: vt });
      expect(result.success).toBe(true);
    }
  });

  it('fails with invalid emotion', () => {
    const result = GenerateLyricsSchema.safeParse({ ...validData, desiredEmotion: 'raiva' });
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

  it('rejects invalid photo mime type', () => {
    const result = GenerateLyricsSchema.safeParse({ ...validData, photoMimeType: 'image/gif' });
    expect(result.success).toBe(false);
  });

  it('accepts valid photo mime types', () => {
    const types = ['image/jpeg', 'image/png', 'image/webp'];
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
