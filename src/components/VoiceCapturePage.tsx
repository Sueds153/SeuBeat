import { useState, useRef, useEffect } from 'react';
import { Mic, Upload, Check, RefreshCw, ArrowLeft, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

interface VoiceCapturePageProps {
  requestId: string;
  email?: string;
  onBackToLanding: () => void;
}

export default function VoiceCapturePage({ requestId, email, onBackToLanding }: VoiceCapturePageProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [clonedVoiceFile, setClonedVoiceFile] = useState<File | null>(null);
  const [validationPhrase, setValidationPhrase] = useState<string | null>(null);
  const [validationTaskId, setValidationTaskId] = useState<string | null>(null);
  const [phraseRecorded, setPhraseRecorded] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState<{ recipientName: string; plan: string; hasVoice: boolean } | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const res = await fetch(`/api/song/resume-data/${requestId}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setRequestData({
            recipientName: data.recipientName || '',
            plan: data.plan || 'standard',
            hasVoice: false,
          });
        }
      } catch {}
      if (mountedRef.current) setLoading(false);
    };
    fetchRequest();
  }, [requestId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      const wasPhraseActive = validationPhrase !== null;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        if (audioBlob.size === 0) {
          if (mountedRef.current) {
            setSubmitError('Nenhum áudio captado. Tente novamente com o microfone ligado.');
          }
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        const file = new File([audioBlob], 'sample_vocal.wav', { type: 'audio/wav' });
        if (mountedRef.current) {
          setClonedVoiceFile(file);
          setHasRecorded(true);
          setRecordingSeconds(Math.round(audioBlob.size / 16000));
          if (wasPhraseActive) {
            setPhraseRecorded(true);
          } else {
            setValidationPhrase(null);
            setValidationTaskId(null);
            setValidationError('');
            setPhraseRecorded(false);
          }
        }
        stream.getTracks().forEach(track => track.stop());
      };

      setIsRecording(true);
      setRecordingSeconds(0);
      mediaRecorder.start();

      timerRef.current = setInterval(() => {
        if (mountedRef.current) {
          setRecordingSeconds(prev => prev + 1);
        }
      }, 1000);
    } catch {
      if (mountedRef.current) {
        setSubmitError('Não foi possível aceder ao microfone. Verifica as permissões do navegador.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const generateValidationPhrase = async () => {
    if (!clonedVoiceFile) return;
    setValidationLoading(true);
    setValidationError('');
    setValidationPhrase(null);
    setValidationTaskId(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      if (!mountedRef.current) { setValidationLoading(false); return; }
      const voiceBase64 = reader.result as string;
      try {
        const res = await fetch('/api/song/voice/validation-phrase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceSampleBase64: voiceBase64,
            voiceSampleFilename: clonedVoiceFile.name,
            voiceSampleMimeType: clonedVoiceFile.type || 'audio/wav',
            language: 'português'
          })
        });
        const data = await res.json();
        if (!mountedRef.current) return;
        if (res.ok && data.success && data.data?.phrase && data.data?.validationTaskId) {
          setValidationPhrase(data.data.phrase);
          setValidationTaskId(data.data.validationTaskId);
          setPhraseRecorded(false);
        } else {
          setValidationError(data.error || 'Não foi possível gerar a frase de validação.');
        }
      } catch {
        if (mountedRef.current) setValidationError('Erro de ligação. Tenta novamente.');
      } finally {
        if (mountedRef.current) setValidationLoading(false);
      }
    };
    reader.readAsDataURL(clonedVoiceFile);
  };

  const handleSubmit = async () => {
    if (!clonedVoiceFile || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const voiceBase64 = reader.result as string;
      try {
        const res = await fetch(`/api/song/${requestId}/voice-sample`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            voiceSampleBase64: voiceBase64,
            voiceSampleFilename: clonedVoiceFile.name,
            voiceSampleMimeType: clonedVoiceFile.type || 'audio/wav',
            email: email || undefined,
          })
        });
        const data = await res.json();
        if (mountedRef.current) {
          if (res.ok && data.success) {
            setSubmitted(true);
          } else {
            setSubmitError(data.error || 'Erro ao enviar a amostra de voz.');
          }
        }
      } catch {
        if (mountedRef.current) setSubmitError('Erro de ligação. Tenta novamente.');
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    };
    reader.readAsDataURL(clonedVoiceFile);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#151210]">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#151210] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-stone-900/50 border border-emerald-900/30 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="font-serif text-2xl text-stone-100 font-black">Voz Recebida!</h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            A tua amostra de voz foi enviada com sucesso. A clonagem será processada automaticamente quando o pagamento for aprovado.
          </p>
          <button
            onClick={onBackToLanding}
            className="px-6 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#151210] p-4 md:p-8">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={onBackToLanding} className="text-stone-500 hover:text-stone-300 transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-serif text-xl text-stone-100 font-black">Gravar Voz</h1>
            {requestData?.recipientName && (
              <p className="text-stone-500 text-xs">Dedicatória para <span className="text-stone-400">{requestData.recipientName}</span></p>
            )}
          </div>
        </div>

        <div className="bg-stone-900/50 border border-amber-900/20 rounded-2xl p-6 space-y-4">
          <span className="text-[9px] text-amber-500 font-mono uppercase tracking-wider block">PASSO 1 · GRAVAR AMOSTRA</span>
          <p className="text-stone-400 text-xs leading-relaxed">
            Grava uma amostra de voz livre (fala ou canto) de pelo menos <strong className="text-stone-200">10 segundos</strong>. Esta amostra serve para calibrar o timbre da tua voz.
          </p>

          <div className="flex items-center justify-center gap-2 py-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`w-1 bg-gradient-to-t from-amber-500 to-rose-500 rounded-full transition-all ${isRecording ? 'animate-pulse' : ''}`}
                style={{ height: isRecording ? `${Math.floor(Math.random() * 32) + 12}px` : '4px' }}
              />
            ))}
          </div>

          <div className="text-center font-mono space-y-1">
            {isRecording ? (
              <div className="flex items-center gap-2 text-rose-500 text-xs font-bold justify-center">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
                <span>GRAVAÇÃO EM CURSO • 0:{(recordingSeconds < 10 ? '0' : '') + recordingSeconds}s</span>
              </div>
            ) : hasRecorded ? (
              <span className="text-emerald-500 text-xs font-bold">
                {validationPhrase && phraseRecorded ? 'FRASE DE VALIDAÇÃO GRAVADA!' : validationPhrase ? 'FRASE GERADA — GRAVE-A AGORA!' : 'AMOSTRA GRAVADA!'} (0:{recordingSeconds}s)
              </span>
            ) : (
              <span className="text-stone-600 text-xs font-mono">Pronto para gravar</span>
            )}
          </div>

          {!isRecording && !hasRecorded && (
            <button
              onClick={startRecording}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer hover:opacity-90 transition-all active:scale-[0.98]"
            >
              <Mic className="w-4 h-4" />
              <span>Gravar Amostra de Voz</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="w-full py-3.5 bg-stone-950 border border-stone-800 hover:bg-stone-900 text-stone-200 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer"
            >
              <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
              <span>Parar Gravação</span>
            </button>
          )}

          {hasRecorded && !isRecording && (
            <div className="flex flex-col gap-3">
              <button
                onClick={startRecording}
                className="py-3 bg-stone-950 border border-stone-850 hover:bg-stone-900 text-stone-400 hover:text-stone-250 font-semibold text-xs rounded-xl flex items-center gap-2 justify-center transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-[spin_3s_linear_infinite]" />
                <span>{validationPhrase ? 'Gravar Frase de Validação' : 'Gravar Novamente'}</span>
              </button>
              <div className="bg-stone-950/80 px-4 py-2.5 rounded-xl border border-stone-850 flex items-center gap-2 justify-center text-xs font-mono text-emerald-400">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{validationPhrase ? 'frase_validacao.wav' : 'amostra_vocal.wav'}</span>
              </div>
            </div>
          )}

          {!hasRecorded && (
            <div className="w-full text-center pt-4 border-t border-stone-800/60 mt-3">
              <p className="text-[10px] text-stone-500 font-mono tracking-wide uppercase pb-2">Ou envie um ficheiro de áudio</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-stone-950 hover:bg-stone-900 text-stone-400 hover:text-white rounded-xl border border-stone-850 cursor-pointer text-xxs font-mono transition-all">
                <Upload className="w-3.5 h-3.5 text-stone-500" />
                <span className="font-mono">Carregar Áudio (.mp3, .wav, .m4a)</span>
                <input
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const file = e.target.files[0];
                      if (file.size > 50 * 1024 * 1024) {
                        setSubmitError('O áudio não pode exceder 50MB.');
                        e.target.value = '';
                        return;
                      }
                      setClonedVoiceFile(file);
                      setHasRecorded(true);
                      setRecordingSeconds(Math.round(file.size / 16000));
                      setValidationPhrase(null);
                      setValidationTaskId(null);
                      setValidationError('');
                      setPhraseRecorded(false);
                    }
                  }}
                />
              </label>
            </div>
          )}
        </div>

        <div className="bg-stone-900/50 border border-amber-900/20 rounded-2xl p-6 space-y-4">
          <span className="text-[9px] text-amber-500 font-mono uppercase tracking-wider block">PASSO 2 · VALIDAÇÃO DA VOZ</span>

          {!validationPhrase && !validationLoading && (
            <>
              <p className="text-stone-400 text-xs leading-relaxed">
                Vamos gerar uma <strong className="text-stone-200">frase de validação</strong> a partir da tua amostra.
                Depois terás de gravar <strong className="text-stone-200">essa mesma frase</strong> para confirmarmos o timbre.
              </p>
              <button
                onClick={generateValidationPhrase}
                disabled={!hasRecorded || validationLoading}
                className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  hasRecorded
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-stone-850 border border-stone-800 text-stone-500 opacity-60 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Gerar Frase de Validação</span>
              </button>
            </>
          )}

          {validationLoading && (
            <div className="text-stone-400 text-xs flex items-center gap-2 font-mono">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
              <span>A gerar frase de validação... (pode demorar até 30s)</span>
            </div>
          )}

          {validationError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              <p className="text-rose-300 text-xs">{validationError}</p>
              <button onClick={() => { setValidationError(''); setValidationPhrase(null); setValidationTaskId(null); setPhraseRecorded(false); }}
                className="text-[10px] text-rose-400 underline font-mono mt-1 cursor-pointer">Tentar novamente</button>
            </div>
          )}

          {validationPhrase && (
            <div className="space-y-3">
              <p className="text-stone-400 text-xs leading-relaxed">
                {phraseRecorded
                  ? <><strong className="text-emerald-400">Boa!</strong> Gravaste a frase. A tua voz será clonada a partir desta gravação.</>
                  : <>Agora <strong className="text-amber-400">grava a frase abaixo</strong> com a tua voz (de preferência a cantar).</>
                }
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                <p className="text-[9px] text-amber-500 font-mono uppercase tracking-wider pb-2">FRASE DE VALIDAÇÃO</p>
                <p className="text-stone-100 text-sm italic leading-relaxed font-medium">"{validationPhrase}"</p>
              </div>
              {phraseRecorded && (
                <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400">
                  <Check className="w-3.5 h-3.5" />
                  <span>Frase gravada com sucesso!</span>
                </div>
              )}
            </div>
          )}
        </div>

        {submitError && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <p className="text-rose-300 text-xs">{submitError}</p>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!hasRecorded || !validationTaskId || !phraseRecorded || submitting}
          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
            hasRecorded && validationTaskId && phraseRecorded && !submitting
              ? 'bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 hover:opacity-90 active:scale-[0.98]'
              : 'bg-stone-850 border border-stone-800 text-stone-500 opacity-60 cursor-not-allowed'
          }`}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> A enviar...</>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Confirmar e Enviar Voz</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
