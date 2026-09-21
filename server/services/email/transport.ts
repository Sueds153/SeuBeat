import { logError } from '../../utils/logger';
import { getConfig, warnIfMissing } from './config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export async function sendViaBrevo(to: string, subject: string, htmlContent: string): Promise<Record<string, unknown>> {
  const cfg = getConfig();
  if (warnIfMissing(cfg)) return { mocked: true, to };

  const body = JSON.stringify({
    sender: { name: cfg.fromName, email: cfg.fromEmail },
    to: [{ email: to }],
    subject,
    htmlContent,
  });
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': cfg.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Brevo API error (${res.status}): ${errorBody}`);
  }

  return res.json();
}

export async function sendWithRetry(to: string, subject: string, htmlContent: string): Promise<Record<string, unknown>> {
  try {
    return await sendViaBrevo(to, subject, htmlContent);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errCode = err instanceof Error && 'code' in err ? (err as NodeJS.ErrnoException).code : undefined;
    const isTimeout = errCode === 'ETIMEDOUT' || errCode === 'UND_ERR_CONNECT_TIMEOUT' || errMsg.includes('timed out');
    if (isTimeout) {
      logError('[Email] Timeout na 1a tentativa, a tentar novamente...', err instanceof Error ? err : new Error(String(err)), { to });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return sendViaBrevo(to, subject, htmlContent);
    }
    logError('[Email] Falha ao enviar email', err instanceof Error ? err : new Error(errMsg), { to, subject });
    throw err;
  }
}
