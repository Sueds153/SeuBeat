import { z } from 'zod';

function lower(val: unknown) {
  return typeof val === 'string' ? val.toLowerCase() : val;
}

const RECIPIENT_RELATIONS = [
  'mãe', 'pai', 'avó', 'avô', 'filho', 'filha', 'irmã', 'irmão',
  'cônjuge', 'marido', 'esposa', 'namorada', 'namorado', 'parceira', 'parceiro',
  'melhor amiga', 'melhor amigo', 'amiga', 'amigo', 'colega', 'chefe', 'professor', 'professora',
  'pastor', 'pastora', 'mestre', 'outro',
  'ex-namorado', 'avó-avô', 'para-mim',
] as const;

const OCCASIONS = [
  'aniversário', 'casamento', 'homenagem', 'memorial', 'saudade',
  'pedido de desculpas', 'declaração', 'formatura', 'promoção',
  'nova casa', 'nascimento', 'recuperação', 'despedida',
  'aniversário de namoro', 'agradecimento', 'sem motivo',
] as const;

const MUSIC_STYLES = [
  'kizomba', 'semba', 'afrobeat', 'gospel', 'acoustic', 'romantic pop',
  'zouk', 'balada', 'pop', 'r&b', 'rap', 'funk', 'trap', 'reggae', 'samba', 'hino',
] as const;

const GENDERS = [
  'masculino', 'feminino',
] as const;

const VOICE_TYPES = [
  'masculina', 'feminina', 'dueto', 'sem preferência',
] as const;

const EMOTIONS = [
  'amor', 'emoção', 'gratidão', 'carinho', 'saudade', 'inspiração',
] as const;

const LANGUAGES = [
  'português', 'kimbundu', 'umbundu', 'inglês', 'kikongo', 'lingala',
] as const;

export const GenerateLyricsSchema = z.object({
  userNick: z.string().min(1, 'Nome requerido').max(50, 'Nome muito longo').trim(),
  email: z.preprocess(
    v => v === '' ? undefined : v,
    z.string().email('Email inválido').toLowerCase().optional()
  ),
  phone: z.preprocess(
    v => v === '' ? undefined : v,
    z.string().regex(/^\+?[\d\s()-]{7,18}$/, 'Telefone inválido').optional()
  ),

  recipientName: z.string().min(1, 'Nome do destinatário requerido').max(100).trim(),
  recipientGender: z.preprocess(lower, z.enum(GENDERS)),
  recipientRelation: z.preprocess(lower, z.enum(RECIPIENT_RELATIONS).catch('outro')),
  recipientNick: z.string().max(50).trim().optional(),

  occasion: z.preprocess(lower, z.enum(OCCASIONS)),
  whyCreatedToday: z.string().max(500).trim().optional(),
  musicStyle: z.preprocess(lower, z.enum(MUSIC_STYLES)),
  referenceArtist: z.string().max(100).trim().optional(),
  voiceType: z.preprocess(lower, z.enum(VOICE_TYPES)),

  whatMakesSpecial: z.string().max(1000).trim().optional(),
  onlySheDoes: z.string().max(500).trim().optional(),
  unforgettableMemory: z.string().max(1000).trim().optional(),
  whereItHappened: z.string().max(500).trim().optional(),
  messageFromTheHeart: z.string().max(1000).trim().optional(),
  hookPhrase: z.string().max(200).trim().optional(),
  desiredEmotion: z.preprocess(lower, z.enum(EMOTIONS)),
  language: z.preprocess(lower, z.enum(LANGUAGES)).default('português'),

  photoBase64: z.string().max(10 * 1024 * 1024, 'Foto muito grande (max 10MB)').optional().nullable(),
  photoFilename: z.string().max(255).trim().optional().nullable(),
  photoMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'] as const).optional().nullable(),
});

export type GenerateLyricsInput = z.infer<typeof GenerateLyricsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/song/:id/lyrics
// ─────────────────────────────────────────────────────────────────────────────

const lyricsStringOrArray = z.union([
  z.string().min(10, 'A letra deve ter pelo menos 10 caracteres').max(5000, 'Letra muito longa').trim(),
  z.array(z.string()).min(1, 'A letra deve ter pelo menos uma linha').max(200, 'Letra muito longa')
]);

export const UpdateLyricsSchema = z.object({
  lyrics: lyricsStringOrArray,
  lyrics_snippet: z.string().max(500).trim().optional(),
});

export type UpdateLyricsInput = z.infer<typeof UpdateLyricsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Função helper para validar
// ─────────────────────────────────────────────────────────────────────────────

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.issues.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: { general: 'Erro de validação desconhecido' } };
  }
}
