import { getAppUrl } from '../../utils/helpers';
import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

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
