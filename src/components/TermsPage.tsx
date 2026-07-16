import { ArrowLeft, Shield, Scale, FileText, HelpCircle, AlertTriangle } from 'lucide-react';
import LogoIcon from './LogoIcon';

const LAST_UPDATE = '16 de Julho de 2026';

const sections = [
  {
    icon: <Shield className="w-5 h-5" />,
    title: '1. Definições e Identificação',
    content: `"SeuBeat" é o serviço digital de criação de canções personalizadas, operado pela Su-Golden, com sede em Luanda, Angola. "Utilizador" é qualquer pessoa que aceda ou utilize o site seubeat.ao e seus subdomínios. "Cliente" é o Utilizador que contrata um plano pago. "Rede Social" inclui WhatsApp, Facebook, Instagram e Messenger.`
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '2. Objecto',
    content: `O SeuBeat permite a criação de letras de música personalizadas com recurso a inteligência artificial, produção de áudio via API Suno, clonagem de voz (quando aplicável) e entrega do resultado final ao Cliente por email e/ou página de dedicatória online, mediante a escolha de um plano (Standard, Express ou Premium).`
  },
  {
    icon: <HelpCircle className="w-5 h-5" />,
    title: '3. Elegibilidade',
    content: `O serviço destina-se a maiores de 18 anos. Menores de 18 anos devem obter autorização de um dos pais ou tutor legal antes de utilizar o serviço. Ao utilizar o SeuBeat, o Utilizador declara cumprir este requisito.`
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '4. Criação de Conta e Dados',
    content: `O Cliente fornece voluntariamente o seu nome, email, telefone e, opcionalmente, uma fotografia e amostra de voz. Estes dados são necessários para a execução do serviço contratado. O Cliente garante que os dados fornecidos são verdadeiros, exactos e actualizados. O SeuBeat não se responsabiliza por erros decorrentes de dados incorrectos.`
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: '5. Planos, Preços e Pagamentos',
    content: `Os planos disponíveis e respectivos preços são os publicados no site em Kwanza (Kz). O pagamento é processado via Multicaixa (entidade e referência). O comprovativo de pagamento deve ser enviado através do formulário indicado no final do processo de criação. A aprovação do pagamento é manual e pode demorar até 24 horas úteis. Uma vez aprovado, o processamento da música inicia-se conforme o plano contratado.`
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: '6. Cancelamento e Reembolso',
    content: `O Cliente pode solicitar cancelamento até ao momento da aprovação do pagamento com reembolso integral. Após a aprovação do pagamento e início do processamento da música (geração via Suno), não haverá lugar a reembolso, salvo em caso de impossibilidade técnica comprovada de entrega da música no prazo estabelecido. Se o workflow de geração falhar após a aprovação, o pagamento será revertido automaticamente para o estado "falhou" e o Cliente será notificado por email.`
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: '7. Propriedade Intelectual',
    content: `As letras geradas pela inteligência artificial são propriedade do Cliente, que as pode utilizar livremente para fins pessoais e não-comerciais. A gravação de áudio (música) é licenciada para uso pessoal e não-comercial, não podendo ser republicada, distribuída ou comercializada sem autorização expressa da Su-Golden. O logótipo, marca "SeuBeat" e todo o código do site são propriedade exclusiva da Su-Golden.`
  },
  {
    icon: <Shield className="w-5 h-5" />,
    title: '8. Obrigações do Utilizador',
    content: `O Utilizador compromete-se a: (a) não utilizar o serviço para fins ilegais ou não autorizados; (b) não fornecer conteúdo difamatório, obsceno ou que viole direitos de terceiros; (c) não tentar adulterar, explorar vulnerabilidades ou interferir com o funcionamento do site; (d) não utilizar bots, scrapers ou outros meios automatizados para aceder ao serviço.`
  },
  {
    icon: <AlertTriangle className="w-5 h-5" />,
    title: '9. Limitação de Responsabilidade',
    content: `O SeuBeat utiliza serviços de terceiros (OpenAI, Google Gemini, Anthropic Claude, Suno API) para gerar letras e música. A Su-Golden não se responsabiliza por: (a) conteúdo gerado pela IA que possa ser considerado ofensivo ou inadequado, não obstante os filtros aplicados; (b) indisponibilidade temporária dos serviços de terceiros; (c) danos indirectos ou lucros cessantes decorrentes do uso do serviço. O serviço é fornecido "como está", sem garantias de disponibilidade ininterrupta.`
  },
  {
    icon: <HelpCircle className="w-5 h-5" />,
    title: '10. Prazo de Entrega',
    content: `Plano Standard: entrega até 24 horas após aprovação do pagamento. Plano Express: entrega até 12 horas após aprovação. Plano Premium: entrega até 6 horas após aprovação. Estes prazos são estimados e podem variar em função da disponibilidade dos serviços de terceiros (Suno, AI providers). Em caso de atraso superior ao dobro do prazo estimado, o Cliente pode solicitar reembolso integral.`
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: '11. Vigência e Alterações',
    content: `Estes Termos de Uso entram em vigor na data da sua publicação. A Su-Golden reserva-se o direito de alterar estes Termos a qualquer momento, com a versão actualizada disponível em seubeat.ao/terms. O uso continuado do serviço após alterações constitui aceitação das mesmas.`
  },
  {
    icon: <Scale className="w-5 h-5" />,
    title: '12. Lei Aplicável e Foro',
    content: `Estes Termos regem-se pela lei angolana. Qualquer litígio decorrente do uso do serviço será resolvido no foro da Comarca de Luanda, com expressa renúncia a qualquer outro.`
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: '13. Contacto',
    content: `Para questões relacionadas com estes Termos de Uso, contacte-nos através do email suporte@seubeat.ao ou WhatsApp 922 058 136. Su-Golden, Luanda, Angola.`
  }
];

export default function TermsPage({ onBackToLanding }: { onBackToLanding: () => void }) {
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
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">Termos de Uso</p>
          </div>
        </div>

        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 md:p-10 mb-6">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">Termos de Uso</h1>
          <p className="text-stone-500 text-sm font-mono mb-6">Última actualização: {LAST_UPDATE}</p>

          <div className="prose prose-sm prose-invert max-w-none text-stone-400 space-y-8">
            <p className="text-stone-300 leading-relaxed">
              Ao aceder ou utilizar o site <strong className="text-stone-100">seubeat.ao</strong> e os serviços nele oferecidos,
              o Utilizador declara ter lido, compreendido e aceite os presentes Termos de Uso, que vinculam a relação
              entre o Utilizador/Cliente e a <strong className="text-stone-100">Su-Golden</strong>.
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
