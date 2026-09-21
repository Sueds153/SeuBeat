import { isConfigured, PHONE_NUMBER_ID, WHATSAPP_PHONE, DAILY_CAP, START_HOUR, END_HOUR } from './config';
import { getDailySentCount } from './sendLog';
import { getPhoneNumberVerificationStatus, type PhoneNumberVerification } from './verification';
import { listTemplates, enabledWhatsAppBuckets } from '../whatsappTemplates';

export async function getConfigStatus() {
  const sentToday = await getDailySentCount();
  const verification = await getPhoneNumberVerificationStatus().catch((): PhoneNumberVerification => ({ status: null }));
  return {
    configured: isConfigured(),
    phone: WHATSAPP_PHONE,
    phoneNumberId: isConfigured() ? PHONE_NUMBER_ID : null,
    dailyCap: DAILY_CAP,
    sentToday,
    startHour: START_HOUR,
    endHour: END_HOUR,
    templates: listTemplates(),
    enabledBuckets: enabledWhatsAppBuckets(),
    codeVerificationStatus: verification.status,
    verifiedName: verification.verifiedName || null,
    qualityRating: verification.qualityRating || null,
  };
}
