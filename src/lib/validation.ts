import { z } from 'zod';

export const Step1Schema = z.object({
  recipientRelation: z.string().min(1, 'Selecione a relação'),
  recipientName: z.string().min(2, 'Mínimo 2 caracteres').max(100, 'Máximo 100 caracteres'),
  recipientGender: z.string().min(1, 'Selecione o género'),
});

const Step2Schema = z.object({
  occasion: z.string().min(1, 'Selecione a ocasião'),
});

const Step3Schema = z.object({
  musicStyle: z.string().min(1, 'Selecione o estilo'),
  voiceType: z.string().min(1, 'Selecione o tipo de voz'),
});

const Step4Schema = z.object({
  whatMakesSpecial: z.string()
    .trim()
    .min(3, 'Por favor, conta-nos uma recordação ou toca numa pílula abaixo.')
    .max(4000, 'Máximo 4000 caracteres'),
  whereItHappened: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
  messageFromTheHeart: z.string().max(4000, 'Máximo 4000 caracteres').optional(),
});

export const Step5Schema = z.object({
  photoUrl: z.string().optional(),
  language: z.string().optional(),
  email: z.string().email('Email inválido'),
  phone: z.string().regex(/^\+?[\d\s()-]{7,18}$/, 'Formato inválido (ex: +244 922 000 000)'),
});

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('9'))
    return `+244 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith('244'))
    return `+244 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  return value;
}

export type FieldErrors = Record<string, string>;

export function validateStep(step: number, data: Record<string, unknown>): FieldErrors {
  const schemas: Record<number, z.ZodTypeAny> = {
    1: Step1Schema,
    2: Step2Schema,
    3: Step3Schema,
    4: Step4Schema,
    5: Step5Schema,
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