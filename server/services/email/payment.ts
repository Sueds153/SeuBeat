import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';
import { getAppUrl } from '../../utils/helpers';

export async function sendPaymentRejectionEmail(userEmail: string, notes?: string) {
  return sendWithRetry(userEmail, 'Verificação de comprovativo — SeuBeat', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">Comprovativo não validado</h2>
      <p>Não conseguimos validar o seu comprovativo de pagamento.</p>
      ${notes ? `<p>Motivo: <strong>${safeStr(notes)}</strong></p>` : ''}
      <p>Por favor, submeta novamente ou contacte-nos em suporte@seubeat.ao para assistência.</p>
    </div>
  `);
}

/**
 * Lembrete 24h depois de uma rejeição de comprovativo (abandonedRecoveryScheduler).
 * Taxa de rejeição é ~16% dos que pagam — este email devolve-os ao funil com CTA
 * direto para reenviar o comprovativo (a letra/plano continuam guardados).
 */
export async function sendRejectedReminderEmail(userEmail: string, recipientName: string, requestId: string, notes?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  const firstName = safeStr((recipientName || '').trim().split(' ')[0]);
  return sendWithRetry(userEmail, 'Podes enviar um novo comprovativo — SeuBeat', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-family:Georgia,serif;font-size:30px;line-height:1;color:#f59e0b;">♪</span></div>
      <h2 style="color:#f59e0b;text-align:center;">O pagamento pode ser reenviado</h2>
      <p>Olá${firstName ? ' ' + firstName : ''},</p>
      <p>O seu comprovativo de pagamento não foi validado automaticamente.</p>
      ${notes ? `<p>Motivo: <strong>${safeStr(notes)}</strong></p>` : ''}
      <p>Tudo bem — pode enviar um <strong>novo comprovativo em menos de 1 minuto</strong>. A letra e a música continuam guardadas à sua espera.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Enviar Novo Comprovativo
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">Se precisar de ajuda, responda a este email ou fale connosco em suporte@seubeat.ao.</p>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.</p>
    </div>
  `);
}
