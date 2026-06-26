export interface DemoSong {
  id: string;
  title: string;
  style: string;
  occasion: string;
  recipient: string;
  lyrics: string[];
  duration: string;
  audioUrl: string;
}

export const DEMO_SONGS: DemoSong[] = [
  {
    id: 'kizomba-mae',
    title: 'Para a Lúcia',
    style: 'Kizomba',
    occasion: '60º Aniversário',
    recipient: 'Mãe (Lúcia)',
    duration: '4:30',
    audioUrl: '/assets/kizomba_lucia.mp3',
    lyrics: [
      "Lúcia, nos teus sessenta anos de luz,",
      "cada ruga é um mapa do amor que me conduziu.",
      "No kizomba lento que o teu coração tece,",
      "vejo a mulher mais forte que a vida me merece.",
      "Mãe, és o primeiro som que o meu mundo soube ouvir,",
      "o teu nome é a canção que me ensinaste a sorrir.",
      "Sessenta anos de graça, de força e de paz,",
      "és a minha rainha — ontem, hoje e sempre mais."
    ]
  },
  {
    id: 'semba-avo',
    title: 'Para o Avô Carlos',
    style: 'Semba',
    occasion: 'Memorial — 1 ano',
    recipient: 'Avô (Carlos)',
    duration: '3:45',
    audioUrl: '/assets/semba_carlos.mp3',
    lyrics: [
      "Um ano passou, mas o teu semba ainda toca,",
      "ressoa lá no quintal onde a família se convoca.",
      "Avô Carlos, a tua voz ainda aqui está,",
      "no cheiro do funje, no sorriso de quem ficou cá.",
      "A terra levou o teu corpo, mas não o teu calor,",
      "cada filho que dançou contigo guarda o teu amor.",
      "Hoje o semba é saudade, é choro, é memória viva —",
      "és presença eterna, Carlos, e a nossa alma revive."
    ]
  },
  {
    id: 'gospel-marido',
    title: 'Para o Paulo',
    style: 'Gospel',
    occasion: 'Declaração de Amor',
    recipient: 'Marido (Paulo)',
    duration: '4:35',
    audioUrl: '/assets/gospel_paulo.mp3',
    lyrics: [
      "Paulo, há um amor que Deus pôs no meu caminho,",
      "e esse amor tem o teu sorriso e o teu carinho.",
      "No evangelho que a vida nos escreveu juntos,",
      "cada capítulo confirma: somos um, não dois — mas juntos.",
      "Agradeço ao Senhor por me ter guiado até ti,",
      "és a oração respondida que sempre pedi.",
      "Paulo, meu marido, meu companheiro de fé,",
      "este amor que Deus abençoou — eterno ele é."
    ]
  }
];
