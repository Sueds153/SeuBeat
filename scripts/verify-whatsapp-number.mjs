// Verificação do número WhatsApp (Cloud API) via Graph API.
// Uso:
//   node scripts/verify-whatsapp-number.mjs request [SMS|VOICE]   → envia o código (default VOICE)
//   node scripts/verify-whatsapp-number.mjs verify <6digitos>      → submete o código recebido
//   node scripts/verify-whatsapp-number.mjs status                 → estado code_verification_status
// Lê WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_GRAPH_API_VERSION do .env.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

const env = loadEnv(path.join(__dirname, '..', '.env'));
const token = env.WHATSAPP_API_TOKEN;
const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
const version = env.WHATSAPP_GRAPH_API_VERSION || 'v21.0';

if (!token || !phoneNumberId) {
  console.error('Faltam WHATSAPP_API_TOKEN ou WHATSAPP_PHONE_NUMBER_ID no .env');
  process.exit(1);
}

const [cmd, arg1] = process.argv.slice(2);

async function api(method, subpath, body) {
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/${subpath}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  switch (cmd) {
    case 'request': {
      const method = (arg1 || 'VOICE').toUpperCase();
      const result = await api('POST', 'request_code', { code_method: method, language: 'pt_PT' });
      if (result.ok) {
        console.log(`Código enviado via ${method} para +244 922 058 136. Espera e confirma o telemóvel.`);
      } else {
        const err = result.data?.error || {};
        console.error(
          `Falha (${result.status}) [${err.code}/${err.error_subcode ?? '-'}] ${err.error_user_msg || err.message}`
        );
        process.exit(1);
      }
      break;
    }
    case 'verify': {
      const code = (arg1 || '').replace(/\D/g, '');
      if (code.length !== 6) {
        console.error('Indica o código de 6 dígitos: node scripts/verify-whatsapp-number.mjs verify 123456');
        process.exit(1);
      }
      const result = await api('POST', 'verify_code', { code });
      if (result.ok) {
        console.log('Código submetido. Confirma com: node scripts/verify-whatsapp-number.mjs status');
      } else {
        const err = result.data?.error || {};
        console.error(`Falha (${result.status}) [${err.code}/${err.error_subcode ?? '-'}] ${err.error_user_msg || err.message}`);
        process.exit(1);
      }
      break;
    }
    case 'status': {
      const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}?fields=code_verification_status,display_phone_number,status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`Número ${data.display_phone_number}: code_verification_status=${data.code_verification_status}, status=${data.status}`);
      } else {
        console.error(`Falha (${res.status}): ${data.error?.message || 'erro'}`);
        process.exit(1);
      }
      break;
    }
    default:
      console.error('Uso: node scripts/verify-whatsapp-number.mjs (request [SMS|VOICE] | verify <6digitos> | status)');
      process.exit(1);
  }
}

main().catch((e) => {
  console.error('Erro inesperado:', e.message);
  process.exit(1);
});