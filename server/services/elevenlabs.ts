// ElevenLabs Voice Cloning helper
export async function cloneElevenLabsVoice(name: string, audioBuffer: Buffer, mimeType: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY não configurada.');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('description', 'SeuBeat Cloned Voice Sample');
  
  const blob = new Blob([audioBuffer as any], { type: mimeType });
  formData.append('files', blob, 'sample.wav');

  const res = await fetch('https://api.elevenlabs.io/v1/voices/add', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey
    },
    body: formData
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Voice cloning failed: ${res.status} - ${errText}`);
  }

  const data = await res.json();
  return data.voice_id;
}

// ElevenLabs TTS helper com Voice ID dinâmico
export async function generateElevenLabsSpeechWithVoiceId(text: string, voiceId: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY não configurada.');

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TTS synthesis with Voice ID failed: ${res.status} - ${errText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ElevenLabs (voice cloning fallback)
export async function generateElevenLabsSpeech(text: string, voiceType: string, useClonedVoice: boolean) {
  const apiKey = process.env.ELEVENLABS_API_KEY || '';
  
  let voiceId = 'pNInz6obpgq9S3J7mSdh'; // Default: Adam (Male)
  if (voiceType.toLowerCase().includes('feminina')) {
    voiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella (Female)
  } else if (voiceType.toLowerCase().includes('dueto') || voiceType.toLowerCase().includes('preferência')) {
    voiceId = 'ErXwobaYiN019PkySvjV'; // Antoni
  }

  if (useClonedVoice) {
    voiceId = 'AZnzlk1XvdvUeBnXmlld'; // Domi (cloned-feeling)
  }

  const cleanText = text.trim();

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey
    },
    body: JSON.stringify({
      text: cleanText,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs request failed with status ${response.status}: ${errText}`);
  }

  return response;
}
