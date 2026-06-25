// Use global fetch
async function runTest() {
  console.log('🚀 A iniciar teste de criação de música...');
  
  const payload = {
    userNick: 'Sued',
    recipientName: 'Amélia',
    recipientRelation: 'parceira',
    occasion: 'saudade',
    musicStyle: 'kizomba',
    voiceType: 'masculina',
    desiredEmotion: 'amor',
    email: 'sued@seubeat.com',
    phone: '999999999',
    messageFromTheHeart: 'Conhecemo-nos em Luanda numa noite quente de verão, e desde então o meu coração é teu.'
  };

  try {
    const response = await fetch('http://localhost:3000/api/generate-lyrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ao gerar letras: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log('✅ Letras geradas com sucesso!');
    console.log('🎵 Título:', data.songTitle);
    console.log('🆔 ID do Pedido:', data.dbSongRequestId);
    console.log('🆔 ID da Música:', data.dbSongId);
    console.log('📝 Trecho:', data.lyricsSnippet);

    const songId = data.dbSongId;
    if (!songId) {
      console.log('⚠️ dbSongId em falta. A simulação/fallback pode ter sido acionada.');
      return;
    }

    console.log('\n⏳ A aguardar a geração da música no Mureka (polling)...');
    
    // Poll for status
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 10000)); // 10s delay

      const songRes = await fetch(`http://localhost:3000/api/song/${songId}`);
      if (!songRes.ok) {
        console.log(`❌ Erro ao consultar música: ${songRes.status}`);
        continue;
      }

      const songData = await songRes.json();
      const status = songData.data?.song_requests?.status;
      const murekaStatus = songData.data?.mureka_status;
      const previewUrl = songData.data?.preview_url;

      console.log(`⏱️ Tentativa ${i + 1}: Status do Pedido = ${status} | Status Mureka = ${murekaStatus}`);

      if (status === 'preview_ready') {
        console.log('\n🎉 SUCESSO! A música foi gerada e o preview de 30s está pronto!');
        console.log('🔗 URL de Preview:', previewUrl);
        break;
      }

      if (status === 'failed' || murekaStatus === 'failed') {
        console.log('❌ Geração de música falhou no servidor.');
        break;
      }
    }
  } catch (err) {
    console.error('❌ Erro no teste:', err.message);
  }
}

runTest();
