// Mureka AI music generation and polling helper
export async function generateMurekaMusic(lyrics: string[], musicStyle: string, songTitle: string): Promise<{ taskId: string; audioUrl: string | null }> {
  const apiKey = process.env.MUREKA_API_KEY || '';
  if (!apiKey) throw new Error('MUREKA_API_KEY não configurada.');

  const lyricsText = lyrics.join('\n');

  // Map our music styles to Mureka style tags
  const styleMap: Record<string, string> = {
    'Kizomba': 'kizomba, romantic, slow, african, sensual',
    'Semba': 'semba, afro, traditional angolan, guitar',
    'Afrobeat': 'afrobeat, upbeat, african pop, energetic',
    'Gospel': 'gospel, choir, piano, inspirational, faith',
    'Acoustic': 'acoustic, guitar, intimate, emotional, ballad',
    'Romantic Pop': 'romantic pop, ballad, emotional, radio-friendly'
  };

  const stylePrompt = styleMap[musicStyle] || 'romantic, emotional, african pop';

  console.log('📡 Calling Mureka API to generate music...');

  // Submit generation job
  const generateRes = await fetch('https://api.mureka.ai/v1/song/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      prompt: `${songTitle}. Style: ${stylePrompt}. ${musicStyle} music.`,
      lyrics: lyricsText,
      title: songTitle,
      model: 'auto'
    })
  });

  if (!generateRes.ok) {
    const errText = await generateRes.text();
    throw new Error(`Mureka generation failed: ${generateRes.status} - ${errText}`);
  }

  const generateData = await generateRes.json();
  const taskId = generateData.id || generateData.task_id || generateData.data?.id;

  if (!taskId) {
    throw new Error(`Mureka did not return a task ID: ${JSON.stringify(generateData)}`);
  }

  console.log(`✅ Mureka task created: ${taskId}`);

  // Poll for completion (max 5 minutes, every 10 seconds)
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10s between polls

    const statusRes = await fetch(`https://api.mureka.ai/v1/song/query/${taskId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status = statusData.status || statusData.data?.status;
    const audioUrl = statusData.choices?.[0]?.flac_url ||
      statusData.choices?.[0]?.wav_url ||
      statusData.choices?.[0]?.url ||
      statusData.choices?.[0]?.audio_url ||
      statusData.flac_url || statusData.mp3_url || statusData.audio_url ||
      statusData.data?.flac_url || statusData.data?.mp3_url || statusData.data?.audio_url;

    console.log(`🎵 Mureka poll ${attempt + 1}: status=${status}`);

    if (status === 'succeeded' || status === 'complete' || status === 'completed') {
      return { taskId, audioUrl: audioUrl || null };
    }

    if (status === 'failed' || status === 'error') {
      throw new Error(`Mureka task failed: ${JSON.stringify(statusData)}`);
    }
  }

  // Return taskId even if polling timed out (can be resolved later by admin)
  return { taskId, audioUrl: null };
}
