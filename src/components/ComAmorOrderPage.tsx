import { FormEvent, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Check, Heart, LoaderCircle, Music2, RefreshCw, ShieldCheck } from 'lucide-react';

interface AuthorizationData {
  orderId: string;
  occasion: string;
  generationAttempt: number;
}

interface JobData {
  jobId: string;
  status: 'generating' | 'completed' | 'failed';
  generationAttempt: number;
  title?: string;
  genre?: string;
  audioUrl?: string;
  errorCode?: string;
}

interface ComAmorOrderPageProps {
  orderId: string;
}

function safeMessage(data: { error?: unknown }): string {
  return typeof data.error === 'string' ? data.error : 'Não foi possível concluir este passo. Tenta novamente.';
}

export default function ComAmorOrderPage({ orderId }: ComAmorOrderPageProps) {
  const [authorization, setAuthorization] = useState<AuthorizationData | null>(null);
  const [checkingAuthorization, setCheckingAuthorization] = useState(true);
  const [authorizationError, setAuthorizationError] = useState('');
  const [instruction, setInstruction] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [musicStyle, setMusicStyle] = useState('Kizomba');
  const [job, setJob] = useState<JobData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setCheckingAuthorization(true);
    setAuthorizationError('');
    setAuthorization(null);

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
      setAuthorizationError('Esta referência não é válida. Abre novamente o link recebido.');
      setCheckingAuthorization(false);
      return () => controller.abort();
    }

    fetch('/api/v1/comamor/authorize', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderId }),
    }).then(async response => {
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(safeMessage(data));
      setAuthorization(data as AuthorizationData);
    }).catch(error => {
      if (!controller.signal.aborted) setAuthorizationError(error instanceof Error ? error.message : 'Não foi possível verificar este pedido.');
    }).finally(() => {
      if (!controller.signal.aborted) setCheckingAuthorization(false);
    });

    return () => controller.abort();
  }, [orderId]);

  useEffect(() => {
    if (!job?.jobId || job.status !== 'generating') return;
    let stopped = false;
    const poll = async () => {
      try {
        const query = new URLSearchParams({ orderId });
        const response = await fetch(`/api/v1/comamor/jobs/${encodeURIComponent(job.jobId)}?${query}`);
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(safeMessage(data));
        if (stopped) return;
        setStatusError('');
        setJob(data as JobData);
      } catch (error) {
        if (!stopped) setStatusError(error instanceof Error ? error.message : 'Estado temporariamente indisponível.');
      }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 5000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [job?.jobId, job?.status, orderId]);

  const submitJob = async (event: FormEvent) => {
    event.preventDefault();
    if (!authorization || submitting || job) return;
    setSubmitting(true);
    setStatusError('');
    try {
      const response = await fetch('/api/v1/comamor/jobs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          orderId,
          instruction: instruction.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          musicStyle,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(safeMessage(data));
      setJob(data as JobData);
    } catch (error) {
      // The written content stays in component state so a temporary server
      // failure can be retried without retyping or creating another job.
      setStatusError(error instanceof Error ? error.message : 'Não foi possível enviar. Tenta novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const retryStatus = async () => {
    if (!job?.jobId) {
      setAuthorization(null);
      setCheckingAuthorization(true);
      setAuthorizationError('');
      try {
        const response = await fetch('/api/v1/comamor/authorize', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(safeMessage(data));
        setAuthorization(data as AuthorizationData);
      } catch (error) {
        setAuthorizationError(error instanceof Error ? error.message : 'Não foi possível verificar este pedido.');
      } finally {
        setCheckingAuthorization(false);
      }
    } else {
      setJob({ ...job, status: 'generating' });
      setStatusError('');
    }
  };

  const requestNextAuthorizedAttempt = async () => {
    if (!job || !authorization) return;
    setCheckingAuthorization(true);
    setStatusError('');
    try {
      const response = await fetch('/api/v1/comamor/authorize', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(safeMessage(data));
      const nextAuthorization = data as AuthorizationData;
      if (nextAuthorization.generationAttempt <= job.generationAttempt) {
        throw new Error('Ainda não existe uma nova tentativa autorizada para este pedido.');
      }
      setAuthorization(nextAuthorization);
      setJob(null);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : 'Não foi possível verificar uma nova tentativa.');
    } finally {
      setCheckingAuthorization(false);
    }
  };

  const textLength = instruction.trim().length || lyrics.trim().length;
  const canSubmit = Boolean(authorization) && Boolean(textLength >= 10) && Boolean(instruction.trim() || lyrics.trim()) && !submitting;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#151210] px-4 py-10 text-stone-100 sm:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/2 top-0 h-[32rem] w-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(180,115,45,0.18),transparent_68%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <header className="mb-10 flex items-center justify-between border-b border-white/10 pb-5">
          <a href="/" className="group inline-flex items-center gap-3 text-sm tracking-[0.22em] text-stone-200 transition hover:text-amber-300" aria-label="SeuBeat, início">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-amber-400/40 text-amber-300"><Heart className="h-4 w-4" /></span>
            <span className="font-semibold">SEUBEAT</span>
          </a>
          <span className="text-xs uppercase tracking-[0.18em] text-stone-500">Canção ComAmor</span>
        </header>

        <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="mb-8 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-amber-300/80">
              <span className="h-px w-8 bg-amber-400/60" /> Uma história, em música
            </div>
            <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-stone-50 sm:text-5xl">Uma canção feita com intenção.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-stone-400">Escreve a ideia ou a letra que queres transformar em música. Só usamos o texto que partilhares aqui.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#1d1915]/90 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.35)] sm:p-8">
            {checkingAuthorization ? (
              <div className="flex min-h-44 items-center justify-center gap-3 text-sm text-stone-400" role="status">
                <LoaderCircle className="h-5 w-5 animate-spin text-amber-300" /> A confirmar autorização do pedido…
              </div>
            ) : authorizationError ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-300/5 p-5" role="alert">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div>
                    <h2 className="font-medium text-stone-100">Ainda não podemos abrir este pedido</h2>
                    <p className="mt-2 text-sm leading-6 text-stone-400">{authorizationError}</p>
                    <button onClick={() => window.location.reload()} className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-amber-300 hover:text-amber-200">
                      <RefreshCw className="h-4 w-4" /> Voltar a verificar
                    </button>
                  </div>
                </div>
              </div>
            ) : job?.status === 'completed' ? (
              <div className="py-4">
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300"><Check className="h-6 w-6" /></div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Canção concluída</p>
                <h2 className="mt-2 font-serif text-3xl text-stone-50">{job.title || 'A tua canção está pronta'}</h2>
                {job.genre && <p className="mt-2 text-sm text-stone-400">{job.genre}</p>}
                {job.audioUrl && <a href={job.audioUrl} target="_blank" rel="noreferrer" className="mt-7 inline-flex items-center gap-3 rounded-xl bg-amber-300 px-5 py-3 font-medium text-[#21180f] transition hover:bg-amber-200"><Music2 className="h-5 w-5" /> Ouvir / transferir <ArrowUpRight className="h-4 w-4" /></a>}
              </div>
            ) : job?.status === 'generating' ? (
              <div className="py-5" role="status">
                <div className="mb-5 grid h-12 w-12 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 text-amber-300"><Music2 className="h-5 w-5" /></div>
                <p className="text-xs uppercase tracking-[0.2em] text-amber-300">Em produção</p>
                <h2 className="mt-2 font-serif text-3xl text-stone-50">Estamos a compor a tua canção.</h2>
                <p className="mt-3 text-sm leading-6 text-stone-400">Podes manter esta página aberta. O estado é atualizado automaticamente.</p>
                {statusError && <p className="mt-4 text-sm text-amber-200" role="alert">{statusError} O teu texto continua guardado nesta página.</p>}
                <button onClick={retryStatus} className="mt-5 inline-flex items-center gap-2 text-sm text-stone-400 hover:text-stone-200"><RefreshCw className="h-4 w-4" /> Consultar estado</button>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 pb-5 text-sm">
                  <span className="text-stone-500">Ocasião</span><span className="text-stone-200">{authorization?.occasion}</span>
                  <span className="hidden h-4 w-px bg-white/10 sm:inline-block" />
                  <span className="text-stone-500">Pedido verificado</span><span className="inline-flex items-center gap-1.5 text-emerald-300"><ShieldCheck className="h-4 w-4" /> autorizado</span>
                </div>

                <form onSubmit={submitJob} className="space-y-6">
                  <div>
                    <label htmlFor="comamor-instruction" className="mb-2 block text-sm font-medium text-stone-200">Conta-nos a ideia</label>
                    <textarea id="comamor-instruction" value={instruction} onChange={e => setInstruction(e.target.value)} disabled={Boolean(job) || Boolean(lyrics.trim())} maxLength={3000} rows={5} placeholder="Que sentimento, momento ou mensagem deve estar no centro da canção?" className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 disabled:opacity-60" />
                    <div className="mt-2 text-right text-xs text-stone-600">{instruction.length}/3000</div>
                  </div>

                  <details className="group rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                    <summary className="cursor-pointer list-none text-sm text-stone-400 marker:hidden">Já tens a letra? <span className="text-amber-300">Usa a tua letra</span></summary>
                    <div className="mt-4">
                      <label htmlFor="comamor-lyrics" className="mb-2 block text-sm font-medium text-stone-200">Letra da canção</label>
                      <textarea id="comamor-lyrics" value={lyrics} onChange={e => setLyrics(e.target.value)} disabled={Boolean(job) || Boolean(instruction.trim())} maxLength={5000} rows={7} placeholder="Cola aqui apenas a letra que tens autorização para partilhar." className="w-full resize-y rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-stone-100 outline-none transition placeholder:text-stone-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/10 disabled:opacity-60" />
                      <div className="mt-2 text-right text-xs text-stone-600">{lyrics.length}/5000</div>
                    </div>
                  </details>

                  <div className="max-w-xs">
                    <label htmlFor="comamor-style" className="mb-2 block text-sm font-medium text-stone-200">Estilo musical</label>
                    <select id="comamor-style" value={musicStyle} onChange={e => setMusicStyle(e.target.value)} disabled={Boolean(job)} className="w-full rounded-xl border border-white/10 bg-[#171411] px-4 py-3 text-sm text-stone-100 outline-none focus:border-amber-400/60 disabled:opacity-60">
                      {['Kizomba', 'Semba', 'Zouk', 'Afrobeat', 'Gospel', 'R&B', 'Pop'].map(style => <option key={style}>{style}</option>)}
                    </select>
                  </div>

                  {statusError && !job && <p className="text-sm text-amber-200" role="alert">{statusError} O texto que escreveste permanece aqui; podes tentar novamente.</p>}

                  {job?.status === 'failed' && <div className="rounded-xl border border-rose-300/15 bg-rose-300/5 p-4 text-sm text-rose-200" role="alert">A geração não foi concluída. O pedido não será repetido automaticamente. Contacta o ComAmor para verificar uma nova tentativa autorizada.<button type="button" onClick={requestNextAuthorizedAttempt} className="mt-3 block font-medium text-amber-300 underline underline-offset-4">Verificar nova tentativa</button></div>}

                  <div className="flex flex-col gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="max-w-sm text-xs leading-5 text-stone-500">Partilha apenas texto que tens autorização para usar. Não precisas de enviar nomes, contactos, gravações ou mensagens de outras pessoas.</p>
                    <button type="submit" disabled={!canSubmit || Boolean(job)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-semibold text-[#21180f] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40">
                      {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> A enviar…</> : <>Criar canção <ArrowUpRight className="h-4 w-4" /> </>}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <footer className="mt-6 flex items-center justify-between text-xs text-stone-600">
            <span>O texto segue a política de privacidade do SeuBeat.</span>
            <a href="/privacy" className="underline decoration-stone-700 underline-offset-4 hover:text-stone-400">Privacidade</a>
          </footer>
        </motion.section>
      </div>
    </main>
  );
}
