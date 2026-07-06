/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RecipientType =
  | 'Mãe'
  | 'Pai'
  | 'Esposa'
  | 'Marido'
  | 'Namorado'
  | 'Ex-namorado'
  | 'Filho'
  | 'Irmão'
  | 'Amigo'
  | 'Avó-Avô'
  | 'Professor'
  | 'Pastor'
  | 'Colega'
  | 'Para-mim'
  | 'Outro';

export type OccasionType =
  | 'Aniversário'
  | 'Aniversário de namoro'
  | 'Casamento'
  | 'Declaração de amor'
  | 'Agradecimento'
  | 'Homenagem'
  | 'Pedido de desculpas'
  | 'Saudade'
  | 'Sem motivo';

export type MusicStyleType =
  | 'Kizomba'
  | 'Semba'
  | 'Afrobeat'
  | 'Gospel'
  | 'Acoustic'
  | 'Romantic Pop'
  | 'Zouk'
  | 'Balada'
  | 'Pop'
  | 'R&B'
  | 'Rap'
  | 'Funk'
  | 'Trap'
  | 'Reggae'
  | 'Samba'
  | 'Hino';

export type VoiceType =
  | 'Masculina'
  | 'Feminina'
  | 'Dueto'
  | 'Sem preferência';

export type EmotionType =
  | 'Amor'
  | 'Emoção'
  | 'Gratidão'
  | 'Carinho'
  | 'Saudade'
  | 'Inspiração';

export interface WizardData {
  recipientRelation: RecipientType | '';
  recipientName: string;
  userNick: string;
  recipientNick: string;

  occasion: OccasionType | '';
  whyCreatedToday: string;

  musicStyle: MusicStyleType | '';
  referenceArtist: string;

  voiceType: VoiceType | '';

  whatMakesSpecial: string;
  onlySheDoes: string;

  unforgettableMemory: string;
  whereItHappened: string;

  messageFromTheHeart: string;
  desiredEmotion: EmotionType | '';

  photoFile?: File | null;
  photoUrl?: string;

  email: string;
  phone: string;
  language: string;
}

export const INITIAL_WIZARD_DATA: WizardData = {
  recipientRelation: '',
  recipientName: '',
  userNick: '',
  recipientNick: '',

  occasion: '',
  whyCreatedToday: '',

  musicStyle: '',
  referenceArtist: '',

  voiceType: '',

  whatMakesSpecial: '',
  onlySheDoes: '',

  unforgettableMemory: '',
  whereItHappened: '',

  messageFromTheHeart: '',
  desiredEmotion: '',

  photoFile: null,
  photoUrl: '',

  email: '',
  phone: '',
  language: 'Português',
};
