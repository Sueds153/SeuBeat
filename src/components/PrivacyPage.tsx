import { ArrowLeft, Shield, Eye, Database, Share2, Mail, Lock, Cookie, FileText, Users } from 'lucide-react';
import LogoIcon from './LogoIcon';

const LAST_UPDATE = '16 de Julho de 2026';

const sections = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: '1. Responsável pelo Tratamento',
    content: `O responsável pelo tratamento dos dados pessoais é a Su-Golden, com sede em Luanda, Angola. Para qualquer questão relacionada com privacidade e protecção de dados, contacte-nos através do email suporte@seubeat.ao.`
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: '2. Dados Recolhidos',
    content: `Podemos recolher os seguintes dados pessoais quando utiliza o SeuBeat:\n\n• Nome e/ou apelido do destinatário da música\n• Nome do remetente (quem encomenda a música)\n• Endereço de email\n• Número de telefone\n• Fotografia (opcional — enviada voluntariamente para personalização)\n• Amostra de voz (opcional — para clonagem de voz no plano Premium)\n• Comprovativo de pagamento (imagem ou PDF)\n• Dados de navegação: endereço IP, tipo de browser, páginas visitadas, tempo de sessão`
  },
  {
    icon: <Eye className="w-5 h-5" />,
    title: '3. Finalidades do Tratamento',
    content: `Os seus dados são utilizados exclusivamente para:\n\n(a) Criar e personalizar a letra da música com base nas informações fornecidas\n(b) Processar o pagamento via Multicaixa\n(c) Gerar a música através da API Suno\n(d) Entregar a música final por email e/ou página de dedicatória online\n(e) Clonagem de voz (quando aplicável e com consentimento explícito)\n(f) Comunicação sobre o estado do pedido (confirmação, aprovação, entrega)\n(g) Marketing e remarketing (apenas com consentimento — ver secção 7)\n(h) Melhoria do serviço e análise de erros`
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '4. Base Legal',
    content: `O tratamento dos seus dados baseia-se nas seguintes bases legais, nos termos da Lei Angolana 22/11 (Lei da Protecção de Dados Pessoais):\n\n• Consentimento do titular (art. 9.º): para dados facultativos como fotografia e amostra de voz\n• Execução de contrato (art. 10.º, al. a): para processar o pedido, pagamento e entrega da música\n• Interesse legítimo (art. 10.º, al. f): para melhoria do serviço e prevenção de fraudes`
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: '5. Partilha com Terceiros',
    content: `Para prestar o serviço, partilhamos dados com os seguintes subcontratantes:\n\n• Supabase (hospedagem de base de dados e armazenamento de ficheiros) — EUA\n• OpenAI (geração de letras via GPT-4o-mini) — EUA\n• Google / Gemini (geração de letras via Gemini 2.5 Flash) — EUA\n• Anthropic / Claude (geração de letras via Claude 3.5 Sonnet) — EUA\n• Suno Inc. (geração de música a partir de letras) — EUA\n• Brevo / Sendinblue (envio de emails transaccionais) — França\n• Meta Platforms / Facebook (Pixel e Conversions API para métricas) — EUA\n• Sentry (monitorização de erros) — EUA\n\nTodos os subcontratantes cumprem com legislação de protecção de dados equivalente e não utilizam os seus dados para finalidades próprias.`
  },
  {
    icon: <Lock className="w-5 h-5" />,
    title: '6. Armazenamento e Segurança',
    content: `Os seus dados são armazenados em servidores seguros da Supabase (Google Cloud). Implementamos as seguintes medidas de segurança:\n\n• Comunicação encriptada via HTTPS/TLS\n• Controlo de acesso baseado em funções (RLS) na base de dados\n• URLs de áudio com assinatura temporal (1 hora de validade)\n• Buckets de armazenamento privados para ficheiros sensíveis (comprovativos de pagamento, amostras de voz, áudio final)\n• Rate limiting para prevenir abusos\n• Os dados são armazenados apenas enquanto necessário para a execução do serviço e cumprimento de obrigações legais.`
  },
  {
    icon: <Cookie className="w-5 h-5" />,
    title: '7. Cookies e Pixel de Rastreio',
    content: `Utilizamos cookies essenciais para o funcionamento do site (sessão, segurança). Não utilizamos cookies de rastreio de terceiros para publicidade comportamental.\n\nUtilizamos o Meta Pixel (Facebook) exclusivamente para:\n• Medir conversões (quantas pessoas encomendam após verem um anúncio)\n• Optimizar campanhas de marketing\n• Criar públicos personalizados (apenas com dados anonimizados)\n\nO Pixel é carregado apenas após interacção do Utilizador com o site. Pode desactivar o rastreio do Facebook nas definições de privacidade da sua conta Facebook.`
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: '8. Direitos do Titular dos Dados',
    content: `Nos termos da Lei 22/11 (Lei da Protecção de Dados Pessoais), o titular dos dados tem os seguintes direitos:\n\n• Direito de acesso (art. 19.º): saber que dados tratamos e como\n• Direito de rectificação (art. 21.º): corrigir dados inexactos ou incompletos\n• Direito de eliminação (art. 22.º): solicitar a eliminação dos seus dados ("direito ao esquecimento")\n• Direito de oposição (art. 24.º): opor-se ao tratamento para fins de marketing\n• Direito de portabilidade (art. 27.º): receber os dados num formato estruturado\n\nPara exercer estes direitos, envie um email para suporte@seubeat.ao. Responderemos no prazo máximo de 30 dias.`
  },
  {
    icon: <Database className="w-5 h-5" />,
    title: '9. Período de Retenção',
    content: `Os dados são mantidos durante o período necessário à execução do serviço e cumprimento de obrigações legais:\n\n• Dados do pedido (nome, email, telefone, letra): 5 anos após a conclusão do pedido\n• Fotografia: até solicitação de eliminação ou 5 anos, o que ocorrer primeiro\n• Amostra de voz: até solicitação de eliminação ou 2 anos, o que ocorrer primeiro\n• Dados de navegação (logs): 6 meses\n• Comprovativos de pagamento: 5 anos (obrigação fiscal)\n\nApós o período de retenção, os dados são anonimizados ou eliminados de forma segura.`
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: '10. Cookies Técnicos',
    content: `O site SeuBeat utiliza cookies estritamente necessários para o funcionamento:\n\n• sessionStorage: armazena dados temporários do formulário (fotografia, progresso do pedido) durante a sessão do browser\n• localStorage: armazena preferências do Utilizador\n\nNão utilizamos cookies de publicidade comportamental. O Meta Pixel (Facebook) é carregado como script e não armazena cookies próprios no seu browser, sendo os eventos enviados directamente para a Meta através da Conversions API.`
  },
  {
    icon: <Mail className="w-5 h-5" />,
    title: '11. Comunicações',
    content: `O SeuBeat envia emails exclusivamente relacionados com o serviço contratado:\n\n• Confirmação do pedido\n• Notificação de aprovação/rejeição do pagamento\n• Link de entrega da música\n• Notificação de falha no processamento (com informação de reembolso)\n\nNão enviamos newsletters nem emails de marketing sem consentimento explícito. Pode opor-se a qualquer momento respondendo "remover" a qualquer email ou contactando suporte@seubeat.ao.`
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '12. Alterações a esta Política',
    content: `A presente Política de Privacidade pode ser actualizada periodicamente para reflectir alterações no serviço ou na legislação aplicável. A versão actualizada será publicada em seubeat.ao/privacy com indicação da data de actualização. O uso continuado do serviço após alterações constitui aceitação da política revista.`
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: '13. Contacto do Encarregado de Protecção de Dados',
    content: `Para exercer os seus direitos ou esclarecer dúvidas sobre o tratamento dos seus dados pessoais, contacte o nosso Encarregado de Protecção de Dados (Data Protection Officer):\n\nEmail: suporte@seubeat.ao\nWhatsApp: 922 058 136\nEndereço: Su-Golden, Luanda, Angola\n\nPode também apresentar uma reclamação à autoridade de protecção de dados competente em Angola.`
  }
];

export default function PrivacyPage({ onBackToLanding }: { onBackToLanding: () => void }) {
  return (
    <div className="bg-[#151210] min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-300">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-12">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-stone-400 hover:text-amber-400 transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span className="text-sm">Voltar ao início</span>
        </button>

        <div className="flex items-center gap-4 mb-8">
          <LogoIcon size={40} />
          <div>
            <span className="font-sans text-2xl font-black tracking-tight">
              <span className="text-stone-100">Seu</span><span className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">Beat</span>
            </span>
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">Política de Privacidade</p>
          </div>
        </div>

        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 md:p-10 mb-6">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Política de Privacidade</h1>
          <p className="text-stone-500 text-sm font-mono mb-6">Última actualização: {LAST_UPDATE}</p>

          <div className="prose prose-sm prose-invert max-w-none text-stone-400 space-y-8">
            <p className="text-stone-300 leading-relaxed">
              A <strong className="text-stone-100">Su-Golden</strong> valoriza a sua privacidade e está empenhada em proteger os
              seus dados pessoais. Esta Política de Privacidade explica como recolhemos, utilizamos, partilhamos e protegemos
              as suas informações quando utiliza o site <strong className="text-stone-100">seubeat.ao</strong> e os serviços do <strong className="text-stone-100">SeuBeat</strong>,
              em conformidade com a <strong className="text-stone-100">Lei Angolana 22/11 (Lei da Protecção de Dados Pessoais)</strong>.
            </p>

            {sections.map((section) => (
              <div key={section.title} className="border-b border-stone-800/50 pb-6 last:border-0 last:pb-0">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-amber-500 mt-0.5 shrink-0">{section.icon}</span>
                  <h2 className="text-stone-100 font-bold text-base">{section.title}</h2>
                </div>
                <p className="leading-relaxed text-sm whitespace-pre-line">{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-stone-600 text-xs font-mono">
          Su-Golden &copy; 2026 &middot; Luanda, Angola
        </div>
      </div>
    </div>
  );
}
