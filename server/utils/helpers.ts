export function publicErrorMessage(err: any, fallback = 'Não foi possível concluir esta etapa. Tente novamente em instantes.') {
  const message = err?.message || String(err || '');
  
  if (/ANTHROPIC_API_KEY/i.test(message)) {
    return 'A geração de letras está temporariamente indisponível (Erro de Configuração do Claude).';
  }
  if (/CLAUDE_MODEL/i.test(message)) {
    return 'A configuração do modelo de geração de letras está incorreta. Por favor, contacte o suporte.';
  }
  if (/SUNO_API_KEY/i.test(message)) {
    return 'A geração de música está temporariamente indisponível (Erro de Configuração Suno).';
  }
  if (/Supabase|database|DB|song_requests|songs|users/i.test(message)) {
    return 'Houve um erro ao guardar os seus dados. Por favor, verifique a sua ligação e tente novamente.';
  }
  if (/timeout|excedeu/i.test(message)) {
    return 'O sistema demorou demasiado tempo a responder. Talvez a nossa IA esteja com muito tráfego. Tente novamente.';
  }
  if (/malformada|JSON/i.test(message)) {
    return 'A IA gerou uma resposta incompleta. Por favor, tente novamente para obter uma letra perfeita.';
  }
  if (/quota|limit|429/i.test(message)) {
    return 'Atingimos o limite de gerações gratuitas por agora. Tente novamente daqui a uns minutos.';
  }
  
  return fallback;
}

export function getAudioFileInfo(audioUrl: string) {
  const cleanUrl = audioUrl.split('?')[0].toLowerCase();
  if (cleanUrl.endsWith('.wav')) return { ext: 'wav', mimeType: 'audio/wav' };
  if (cleanUrl.endsWith('.mp3')) return { ext: 'mp3', mimeType: 'audio/mpeg' };
  if (cleanUrl.endsWith('.m4a')) return { ext: 'm4a', mimeType: 'audio/mp4' };
  if (cleanUrl.endsWith('.ogg')) return { ext: 'ogg', mimeType: 'audio/ogg' };
  return { ext: 'flac', mimeType: 'audio/flac' };
}
