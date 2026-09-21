import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

export async function sendVideoUpsellOfferEmail(userEmail: string, recipientName: string, songTitle: string, upsellUrl: string) {
  const safeName = safeStr(recipientName || 'Cliente');
  const safeTitle = safeStr(songTitle || 'a tua música');

  return sendWithRetry(userEmail, `🎬 Transforma "${safeTitle}" num Videoclipe Emocional — SeuBeat`, `
    <!DOCTYPE html>
    <html lang="pt">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0b0a09;">
    <div style="font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0b0a09;color:#e7e5e4;max-width:600px;margin:0 auto;border-radius:20px;overflow:hidden;border:1px solid #292524;">

      <!-- Hero -->
      <div style="background:linear-gradient(135deg,#1c1410 0%,#2d1a0a 50%,#1a0f1e 100%);padding:48px 32px 40px;text-align:center;position:relative;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#f59e0b,#db2777,#a855f7);"></div>
        <div style="width:72px;height:72px;background:rgba(245,158,11,0.12);border:2px solid rgba(245,158,11,0.3);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;">
          <span style="font-size:32px;">🎬</span>
        </div>
        <h1 style="font-family:Georgia,serif;color:#f59e0b;font-size:26px;margin:0 0 10px;font-weight:800;letter-spacing:-0.5px;">
          Transforma a tua música num Videoclipe
        </h1>
        <p style="font-size:15px;color:#d6d3d1;margin:0;line-height:1.6;max-width:420px;display:inline-block;">
          <strong style="color:#fbbf24;">${safeTitle}</strong> pode ganhar vida com fotos e vídeos pessoais.
        </p>
      </div>

      <!-- Offer card -->
      <div style="padding:32px 32px 0;">
        <div style="background:#1c1917;border:1px solid #44403c;border-radius:14px;padding:22px 24px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:0;left:0;width:4px;height:100%;background:linear-gradient(180deg,#db2777,#a855f7);border-radius:2px 0 0 2px;"></div>
          <span style="font-size:10px;font-family:monospace;color:#db2777;display:block;margin-bottom:10px;letter-spacing:2px;text-transform:uppercase;">✦ OFERTA EXCLUSIVA</span>
          <p style="font-size:14px;color:#d6d3d1;line-height:1.7;margin:0;">
            Olá ${safeName}! A tua música <strong>"${safeTitle}"</strong> está pronta.
            Queres transformá-la num <strong>Videoclipe Emocional</strong> com as tuas fotos e vídeos pessoais por apenas <strong style="color:#fbbf24;">2.900 Kz</strong>?
          </p>
          <p style="font-size:13px;color:#a8a29e;margin:12px 0 0;line-height:1.6;">
            🎻 Música + 📸 Fotos/Vídeos = 💖 Um presente inesquecível
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="padding:32px;text-align:center;">
        <a href="${upsellUrl}" target="_blank" style="display:inline-block;background:linear-gradient(135deg,#db2777,#a855f7);color:#fff;font-weight:800;font-size:15px;text-decoration:none;padding:16px 40px;border-radius:14px;box-shadow:0 6px 20px rgba(219,39,119,0.35);letter-spacing:0.3px;">
          🎬 Quero o Videoclipe — 2.900 Kz
        </a>
        <p style="font-size:12px;color:#78716c;margin:12px 0 0;">Pagamento seguro via Multicaixa Express ou Referência</p>
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
