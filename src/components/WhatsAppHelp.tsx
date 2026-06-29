import { MessageCircle } from 'lucide-react';
import { getWhatsAppUrl } from '../constants';

interface WhatsAppHelpProps {
  context?: 'erro_geracao' | 'nao_encontrada' | 'pagamento' | 'erro_fatal';
  label?: string;
}

export default function WhatsAppHelp({ context, label }: WhatsAppHelpProps) {
  const href = getWhatsAppUrl(context);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 bg-green-900/30 border border-green-800/50 rounded-full text-green-400 hover:bg-green-900/50 transition-colors text-xs font-semibold"
    >
      <MessageCircle className="w-4 h-4" />
      <span>{label || 'Ajuda via WhatsApp'}</span>
    </a>
  );
}
