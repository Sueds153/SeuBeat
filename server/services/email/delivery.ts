import { getAppUrl } from '../../utils/helpers';
import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

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
