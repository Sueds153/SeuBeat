import { getAppUrl } from '../../utils/helpers';
import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

export async function sendLyricsRecoveredEmail(userEmail: string, recipientName: string, requestId: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'A sua música já está pronta! Conclua o seu plano 🎵', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">🎉</span></div>
      <h2 style="color:#f59e0b;text-align:center;">A sua música já está pronta!</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>Pedimos desculpa pela demora — houve um problema temporário ao gerar a sua canção, mas <strong>a letra já foi criada com todo o carinho</strong>.</p>
      <p>Falta apenas <strong>confirmar o seu plano</strong> para receber a música personalizada completa.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Continuar Pagamento
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">Precisa de ajuda? Contacte-nos em suporte@seubeat.ao</p>
      <p style="color:#78716c;font-size:12px;text-align:center;margin-top:8px;">SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.</p>
    </div>
  `);
}
