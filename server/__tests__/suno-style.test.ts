import { describe, it, expect } from 'vitest';
import { buildSunoStylePrompt } from '../services/suno';

describe('buildSunoStylePrompt (P1 — timbre)', () => {
  it('coloca o token de voz/género PRIMEIRO (maior peso, não afogado pelo baseStyle)', () => {
    const { stylePrompt } = buildSunoStylePrompt('A tua beleza me enlouquece', 'kizomba', { voiceType: 'masculina' });
    expect(stylePrompt.startsWith('male vocal')).toBe(true);
  });

  it("'sem preferência' gera token de voz não-vazio (antes era '')", () => {
    const { stylePrompt } = buildSunoStylePrompt('Uma canção para ti', 'pop', { voiceType: 'sem preferência' });
    expect(stylePrompt.startsWith('expressive lead vocal')).toBe(true);
    expect(stylePrompt).not.toMatch(/^,\s/);
  });

  it('dueto usa token de dueto', () => {
    const { stylePrompt } = buildSunoStylePrompt('Nós dois', 'kizomba', { voiceType: 'dueto' });
    expect(stylePrompt.startsWith('male and female duet')).toBe(true);
  });

  it('o STYLE_MAP base não contém descritores de timbre vocal conflituosos', () => {
    const { stylePrompt } = buildSunoStylePrompt('Uma canção para ti', 'kizomba', { voiceType: 'feminina' });
    // descritores que competiam com o token de género (removidos do STYLE_MAP)
    expect(stylePrompt).not.toMatch(/intimate breathy vocal|powerful commanding vocal|breathy delivery/i);
    expect(stylePrompt.startsWith('female vocal')).toBe(true);
  });

  it('inclui sotaque Angolano quando a letra é portuguesa', () => {
    const { stylePrompt, accentApplied } = buildSunoStylePrompt('A tua beleza enlouquece-me à noite toda', 'kizomba', { voiceType: 'masculina' });
    expect(accentApplied).toBe(true);
    expect(stylePrompt).toContain('Angolan Portuguese vocal');
  });

  it('aplicação de sotaque respeita SUNO_ACCENT_ENABLED=false', () => {
    const prev = process.env.SUNO_ACCENT_ENABLED;
    process.env.SUNO_ACCENT_ENABLED = 'false';
    try {
      const { accentApplied } = buildSunoStylePrompt('A tua beleza', 'kizomba', { voiceType: 'masculina' });
      expect(accentApplied).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.SUNO_ACCENT_ENABLED;
      else process.env.SUNO_ACCENT_ENABLED = prev;
    }
  });

  it('sem voiceType não lança e mantém baseStyle', () => {
    const { stylePrompt } = buildSunoStylePrompt('Hello world song', 'trap');
    expect(stylePrompt).toContain('trap');
  });

  it('estilo desconhecido cai no fallback romântico', () => {
    const { stylePrompt } = buildSunoStylePrompt('Uma canção', 'estilo-inexistente', { voiceType: 'masculina' });
    expect(stylePrompt).toContain('romantic, emotional pop');
  });

  it('emoção e artista aparecem depois do token de voz', () => {
    const { stylePrompt } = buildSunoStylePrompt('A tua beleza enlouquece-me à noite toda', 'kizomba', {
      voiceType: 'masculina',
      desiredEmotion: 'amor',
      referenceArtist: 'Anselmo Ralph',
    });
    const voiceIdx = stylePrompt.indexOf('male vocal');
    const emotionIdx = stylePrompt.indexOf('romantic, intimate');
    const artistIdx = stylePrompt.indexOf('anselmo ralph style');
    expect(voiceIdx).toBe(0);
    expect(emotionIdx).toBeGreaterThan(voiceIdx);
    expect(artistIdx).toBeGreaterThan(emotionIdx);
  });

  it('letra não-portuguesa não recebe sotaque angolano', () => {
    const { stylePrompt, accentApplied } = buildSunoStylePrompt('Hello world English lyrics', 'pop', { voiceType: 'feminina' });
    expect(accentApplied).toBe(false);
    expect(stylePrompt).not.toContain('Angolan Portuguese vocal');
  });
});
