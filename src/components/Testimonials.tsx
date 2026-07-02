import { Star, Quote, Heart } from 'lucide-react';
import { motion } from 'motion/react';

interface Testimonial {
  name: string;
  role: string;
  location: string;
  content: string;
  songCreated: string;
  photoColor: string;
  relation: string;
}

const TESTIMONIALS_DATA: Testimonial[] = [
  {
    name: "Rui dos Santos",
    role: "Marido Apaixonado",
    location: "Luanda",
    content: "Não sei cantar nem sei escrever poesia, mas queria muito dar algo pessoal à Cláudia no nosso aniversário de 10 anos. A música superou tudo o que sonhava. Quando começou a tocar e o cantor pronunciou o nome dela e a piada das nossas viagens à Mussulo, ela desabou em lágrimas. Foi indescritível!",
    songCreated: "Kizomba Romântica • Cláudia",
    photoColor: "from-amber-600 to-rose-700",
    relation: "Esposa"
  },
  {
    name: "Delfina Neto",
    role: "Filha Grata",
    location: "Lobito",
    content: "Criei um Semba lindo para o Aniversário da minha Mãe Maria. Ela ouve todos os dias ao acordar e já enviou a música a todas as amigas no grupo de WhatsApp lá da paróquia. Diz que foi o presente mais lindo de toda a vida dela. Podem fazer sem medo, vale cada kwanza!",
    songCreated: "Semba Tradicional • Mãe Maria",
    photoColor: "from-emerald-600 to-amber-700",
    relation: "Mãe"
  },
  {
    name: "Mateus Camilo",
    role: "Namorado Romântico",
    location: "Talatona",
    content: "Usei o plano de voz de estúdio personalizada para pedi-la em casamento. Gravei o meu tom lírico no telemóvel e as linhas vocais assumiram a minha própria assinatura num Pop acústico clássico. Ela sentiu toda a emoção e dedicação de estúdio real! Obviamente que ela disse SIM. Ganhei pontos para a vida toda.",
    songCreated: "Pop Acústico (Voz Customizada) • Irina",
    photoColor: "from-blue-600 to-rose-700",
    relation: "Pedido de Casamento"
  }
];

export default function Testimonials() {
  return (
    <div id="testimonials-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
      {TESTIMONIALS_DATA.map((t, idx) => (
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: idx * 0.15 }}
          className="bg-stone-900/35 border border-amber-900/10 hover:border-amber-900/35 rounded-2xl p-6 relative flex flex-col justify-between group transition-all duration-300 backdrop-blur-sm hover:translate-y-[-4px]"
        >
          {/* Custom quote icon background decoration */}
          <div className="absolute right-6 top-6 opacity-[0.03] text-amber-500 group-hover:opacity-[0.06] transition-opacity">
            <Quote className="w-20 h-20" />
          </div>

          <div className="space-y-4">
            {/* Rating Icons */}
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4.5 h-4.5 fill-amber-400 text-amber-400 shrink-0" />
              ))}
            </div>

            {/* Testimonial Quote */}
            <p className="text-stone-300 font-sans text-sm md:text-base leading-relaxed italic relative z-10">
              "{t.content}"
            </p>
          </div>

          {/* User Bio Footer */}
          <div className="mt-6 pt-5 border-t border-stone-800/60 flex items-center gap-4">
            {/* Avatar Placeholder with initials */}
            <div className={`w-11 h-11 rounded-full bg-gradient-to-tr ${t.photoColor} flex items-center justify-center text-white text-sm font-semibold shadow-inner`}>
              {t.name.split(' ').map(n => n[0]).join('')}
            </div>

            <div className="text-left">
              <h5 className="text-sm font-medium text-stone-100 font-serif">{t.name}</h5>
              <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5">
                <span>{t.role}</span>
                <span className="text-stone-600">•</span>
                <span>{t.location}</span>
              </div>
              
              {/* Connected Tag */}
              <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-rose-500/10 border border-rose-500/25 text-rose-300 rounded text-[10px] uppercase tracking-wider font-mono">
                <Heart className="w-2.5 h-2.5 fill-rose-300" />
                <span>Para {t.relation}</span>
              </div>
            </div>
          </div>

          {/* Small music tag */}
          <div className="absolute bottom-6 right-6 text-xxs font-mono text-amber-500 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 uppercase">
            {t.songCreated}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
