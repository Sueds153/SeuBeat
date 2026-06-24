import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION SCHEMAS - Zod
// ─────────────────────────────────────────────────────────────────────────────

// Enums para tipagem
const RECIPIENT_RELATIONS = [
  'mãe', 'pai', 'avó', 'avô', 'filho', 'filha', 'irmã', 'irmão',
  'cônjuge', 'marido', 'esposa', 'namorada', 'namorado', 'parceira', 'parceiro',
  'melhor amiga', 'melhor amigo', 'amiga', 'amigo', 'colega', 'chefe', 'professor', 'professora',
  'pastor', 'pastora', 'mestre', 'outro'
] as const;

const OCCASIONS = [
  'aniversário', 'casamento', 'homenagem', 'memorial', 'saudade',
  'pedido de desculpas', 'declaração', 'formatura', 'promoção',
  'nova casa', 'nascimento', 'recuperação', 'despedida'
] as const;

const MUSIC_STYLES = [
  'kizomba', 'zouk', 'semba', 'bossa nova', 'mpb', 'samba',
  'funk', 'trap', 'rap', 'reggae', 'rock', 'pop', 'balada'
] as const;

const VOICE_TYPES = [
  'masculina', 'feminina', 'dueto', 'preferência do serviço'
] as const;

const EMOTIONS = [
  'emocionante', 'alegre', 'melancólico', 'romântico', 'inspirador',
  'nostálgico', 'energético', 'suave', 'solene'
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/generate-lyrics
// ─────────────────────────────────────────────────────────────────────────────

export const GenerateLyricsSchema = z.object({
  // Dados do cliente
  userNick: z.string().min(1, 'Nome requerido').max(50, 'Nome muito longo').trim(),
  email: z.string().email('Email inválido').toLowerCase().optional(),
  phone: z.string().regex(/^\d{9,15}$/, 'Telefone inválido').optional().nullable(),

  // Dados do destinatário
  recipientName: z.string().min(1, 'Nome do destinatário requerido').max(100).trim(),
  recipientRelation: z.enum(RECIPIENT_RELATIONS, {
    error: `Relação deve ser uma de: ${RECIPIENT_RELATIONS.join(', ')}`
  }),
  recipientNick: z.string().max(50).trim().optional(),

  // Ocasião e estilo
  occasion: z.enum(OCCASIONS, {
    error: `Ocasião deve ser uma de: ${OCCASIONS.join(', ')}`
  }),
  whyCreatedToday: z.string().max(500).trim().optional(),
  musicStyle: z.enum(MUSIC_STYLES, {
    error: `Estilo deve ser um de: ${MUSIC_STYLES.join(', ')}`
  }),
  referenceArtist: z.string().max(100).trim().optional(),
  voiceType: z.enum(VOICE_TYPES, {
    error: `Tipo de voz deve ser um de: ${VOICE_TYPES.join(', ')}`
  }),

  // Detalhes pessoais
  whatMakesSpecial: z.string().max(1000).trim().optional(),
  onlySheDoes: z.string().max(500).trim().optional(),
  unforgettableMemory: z.string().max(1000).trim().optional(),
  whereItHappened: z.string().max(500).trim().optional(),
  messageFromTheHeart: z.string().max(1000).trim().optional(),
  desiredEmotion: z.enum(EMOTIONS, {
    error: `Emoção deve ser uma de: ${EMOTIONS.join(', ')}`
  }),
  language: z.string().max(50).trim().default('Português de Angola/Portugal'),

  // Foto (base64)
  photoBase64: z.string().max(5 * 1024 * 1024, 'Foto muito grande (max 5MB)').optional().nullable(),
  photoFilename: z.string().max(255).trim().optional(),
  photoMimeType: z.enum(['image/jpeg', 'image/png', 'image/webp'] as const, {
    error: 'Formato de imagem inválido. Use JPG, PNG ou WebP.'
  }).optional()
});

export type GenerateLyricsInput = z.infer<typeof GenerateLyricsSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/send-email
// ─────────────────────────────────────────────────────────────────────────────

export const SendEmailSchema = z.object({
  email: z.string().email('Email inválido'),
  recipientName: z.string().max(100).optional(),
  personalizedUrl: z.string().url('URL inválida').optional(),
  letterText: z.string().max(5000).optional()
});

export type SendEmailInput = z.infer<typeof SendEmailSchema>;

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
