import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowLeft, Music2, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import LogoIcon from './LogoIcon';
import { recoverByEmail } from '../api/song';

interface RecoverPageProps {
  onBackToLanding: () => void;
  onResume: (requestId: string) => void;
}

export default function RecoverPage({ onBackToLanding, onResume }: RecoverPageProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'generating' | 'error'>('idle');
  const [result, setResult] = useState<{ resumeUrl?: string; requestId?: string; message?: string }>({});
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      setStatus('error');
      setResult({ message: 'Introduz um email válido.' });
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setStatus('loading');
    const res = await recoverByEmail(trimmed, signal);
    if (signal.aborted) return;
    if (!res || !res.success) {
      setStatus('error');
      setResult({ message: res?.error || 'Algo correu mal. Tenta novamente.' });
      return;
    }
    if (res.status === 'lyrics_generating') {
      setStatus('generating');
      setResult({ message: res.message || 'A tua música ainda está a ser gerada.' });
      return;
    }
    setStatus('ok');
    setResult({ resumeUrl: res.resumeUrl, requestId: res.requestId });
  }, [email]);

  const handleResume = useCallback(() => {
    if (result.requestId) onResume(result.requestId);
  }, [result.requestId, onResume]);

  return (
    <div className="bg-[#151210] min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-300">
      <div className="max-w-2xl mx-auto px-4 md:px-8 py-12">
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
            <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">Recuperar música</p>
          </div>
        </div>

        <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-6 md:p-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-amber-500"><Music2 className="w-6 h-6" /></span>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Recupera a tua música</h1>
          </div>
          <p className="text-stone-400 leading-relaxed mb-6">
            Recebeste um lembrete sobre uma música que começaste a criar mas não terminaste o pagamento?
            Introduz o email que usaste no Wizard e enviamos-te o link para continuares de onde ficaste.
          </p>

          {status === 'idle' || status === 'loading' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Mail className="w-5 h-5 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="o.teu@email.com"
                  className="w-full bg-stone-800/60 border border-stone-700 rounded-xl pl-10 pr-4 py-3 text-sm text-stone-100 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 disabled:opacity-60 text-stone-950 font-bold rounded-xl py-3 transition-colors"
              >
                {status === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> A procurar...
                  </>
                ) : (
                  'Recuperar música'
                )}
              </button>
            </form>
          ) : null}

          {status === 'ok' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-100">
                  <p className="font-semibold mb-1">Encontrámos a tua música!</p>
                  <p className="text-emerald-200/80">Estás a um passo de terminar. Continua onde ficaste para escolheres o plano e finalizares a compra.</p>
                </div>
              </div>
              <button
                onClick={handleResume}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-stone-950 font-bold rounded-xl py-3 transition-colors"
              >
                Continuar para o pagamento
              </button>
            </div>
          ) : null}

          {status === 'generating' ? (
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <Music2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-100">{result.message}</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-100">{result.message}</p>
            </div>
          ) : null}
        </div>

        <div className="text-center text-stone-600 text-xs font-mono mt-8">
          Su-Golden &copy; 2026 &middot; Luanda, Angola
        </div>
      </div>
    </div>
  );
}
