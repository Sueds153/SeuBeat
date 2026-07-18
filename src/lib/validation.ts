import { z } from 'zod';

export const Step1Schema = z.object({
  recipientRelation: z.string().min(1, 'Selecione a relação'),
  recipientName: z.string().min(2, 'Mínimo 2 caracteres'),
  recipientGender: z.string().min(1, 'Selecione o género'),
  userNick: z.string().min(2, 'Mínimo 2 caracteres'),
  recipientNick: z.string().min(2, 'Mínimo 2 caracteres'),
});

const Step2Schema = z.object({
  occasion: z.string().min(1, 'Selecione a ocasião'),
  whyCreatedToday: z.string().min(5, 'Mínimo 5 caracteres'),
});

const Step3Schema = z.object({
  musicStyle: z.string().min(1, 'Selecione o estilo'),
  referenceArtist: z.string().optional(),
});

const Step4Schema = z.object({
  voiceType: z.string().min(1, 'Selecione o tipo de voz'),
});

const Step5Schema = z.object({
  whatMakesSpecial: z.string().min(5, 'Mínimo 5 caracteres'),
  onlySheDoes: z.string().min(5, 'Mínimo 5 caracteres'),
});

const Step6Schema = z.object({
  unforgettableMemory: z.string().min(5, 'Mínimo 5 caracteres'),
  whereItHappened: z.string().min(1, 'Indique o local'),
});

const Step7Schema = z.object({
  messageFromTheHeart: z.string().min(5, 'Mínimo 5 caracteres'),
  desiredEmotion: z.string().min(1, 'Selecione a emoção'),
  hookPhrase: z.string().max(200, 'Máximo 200 caracteres').optional(),
});

const Step8Schema = z.object({
  photoUrl: z.string().optional(),
}).refine(data => data.photoUrl && data.photoUrl.length > 0, {
  message: 'Adicione uma foto',
  path: ['photoUrl'],
});
export const Step9Schema = z.object({
  email: z.string().email('Email inválido'),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, 'Formato inválido (ex: +244 922 000 000)'),
});

export type FieldErrors = Record<string, string>;

export function validateStep(step: number, data: Record<string, unknown>): FieldErrors {
  const schemas: Record<number, z.ZodTypeAny> = {
    1: Step1Schema,
    2: Step2Schema,
    3: Step3Schema,
    4: Step4Schema,
    5: Step5Schema,
    6: Step6Schema,
    7: Step7Schema,
    8: Step8Schema,
    9: Step9Schema,
  };

  const schema = schemas[step];
  if (!schema) return {};

  const result = schema.safeParse(data);
  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }
  return errors;
}
