import { Resend } from 'resend';

// Remetente dos emails — configurar RESEND_FROM no .env para personalizar
const RESEND_FROM = process.env.RESEND_FROM || 'SeuBeat <onboarding@resend.dev>';

export function sendPersonalizedEmail(emailAddress: string, recipientName: string, personalizedUrl: string, letterText: string) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) {
    console.warn("⚠️ RESEND_API_KEY is not defined. Simulating email dispatch to:", emailAddress);
    return { mocked: true, email: emailAddress };
  }

  const resend = new Resend(apiKey);
  
  const htmlContent = `
    <div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #0b0a09; color: #e7e5e4; padding: 40px 20px; text-align: center; border-radius: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #292524;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 32px;">💝</span>
      </div>
      <h1 style="font-family: serif; color: #f59e0b; font-size: 26px; margin-bottom: 12px; font-weight: 800;">
        A sua música está pronta ❤️
      </h1>
      <p style="font-size: 15px; color: #d6d3d1; line-height: 1.6; max-width: 480px; margin: 0 auto 30px auto;">
        Preparamos com todo o carinho do mundo uma canção e dedicatória de amor exclusiva para alegrar o coração de <strong>${recipientName}</strong>.
      </p>
      
      <div style="background-color: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; text-align: left; margin-bottom: 30px;">
        <span style="font-size: 10px; font-family: monospace; color: #f59e0b; display: block; margin-bottom: 8px; letter-spacing: 1px; text-transform: uppercase;">Trecho da Carta Dedicatória:</span>
        <p style="font-size: 13px; font-style: italic; color: #a8a29e; line-height: 1.5; margin: 0;">
          "${letterText.length > 140 ? letterText.substring(0, 140) + '...' : letterText}"
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

  return resend.emails.send({
    from: RESEND_FROM,
    to: emailAddress,
    subject: 'A sua música está pronta ❤️',
    html: htmlContent,
  });
}

export function sendPaymentNotificationEmail(adminEmail: string, clientEmail: string, plan: string, amount: string) {
  const apiKey = process.env.RESEND_API_KEY || '';
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  return resend.emails.send({
    from: RESEND_FROM,
    to: adminEmail,
    subject: '💳 Novo comprovativo de pagamento recebido!',
    html: `<div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">💳 Novo Pagamento Submetido!</h2>
      <p>O cliente <strong>${clientEmail}</strong> submeteu um comprovativo de pagamento.</p>
      <p>Plano: <strong>${plan}</strong> — Valor: <strong>${amount}</strong></p>
      <p>Acesse o painel de administração para verificar e aprovar.</p>
    </div>`
  });
}

export function sendPaymentRejectionEmail(userEmail: string, notes?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const resend = new Resend(apiKey);
  return resend.emails.send({
    from: RESEND_FROM,
    to: userEmail,
    subject: 'Verificação de comprovativo — SeuBeat',
    html: `<div style="font-family:sans-serif;background:#0b0a09;color:#e7e5e4;padding:32px;border-radius:16px;max-width:500px;margin:0 auto">
      <h2 style="color:#f59e0b">ℹ️ Comprovativo não validado</h2>
      <p>Não conseguimos validar o seu comprovativo de pagamento.</p>
      ${notes ? `<p>Motivo: <strong>${notes}</strong></p>` : ''}
      <p>Por favor, submeta novamente ou contacte-nos pelo WhatsApp para assistência.</p>
    </div>`
  });
}
