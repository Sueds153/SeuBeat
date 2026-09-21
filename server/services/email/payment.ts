import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

export async function sendPaymentRejectionEmail(userEmail: string, notes?: string) {
  return sendWithRetry(userEmail, 'Verificação de comprovativo — SeuBeat', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">ℹ️ Comprovativo não validado</h2>
      <p>Não conseguimos validar o seu comprovativo de pagamento.</p>
      ${notes ? `<p>Motivo: <strong>${safeStr(notes)}</strong></p>` : ''}
      <p>Por favor, submeta novamente ou contacte-nos em suporte@seubeat.ao para assistência.</p>
    </div>
  `);
}
