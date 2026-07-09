import nodemailer from 'nodemailer';
import { logWarn, logError } from '../utils/logger';

function getConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'SeuBeat <noreply@seubeat.ao>',
  };
}

function createTransport() {
  const cfg = getConfig();
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: false,
    auth: { user: cfg.user, pass: cfg.pass },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
    connectionTimeout: 30000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

async function sendWithRetry(transporter: nodemailer.Transporter, mailOptions: nodemailer.SendMailOptions, emailAddress: string): Promise<any> {
  try {
    return await transporter.sendMail(mailOptions);
  } catch (err: any) {
    const isTimeout = err?.message?.includes('timeout') || err?.code === 'ETIMEDOUT' || err?.code === 'ESOCKET';
    if (isTimeout) {
      logError('[Email] Timeout na 1ª tentativa, a tentar novamente...', err, { email: emailAddress });
      await new Promise(resolve => setTimeout(resolve, 2000));
      return transporter.sendMail(mailOptions);
    }
    throw err;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeStr(val: string | undefined | null, fallback = ''): string {
  return escapeHtml(val || fallback);
}

function warnIfMissing(cfg: { user: string; pass: string }): boolean {
  if (!cfg.user || !cfg.pass) {
    logWarn('SMTP_USER/SMTP_PASS não configurados. Simulando envio de email.');
    return true;
  }
  return false;
}

export async function sendPersonalizedEmail(emailAddress: string, recipientName: string, personalizedUrl: string, letterText: string) {
  const cfg = getConfig();
  if (warnIfMissing(cfg)) return { mocked: true, email: emailAddress };

  const transporter = createTransport();

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0b0a09; color: #e7e5e4; padding: 40px 20px; text-align: center; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #292524;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 32px;">💝</span>
      </div>
      <h1 style="font-family: serif; color: #f59e0b; font-size: 26px; margin-bottom: 12px; font-weight: 800;">
        A sua música está pronta ❤️
      </h1>
      <p style="font-size: 15px; color: #d6d3d1; line-height: 1.6; max-width: 480px; margin: 0 auto 30px auto;">
        Preparamos com todo o carinho do mundo uma canção e dedicatória de amor exclusiva para alegrar o coração de <strong>${safeStr(recipientName)}</strong>.
      </p>
      
      <div style="background-color: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 30px;">
        <span style="font-size: 10px; font-family: monospace; color: #f59e0b; display: block; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Trecho da Carta Dedicatória:</span>
        <p style="font-size: 13px; font-style: italic; color: #a8a29e; line-height: 1.5; margin: 0;">
          "${safeStr(letterText).length > 140 ? safeStr(letterText).substring(0, 140) + '...' : safeStr(letterText)}"
        </p>
      </div>

      <div style="margin-bottom: 30px;">
        <a href="${personalizedUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #d97706 0%, #db2777 100%); color: #ffffff; font-weight: bold; font-size: 14px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(217, 119, 6, 0.25);">
          Ouvir Música
        </a>
      </div>

      <p style="font-size: 12px; color: #78716c; margin-top: 40px; border-t: 1px solid #1c1917; padding-top: 20px;">
        SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.
      </p>
    </div>
  `;

  return sendWithRetry(transporter, {
    from: cfg.from,
    to: emailAddress,
    subject: 'A sua música está pronta ❤️',
    html: htmlContent,
  }, emailAddress);
}

export async function sendPaymentRejectionEmail(userEmail: string, notes?: string) {
  const cfg = getConfig();
  if (warnIfMissing(cfg)) return;
  const transporter = createTransport();
  return sendWithRetry(transporter, {
    from: cfg.from,
    to: userEmail,
    subject: 'Verificação de comprovativo — SeuBeat',
    html: `<div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">ℹ️ Comprovativo não validado</h2>
      <p>Não conseguimos validar o seu comprovativo de pagamento.</p>
      ${notes ? `<p>Motivo: <strong>${safeStr(notes)}</strong></p>` : ''}
      <p>Por favor, submeta novamente ou contacte-nos em suporte@seubeat.ao para assistência.</p>
    </div>`
  });
}

export async function sendConfirmationEmail(emailAddress: string, recipientName: string, requestId: string) {
  const cfg = getConfig();
  if (warnIfMissing(cfg)) return { mocked: true, email: emailAddress };

  const transporter = createTransport();

  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0b0a09; color: #e7e5e4; padding: 40px 20px; text-align: center; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #292524;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 32px;">🎵</span>
      </div>
      <h1 style="font-family: serif; color: #f59e0b; font-size: 26px; margin-bottom: 12px; font-weight: 800;">
        Pedido Recebido! ❤️
      </h1>
      <p style="font-size: 15px; color: #d6d3d1; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        Olá! Recebemos o seu pedido de música personalizada para <strong>${safeStr(recipientName)}</strong>.
      </p>
      <div style="background-color: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px;">
        <span style="font-size: 10px; font-family: monospace; color: #f59e0b; display: block; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">ID do Pedido</span>
        <p style="font-size: 13px; font-family: monospace; color: #a8a29e; line-height: 1.5; margin: 0;">
          ${safeStr(requestId)}
        </p>
      </div>
      <p style="font-size: 13px; color: #a8a29e; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        A nossa equipa já está a trabalhar na sua canção. Receberá outro email assim que a música estiver pronta para ouvir e partilhar.
      </p>
      <p style="font-size: 12px; color: #78716c; margin-top: 32px; border-top: 1px solid #1c1917; padding-top: 20px;">
        SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.
      </p>
    </div>
  `;

  return sendWithRetry(transporter, {
    from: cfg.from,
    to: emailAddress,
    subject: 'Pedido recebido — SeuBeat',
    html: htmlContent,
  }, emailAddress);
}
