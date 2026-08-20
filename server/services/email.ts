import { logWarn, logError } from '../utils/logger';
import { getAppUrl } from '../utils/helpers';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

function parseEmail(raw: string): { name: string; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
  if (match) {
    return { name: (match[1] || '').trim(), email: match[2] };
  }
  return { name: '', email: raw.trim() };
}

function getConfig() {
  const rawFrom = process.env.EMAIL_FROM || 'josuemiguelsued@gmail.com';
  const parsed = parseEmail(rawFrom);
  return {
    apiKey: process.env.BREVO_API_KEY || '',
    fromName: process.env.EMAIL_FROM_NAME || parsed.name || 'SeuBeat',
    fromEmail: parsed.email,
  };
}

function warnIfMissing(cfg: { apiKey: string }): boolean {
  if (!cfg.apiKey) {
    logWarn('BREVO_API_KEY não configurada. Simulando envio de email.');
    return true;
  }
  return false;
}

async function sendViaBrevo(to: string, subject: string, htmlContent: string): Promise<Record<string, unknown>> {
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

async function sendWithRetry(to: string, subject: string, htmlContent: string): Promise<Record<string, unknown>> {
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

export async function sendPersonalizedEmail(emailAddress: string, recipientName: string, personalizedUrl: string, letterText: string) {
  const safeRecipient = safeStr(recipientName);
  const safeLetter = safeStr(letterText);
  const letterSnippet = safeLetter.length > 280 ? safeLetter.substring(0, 280) + '…' : safeLetter;
  const referralUrl = `${personalizedUrl}&ref=${encodeURIComponent(safeRecipient.split(' ')[0] || 'amigo')}`;
  const waShareText = encodeURIComponent(`Fiz uma música personalizada para ${safeStr(recipientName)} no SeuBeat! 🎵 Experimenta tu também → ${getAppUrl()}`);

  return sendWithRetry(emailAddress, `🎵 A música para ${safeStr(recipientName.split(' ')[0] || 'si')} está pronta!`, `
    <!DOCTYPE html>
    <html lang="pt">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0b0a09;">
    <div style="font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0b0a09;color:#e7e5e4;max-width:600px;margin:0 auto;border-radius:20px;overflow:hidden;border:1px solid #292524;">

      <!-- Hero gradient header -->
      <div style="background:linear-gradient(135deg,#1c1410 0%,#2d1a0a 50%,#1a0f1e 100%);padding:48px 32px 40px;text-align:center;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#db2777,#a855f7);"></div>
        <div style="width:72px;height:72px;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="font-size:32px;">🎵</span>
        </div>
        <h1 style="font-family:Georgia,serif;color:#f59e0b;font-size:28px;margin:0 0 10px;font-weight:800;letter-spacing:-0.5px;">
          A sua música está pronta!
        </h1>
        <p style="font-size:15px;color:#d6d3d1;margin:0;line-height:1.6;max-width:420px;display:inline-block;">
          Criada exclusivamente para <strong style="color:#fbbf24;">${safeRecipient}</strong> com todo o carinho do mundo.
        </p>
      </div>

      <!-- Lyrics teaser card -->
      <div style="padding:32px 32px 0;">
        <div style="background:#1c1917;border:1px solid #44403c;border-radius:14px;padding:22px 24px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,#f59e0b,#db2777);border-radius:2px 0 0 2px;"></div>
          <span style="font-size:10px;font-family:monospace;color:#f59e0b;display:block;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;">✦ TRECHO DA DEDICATÓRIA</span>
          <p style="font-size:14px;font-style:italic;color:#d6d3d1;line-height:1.7;margin:0;">
            "${letterSnippet}"
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="padding:32px;text-align:center;">
        <a href="${personalizedUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:14px;box-shadow:0 6px 20px rgba(217,119,6,0.35);letter-spacing:0.3px;">
          🎧 Ouvir a Música Agora
        </a>
        <p style="font-size:12px;color:#78716c;margin:12px 0 0;">Toque no botão para aceder à sua dedicatória exclusiva</p>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#292524,transparent);margin:0 32px;"></div>

      <!-- Referral section -->
      <div style="padding:28px 32px;background:#111010;text-align:center;">
        <p style="font-size:13px;color:#a8a29e;margin:0 0 16px;line-height:1.6;">
          💬 <strong style="color:#e7e5e4;">Adorou o resultado?</strong> Partilhe a experiência com amigos — eles vão adorar criar a música deles também!
        </p>
        <a href="https://wa.me/?text=${waShareText}" target="_blank" style="display:inline-block;background:#16a34a;color:#fff;font-weight:700;font-size:13px;text-decoration:none;padding:11px 24px;border-radius:10px;margin-right:8px;">
          📲 Partilhar no WhatsApp
        </a>
        <a href="${getAppUrl()}" target="_blank" style="display:inline-block;background:#292524;color:#e7e5e4;font-weight:700;font-size:13px;text-decoration:none;padding:11px 24px;border-radius:10px;border:1px solid #44403c;">
          🎵 Criar Nova Música
        </a>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;text-align:center;border-top:1px solid #1c1917;">
        <p style="font-size:11px;color:#57534e;margin:0;line-height:1.8;">
          SeuBeat Estúdio Angola · Eternizando momentos com melodias inesquecíveis.<br>
          Precisa de ajuda? Responda a este email ou contacte-nos em suporte@seubeat.ao
        </p>
      </div>

    </div>
    </body>
    </html>
  `);
}

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

export async function sendConfirmationEmail(emailAddress: string, recipientName: string, requestId: string, context?: 'lyrics_created' | 'standard_approved') {
  const isSongReady = context === 'standard_approved';
  const heading = isSongReady ? 'Pagamento aprovado! ❤️' : 'Pedido Recebido! ❤️';
  const body = isSongReady
    ? `A sua música personalizada para <strong>${safeStr(recipientName)}</strong> já foi gerada com sucesso. Será entregue no seu email dentro de 24h após a confirmação do pagamento. Fique atento!`
    : `Recebemos o seu pedido de música personalizada para <strong>${safeStr(recipientName)}</strong>.`;
  const footer = isSongReady
    ? 'SeuBeat Estúdio Angola — A sua música será entregue em breve.'
    : 'A nossa equipa já está a trabalhar na sua canção. Receberá outro email assim que a música estiver pronta para ouvir e partilhar.';

  return sendWithRetry(emailAddress, isSongReady ? 'Pagamento aprovado — SeuBeat' : 'Pedido recebido — SeuBeat', `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0b0a09; color: #e7e5e4; padding: 40px 20px; text-align: center; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #292524;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 32px;">🎵</span>
      </div>
      <h1 style="font-family: serif; color: #f59e0b; font-size: 26px; margin-bottom: 12px; font-weight: 800;">
        ${heading}
      </h1>
      <p style="font-size: 15px; color: #d6d3d1; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        ${body}
      </p>
      <div style="background-color: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 24px;">
        <span style="font-size: 10px; font-family: monospace; color: #f59e0b; display: block; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">ID do Pedido</span>
        <p style="font-size: 13px; font-family: monospace; color: #a8a29e; line-height: 1.5; margin: 0;">
          ${safeStr(requestId)}
        </p>
      </div>
      <p style="font-size: 13px; color: #a8a29e; line-height: 1.6; max-width: 480px; margin: 0 auto 24px auto;">
        ${footer}
      </p>
      <p style="font-size: 12px; color: #78716c; margin-top: 32px; border-top: 1px solid #1c1917; padding-top: 20px;">
        SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.
      </p>
    </div>
  `);
}

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

function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'suporte@seubeat.ao';
}

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

export function abandonedTeaserHtml(recipientName: string, songTitle?: string, lyricsSnippet?: string): string {
  const snippet = (lyricsSnippet || '').trim();
  if (!snippet) return '';
  const firstName = (recipientName || '').trim().split(' ')[0];
  const nameSuffix = firstName ? ` para ${firstName}` : '';
  const title = (songTitle || '').trim();
  const label = safeStr(title ? `${title} — a letra que criaste${nameSuffix}` : `A letra que criaste${nameSuffix}`);
  return `
    <div style="background:#1c1917;border:1px solid #44403c;border-radius:12px;padding:16px 18px;margin:20px 0;">
      <span style="font-size:10px;font-family:monospace;color:#f59e0b;display:block;margin-bottom:8px;letter-spacing:1px;text-transform:uppercase;">${label}</span>
      <p style="font-size:14px;font-style:italic;color:#d6d3d1;line-height:1.6;margin:0;">"${safeStr(snippet)}…"</p>
    </div>
  `;
}

export async function sendAbandonedFirstReminder(userEmail: string, recipientName: string, requestId: string, songTitle?: string, lyricsSnippet?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'A música para ' + (safeStr(recipientName.split(' ')[0]) || 'si') + ' já está pronta 🎵', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">⏳</span></div>
      <h2 style="color:#f59e0b;text-align:center;">A sua música está quase pronta!</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>Recebemos o seu pedido e a letra já foi criada com todo o carinho. Falta apenas <strong>confirmar o seu plano</strong> para receber a música personalizada.</p>
      ${abandonedTeaserHtml(recipientName, songTitle, lyricsSnippet)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Continuar Pagamento
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">A letra fica guardada até amanhã — depois o acesso pode expirar.</p>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.</p>
    </div>
  `);
}

export async function sendAbandonedSecondReminder(userEmail: string, recipientName: string, requestId: string, songTitle?: string, lyricsSnippet?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'Ainda vai a tempo 🎶', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">🎶</span></div>
      <h2 style="color:#f59e0b;text-align:center;">Não deixe para depois o que pode emocionar hoje</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>Há uns dias começou a criar uma música personalizada para alguém especial. A letra já está pronta e à sua espera!</p>
      ${abandonedTeaserHtml(recipientName, songTitle, lyricsSnippet)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Finalizar Agora
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}

export async function sendAbandonedThirdReminder(userEmail: string, recipientName: string, requestId: string, songTitle?: string, lyricsSnippet?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'A sua letra expira em 48h ⏳', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">⏰</span></div>
      <h2 style="color:#ef4444;text-align:center;">Último aviso — a sua música está prestes a expirar</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>A sua música personalizada está pronta há mais de 48 horas. <strong>O sistema vai remover a letra gerada em breve.</strong></p>
      <p>Confirme o seu plano agora para não perder o trabalho feito.</p>
      ${abandonedTeaserHtml(recipientName, songTitle, lyricsSnippet)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Salvar a Minha Música Agora
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}

export async function sendAbandonedFourthReminder(userEmail: string, recipientName: string, requestId: string, songTitle?: string, lyricsSnippet?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'Última chance: a sua música será removida 🗑️', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">🗑️</span></div>
      <h2 style="color:#ef4444;text-align:center;">Esta é a última notificação</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>Já passaram 72 horas desde que a sua letra foi gerada. <strong>Se não confirmar o plano nas próximas horas, a música será eliminada do sistema.</strong></p>
      <p>Não perca a oportunidade de eternizar este momento.</p>
      ${abandonedTeaserHtml(recipientName, songTitle, lyricsSnippet)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Confirmar Agora — Última Chance
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}

export async function sendAbandonedFifthReminder(userEmail: string, recipientName: string, requestId: string, songTitle?: string, lyricsSnippet?: string) {
  const resumeUrl = `${getAppUrl()}/wizard?resume=${encodeURIComponent(requestId)}&step=payment`;
  return sendWithRetry(userEmail, 'A sua música ainda está à sua espera 🎵', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">🎵</span></div>
      <h2 style="color:#f59e0b;text-align:center;">Não deixe esta história ficar por contar</h2>
      <p>Olá${safeStr(recipientName) ? ' ' + safeStr(recipientName) : ''},</p>
      <p>Já passou uma semana e a sua música personalizada continua guardada à sua espera. Cada dia sem a enviar é um dia em que esse momento especial espera por ser eternizado.</p>
      <p>Ainda vai a tempo — a letra está pronta e basta confirmar o plano para receber a música completa.</p>
      ${abandonedTeaserHtml(recipientName, songTitle, lyricsSnippet)}
      <div style="text-align:center;margin:24px 0;">
        <a href="${resumeUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Finalizar a Minha Música
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola — Eternizando momentos com melodias inesquecíveis.</p>
    </div>
  `);
}

export async function sendFollowUp7d(userEmail: string, songUrl: string) {
  return sendWithRetry(userEmail, 'Como foi a reacção? 💝', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">💝</span></div>
      <h2 style="color:#f59e0b;text-align:center;">Já entregou a música? Conta-nos como foi!</h2>
      <p>Olá,</p>
      <p>Já passou uma semana desde que recebeu a sua música personalizada. <strong>Qual foi a reacção de quem a recebeu?</strong></p>
      <p>Adorávamos saber como correu — responda a este email e conte-nos a história!</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${songUrl || getAppUrl()}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Ver Música
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}

export async function sendFollowUp30d(userEmail: string, songUrl: string) {
  return sendWithRetry(userEmail, 'Lembra-se de fazer uma surpresa? 🎁', `
    <div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <div style="text-align:center;margin-bottom:24px;"><span style="font-size:32px;">🎁</span></div>
      <h2 style="color:#f59e0b;text-align:center;">Já pensou em fazer outra surpresa?</h2>
      <p>Olá,</p>
      <p>Já passou um mês desde que criou a sua última música no SeuBeat. <strong>Não há ocasião melhor do que agora para surpreender alguém especial.</strong></p>
      <p>Aniversários, declarações, bodas — cada momento merece uma canção única.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${getAppUrl()}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#d97706,#db2777);color:#fff;font-weight:bold;font-size:14px;text-decoration:none;padding:14px 32px;border-radius:12px;">
          Criar Nova Música
        </a>
      </div>
      <p style="color:#78716c;font-size:12px;text-align:center;">💡 Use o mesmo email para acelerar o processo — os seus dados já estão connosco.</p>
      <p style="color:#78716c;font-size:12px;text-align:center;margin-top:16px;">SeuBeat Estúdio Angola</p>
    </div>
  `);
}

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
