export interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

export const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Quanto tempo demora para a música ficar pronta?',
    answer: 'O plano Standard entrega em até 24h após a confirmação do pagamento. O plano Express entrega imediatamente após a aprovação. O Premium (voz clonada) pode levar até 48h devido ao processo de clonagem de voz.',
    category: 'Tempo de entrega'
  },
  {
    question: 'Posso alterar a letra depois de ver o resultado?',
    answer: 'Sim! Após a geração da letra, você pode editar qualquer parte antes de confirmar o pagamento. Tem até 2 regenerações gratuitas se quiser uma versão completamente nova.',
    category: 'Personalização'
  },
  {
    question: 'E se não gostar do resultado final?',
    answer: 'Temos garantia de 100% satisfação. Se não ficar satisfeito, pode pedir reembolso total ou solicitar uma nova geração. A sua satisfação é a nossa prioridade.',
    category: 'Garantia'
  },
  {
    question: 'Como funciona o pagamento por referência Multicaixa?',
    answer: 'No ATM ou na app do seu banco, vá a "Pagamentos" → "Pagamento de Serviços". Digite a Entidade (10116) e a Referência que lhe damos. Confirme o valor e guarde o comprovativo.',
    category: 'Pagamento'
  },
  {
    question: 'O que é o Multicaixa Express e como uso?',
    answer: 'É mais rápido! Abre o Multicaixa Express no telemóvel, escolhe "Transferir", digita o número 929423278 e o valor. Confirma, faz printscreen do comprovativo e carrega no nosso site.',
    category: 'Pagamento'
  },
  {
    question: 'Posso pagar com cartão de crédito/débito?',
    answer: 'De momento, só aceitamos Multicaixa (Referência ou Express). Estamos a trabalhar para adicionar cartão brevemente.',
    category: 'Pagamento'
  },
  {
    question: 'A música é só minha? Posso usar como quiser?',
    answer: 'Sim! A música é 100% sua. Recebe o ficheiro MP3, a letra completa, a carta personalizada e a página de dedicatória online. Pode partilhar, guardar, oferecer como quiser.',
    category: 'Direitos'
  },
  {
    question: 'Como funciona a voz clonada (Premium)?',
    answer: 'Grava uma amostra de 20 segundos da tua voz. Depois geramos uma frase de validação para gravares (a cantar). A nossa IA clona o teu timbre e a música completa será cantada pela tua voz.',
    category: 'Voz Clonada'
  },
  {
    question: 'Os meus dados estão seguros?',
    answer: 'Sim. Usamos encriptação AES-256 para dados sensíveis. A voz é encriptada com segurança militar e apagada após a mistura final. Não partilhamos dados com terceiros.',
    category: 'Privacidade'
  },
  {
    question: 'Posso oferecer a música a alguém noutro país?',
    answer: 'Sim! A página de dedicatória funciona em qualquer país. A pessoa recebe o link por email/WhatsApp e pode ouvir online ou baixar o MP3.',
    category: 'Entrega'
  },
];

export const FAQ_CATEGORIES = [
  'Tempo de entrega',
  'Personalização',
  'Garantia',
  'Pagamento',
  'Direitos',
  'Voz Clonada',
  'Privacidade',
  'Entrega',
];