import { sendWithRetry } from './transport';
import { safeStr } from './htmlUtils';

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
