import { logError } from '../../utils/logger';
import { sendWithRetry } from './transport';
import { escapeHtml } from './htmlUtils';
import { getAdminEmail } from './config';

export async function sendAdminNotification(subject: string, message: string) {
  const adminEmails = getAdminEmail().split(',').map(e => e.trim()).filter(Boolean);
  for (const email of adminEmails) {
    await sendWithRetry(email, `[SeuBeat Admin] ${subject}`, `
      <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:600px;margin:0 auto">
        <h2 style="color:#ef4444">⚠️ Notificação do Sistema</h2>
        <pre style="background:#1c1917;color:#d6d3d1;padding:16px;border-radius:8px;font-size:13px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</pre>
      </div>
    `).catch(err => logError('[Email] Falha ao notificar admin', err instanceof Error ? err : new Error(String(err)), { email }));
  }
}
