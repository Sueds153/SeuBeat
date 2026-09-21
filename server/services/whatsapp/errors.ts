// ─── Tradução de erros da Cloud API para mensagens amigáveis ───

export function mapWhatsAppApiError(status: number, body: unknown): { code?: number; message: string } {
  const obj = (body && typeof body === 'object' ? body : null) as Record<string, any> | null;
  const error = obj?.error || null;
  const code: number | undefined = typeof error?.code === 'number' ? error.code : undefined;
  const apiMessage: string = typeof error?.message === 'string' ? error.message : '';
  const details: string =
    error?.error_data && typeof error.error_data?.details === 'string' ? error.error_data.details : '';

  if (status === 401 || status === 403) {
    return { code, message: 'Token da WhatsApp API inválido ou sem permissão. Verifica WHATSAPP_API_TOKEN.' };
  }
  switch (code) {
    case 131030:
      return { code, message: 'Número sem WhatsApp ativo.' };
    case 132000:
    case 132001:
    case 132012:
      return { code, message: `Template ainda não aprovado ou em revisão (${apiMessage}). Aprova-o na Meta Business.` };
    case 131047:
    case 131026:
      return { code, message: 'Parâmetros do template inválidos (nome/link).' };
    case 131042:
      return { code, message: 'Formato do número inválido.' };
    case 130429:
      return { code, message: 'Limite de pedidos da WhatsApp API excedido (rate limit).' };
    case 368:
      return { code, message: `Número bloqueado temporariamente (demasiados pedidos de verificação). Aguarda 24h ou contacta suporte Meta. [${apiMessage}]` };
    case 33:
      return { code, message: `Número não elegível para verificação nesta região. [${apiMessage}]` };
    case 100:
      return { code, message: `Parâmetro inválido na verificação. O número pode não suportar SMS/voz. [${apiMessage}]` };
    default:
      return { code, message: details || apiMessage || `Erro WhatsApp API (${status}).` };
  }
}
