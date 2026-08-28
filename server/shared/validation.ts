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
  userNick: z.string().max(50, 'Nome muito longo').trim().optional(),
  email: z.preprocess(
    v => v === '' ? undefined : v,
    z.string().email('Email inválido').toLowerCase().optional()
  ),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, 'Telefone inválido'),

  recipientName: z.string().min(1, 'Nome do destinatário requerido').max(100).trim(),
  recipientGender: z.preprocess(lower, z.enum(GENDERS).catch('feminino')),
  recipientRelation: z.preprocess(lower, z.enum(RECIPIENT_RELATIONS).catch('outro')),
  recipientNick: z.string().max(50).trim().optional(),

  occasion: z.preprocess(lower, z.enum(OCCASIONS).catch('declaração')),
  whyCreatedToday: z.string().max(500).trim().optional(),
  musicStyle: z.preprocess(lower, z.enum(MUSIC_STYLES).catch('kizomba')),
  referenceArtist: z.string().max(100).trim().optional(),
  voiceType: z.preprocess(lower, z.enum(VOICE_TYPES).catch('sem preferência')),

  whatMakesSpecial: z.string().max(4000).trim().optional(),
  onlySheDoes: z.string().max(1000).trim().optional(),
  unforgettableMemory: z.string().max(4000).trim().optional(),
  whereItHappened: z.string().max(1000).trim().optional(),
  messageFromTheHeart: z.string().max(4000).trim().optional(),
  hookPhrase: z.string().max(200).trim().optional(),
  desiredEmotion: z.preprocess(
    v => (!v || typeof v !== 'string' || v.trim() === '' ? undefined : v.toLowerCase()),
    z.string().max(50).optional()
  ),
  language: z.preprocess(
    v => (!v || typeof v !== 'string' || v.trim() === '' ? 'português' : v.toLowerCase()),
    z.string().max(50)
  ).default('português'),

  photoBase64: z.string().max(10 * 1024 * 1024, 'Foto muito grande (max 10MB)').optional().nullable(),
  photoFilename: z.string().max(255).trim().optional().nullable(),
  photoMimeType: z.string().max(50).trim().optional().nullable(),

  utm_source: z.string().max(500).trim().optional().nullable(),
  utm_medium: z.string().max(500).trim().optional().nullable(),
  utm_campaign: z.string().max(500).trim().optional().nullable(),
  utm_term: z.string().max(500).trim().optional().nullable(),
  utm_content: z.string().max(500).trim().optional().nullable(),
});

export type GenerateLyricsInput = z.infer<typeof GenerateLyricsSchema>;

const lyricsStringOrArray = z.union([
  z.string().min(10, 'A letra deve ter pelo menos 10 caracteres').max(5000, 'Letra muito longa').trim(),
  z.array(z.string()).min(1, 'A letra deve ter pelo menos uma linha').max(200, 'Letra muito longa'),
]);

export const UpdateLyricsSchema = z.object({
  lyrics: lyricsStringOrArray,
  lyrics_snippet: z.string().max(500).trim().optional(),
});

export type UpdateLyricsInput = z.infer<typeof UpdateLyricsSchema>;

export interface ValidationFieldError {
  field: string;
  message: string;
}

/**
 * Serializa os erros (Record<path, mensagem>) para um array [{field, message}],
 * que é o formato esperado pelo frontend (src/api/lyrics.ts).
 */
export function validationErrorsArray(errors: Record<string, string>): ValidationFieldError[] {
  return Object.entries(errors).map(([field, message]) => ({ field, message }));
}

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

export const SubmitPaymentSchema = z.object({
  songRequestId: z.string().min(1, 'ID do pedido requerido'),
  userEmail: z.string().email('Email inválido').toLowerCase(),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, 'Telefone inválido').optional(),
  plan: z.enum(['standard', 'express', 'premium']),
  amount: z.union([z.number(), z.string()]).transform(v => {
    if (typeof v === 'number') return v;
    // Parse Angolan format: "7.900 Kz", "7.900,00", "9900" etc.
    const cleaned = v.replace(/[^\d.,]/g, '');
    if (cleaned.includes(',')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    }
    return Number(cleaned.replace(/\./g, '')) || 0;
  }).refine(v => !isNaN(v) && v > 0, 'Montante inválido'),
  proofBase64: z.string().max(14 * 1024 * 1024, 'Comprovativo demasiado grande (max 10MB)').optional().nullable(),
  proofFilename: z.string().max(255).trim().optional().nullable(),
  proofMimeType: z.string().max(100).trim().optional().nullable(),
  voiceSampleBase64: z.string().max(5 * 1024 * 1024, 'Amostra de voz demasiado grande (max 5MB)').optional().nullable(),
  voiceSampleFilename: z.string().max(255).trim().optional().nullable(),
  voiceSampleMimeType: z.enum(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/x-wav', 'audio/webm']).optional().nullable(),
  voiceValidationTaskId: z.string().trim().optional().nullable(),
  voiceValidationPhrase: z.string().trim().optional().nullable(),
  paymentMethod: z.enum(['express', 'reference']).optional().nullable().default('reference'),
  eventIds: z.object({
    initiateCheckout: z.string().optional(),
    addPaymentInfo: z.string().optional(),
    submitApplication: z.string().optional(),
  }).optional().nullable(),
});

export type SubmitPaymentInput = z.infer<typeof SubmitPaymentSchema>;

export const VoiceValidationPhraseSchema = z.object({
  voiceSampleBase64: z.string().max(5 * 1024 * 1024, 'Amostra de voz demasiado grande (max 5MB)'),
  voiceSampleMimeType: z.enum(['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/x-wav', 'audio/webm']).optional().nullable().default('audio/wav'),
  language: z.string().optional().nullable().default('português'),
});

export type VoiceValidationPhraseInput = z.infer<typeof VoiceValidationPhraseSchema>;