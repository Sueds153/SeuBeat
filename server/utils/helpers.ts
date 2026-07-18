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
  if (/Supabase|database|DB|song_requests|songs|users|registrar.*banco.*dados|registar.*banco.*dados|banco de dados/i.test(message)) {
    return 'Houve um erro ao guardar os seus dados. Por favor, verifique a sua ligação e tente novamente.';
  }
  if (/timeout|excedeu|timed out|ETIMEDOUT|The operation was aborted|AbortError|TimeoutError/i.test(message)) {
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
  if (/demasiado grande|excede.*(5|10)MB/i.test(message)) {
    return 'A foto excede o tamanho máximo permitido (10MB). Use um compressor de imagens online ou escolha uma foto menor.';
  }
  if (/carregar a foto/i.test(message)) {
    return 'Não foi possível carregar a foto. Tente com uma imagem diferente (JPG, PNG ou WebP).';
  }
  if (/perfil|criar o seu|nao foi possivel preparar/i.test(message)) {
    return 'Não foi possível criar o seu perfil. O email informado já está registado. Tente com outro email ou contacte o suporte.';
  }
  if (/nao suportado/i.test(message)) {
    return 'Formato de imagem não suportado. Use JPG, PNG, WebP ou HEIC.';
  }
  if (/obrigatório|email é obrigatório/i.test(message)) {
    return 'O email é obrigatório para continuar. Verifique se o preencheu corretamente no passo final.';
  }
  if (/guarda-la|atualizar o estado/i.test(message)) {
    return 'A letra foi gerada mas ocorreu um erro ao salvar. Tente novamente — se o erro persistir, contacte o suporte.';
  }
  if (/fetch fail|ECONNREFUSED|ENETUNREACH|ENOTFOUND|ECONNRESET|network.*socket|Client network|connect.*fail/i.test(message)) {
    return 'O sistema não conseguiu contactar os servidores de IA. Verifique a sua ligação à internet e tente novamente.';
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

export function getAppUrl(req?: any): string {
  if (req) {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  return process.env.APP_URL || 'http://localhost:3000';
}
