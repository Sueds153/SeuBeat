import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

export async function sendWorkflowFailedEmail(userEmail: string, recipientName: string) {
  return sendWithRetry(userEmail, 'A sua música está em pausa — SeuBeat', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">ℹ️ A sua música está em pausa</h2>
      <p>Olá ${safeStr(recipientName || 'Cliente')},</p>
      <p>Ocorreu um erro inesperado ao gerar a sua música. A nossa equipa já foi notificada e estamos a trabalhar para resolver o mais rápido possível.</p>
      <p>Não se preocupe — o seu pagamento será revertido e não será cobrado. Entraremos em contacto por este email em breve.</p>
      <p style="color:#78716c;font-size:12px;margin-top:24px;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}
