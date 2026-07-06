export function publicErrorMessage(err: any, fallback = 'Não foi possível concluir esta etapa. Tente novamente em instantes.') {
  const message = err?.message || String(err || '');
  
  if (/ANTHROPIC_API_KEY/i.test(message)) {
    return 'A geração de letras está temporariamente indisponível (Erro de Configuração do Claude).';
  }
  if (/OPENAI_API_KEY/i.test(message)) {
    return 'A geração de letras está temporariamente indisponível (Erro de Configuração do OpenAI).';
  }
  if (/Nenhuma chave de API de IA configurada/i.test(message)) {
    return 'A geração de letras está temporariamente indisponível (Nenhuma chave de IA configurada).';
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
  if (/timeout|excedeu|timed out|ETIMEDOUT/i.test(message)) {
    return 'O sistema demorou demasiado tempo a responder. Talvez a nossa IA esteja com muito tráfego. Tente novamente.';
  }
  if (/malformada|JSON|unexpected|malformed/i.test(message)) {
    return 'A IA gerou uma resposta incompleta. Por favor, tente novamente para obter uma letra perfeita.';
  }
  if (/quota|limit|429|rate limit|credit.*balance|too low|insufficient.*credit/i.test(message)) {
    return 'O saldo de créditos da API de geração de letras está esgotado. Contacte a equipa SeuBeat para recarregar.';
  }
  if (/401|403|authentication|unauthorized|api.key|invalid.*key/i.test(message)) {
    return 'A geração de letras está temporariamente indisponível (Erro de autenticação com serviço externo).';
  }
  if (/photos?.*bucket|storage.*bucket|not found|no such bucket/i.test(message)) {
    return 'Houve um erro ao guardar a foto. Contacte o suporte se o problema persistir.';
  }
  if (/demasiado grande|excede.*5MB/i.test(message)) {
    return 'A foto excede o limite de 5MB. Use um compressor de imagens online ou escolha uma foto menor.';
  }
  if (/carregar a foto/i.test(message)) {
    return 'Não foi possível carregar a foto. Tente com uma imagem diferente (JPG, PNG ou WebP).';
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
