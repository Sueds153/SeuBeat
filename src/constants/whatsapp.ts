const WHATSAPP_NUMBER = '244922058136';

export const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

export function getWhatsAppUrl(context?: string): string {
  if (!context) return WHATSAPP_URL;
  const messages: Record<string, string> = {
    erro_geracao: 'Preciso%20de%20ajuda%20-%20Erro%20ao%20gerar%20m%C3%BAsica',
    nao_encontrada: 'Preciso%20de%20ajuda%20-%20P%C3%A1gina%20n%C3%A3o%20encontrada',
    pagamento: 'Preciso%20de%20ajuda%20-%20Erro%20no%20pagamento',
    erro_fatal: 'Preciso%20de%20ajuda%20-%20Erro%20inesperado',
  };
  const text = messages[context] || 'Preciso%20de%20ajuda%20com%20o%20SeuBeat';
  return `${WHATSAPP_URL}?text=${text}`;
}
