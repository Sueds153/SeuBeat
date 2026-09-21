import { getAppUrl } from '../../utils/helpers';
import { sendWithRetry } from './transport';

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
