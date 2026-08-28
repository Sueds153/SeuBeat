import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Upload, Check, Loader2, Film, CreditCard, MessageCircle } from 'lucide-react';

interface VideoUpsellPageProps {
  requestId: string;
  email?: string;
  onBackToLanding: () => void;
}

export default function VideoUpsellPage({ requestId, email, onBackToLanding }: VideoUpsellPageProps) {
  const [loading, setLoading] = useState(true);
  const [requestData, setRequestData] = useState<{ recipientName: string; songTitle: string; plan: string } | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/song/resume-data/${requestId}`);
        const data = await res.json();
        if (res.ok && data.success) {
          setRequestData({
            recipientName: data.recipientName || '',
            songTitle: data.songTitle || data.aiSongTitle || 'a tua música',
            plan: data.plan || 'standard',
          });
        }
      } catch {}
      if (mountedRef.current) setLoading(false);
    };
    fetchData();
  }, [requestId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Ficheiro demasiado grande. Máx. 10MB.');
      return;
    }
    setProofFile(file);
    setSubmitError('');
    if (file.type.startsWith('image/')) {
      setProofPreview(URL.createObjectURL(file));
    } else {
      setProofPreview(null);
    }
  };

  const clearProof = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!proofFile) {
      setSubmitError('Seleciona o comprovativo de pagamento.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result;
          if (typeof result === 'string') {
            resolve(result.split(',')[1] || '');
          } else {
            reject(new Error('Erro ao ler ficheiro'));
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(proofFile);
      });

      const res = await fetch(`/api/song/${requestId}/video-upsell-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: email,
          proofBase64: base64,
          proofFilename: proofFile.name,
          proofMimeType: proofFile.type,
          paymentMethod: 'express',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao submeter pagamento');

      setSubmitted(true);
      clearProof();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erro ao submeter pagamento');
    } finally {
      if (mountedRef.current) setSubmitting(false);
    }
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
        <div className="w-full max-w-md text-center">
          <div className="bg-[#1c1917] border border-amber-500/30 rounded-2xl p-8">
            <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-amber-500 mb-2">Comprovativo Enviado!</h2>
            <p className="text-stone-400 text-sm mb-6">
              O teu pagamento de 2.900 Kz para o videoclipe está a ser verificado. Assim que for aprovado, serás contactado pelo WhatsApp para enviar as tuas fotos e vídeos.
            </p>
            <button
              onClick={onBackToLanding}
              className="bg-amber-500/10 text-amber-500 px-6 py-3 rounded-xl font-medium hover:bg-amber-500/20 transition-colors"
            >
              Voltar ao Início
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#151210] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back button */}
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Voltar</span>
        </button>

        <div className="bg-[#1c1917] border border-stone-800 rounded-2xl p-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Film className="w-7 h-7 text-amber-500" />
            </div>
            <h1 className="text-xl font-bold text-stone-100 mb-1">Videoclipe Emocional</h1>
            <p className="text-stone-400 text-sm">
              Transforma <span className="text-amber-400 font-medium">"{requestData?.songTitle || 'a tua música'}"</span> num videoclipe com fotos e vídeos pessoais.
            </p>
          </div>

          {/* Price */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 mb-6 text-center">
            <div className="text-3xl font-bold text-amber-500 mb-1">2.900 Kz</div>
            <p className="text-stone-400 text-xs">Música + Fotos/Vídeos = Um presente inesquecível</p>
          </div>

          {/* Payment method info */}
          <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-stone-400" />
              <span className="text-stone-300 text-sm font-medium">Dados para Pagamento</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Entidade</span>
                <span className="text-stone-200 font-mono">18224</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Referência</span>
                <span className="text-stone-200 font-mono">48379</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Valor</span>
                <span className="text-amber-400 font-bold font-mono">2.900 Kz</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Multicaixa Express</span>
                <span className="text-stone-200 font-mono">929 423 278</span>
              </div>
            </div>
          </div>

          {/* Upload proof */}
          <div className="mb-6">
            <label className="block text-stone-300 text-sm font-medium mb-2">Comprovativo de Pagamento</label>
            {proofFile ? (
              <div className="bg-stone-900/50 border border-stone-800 rounded-xl p-4">
                {proofPreview ? (
                  <img src={proofPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg mb-3" />
                ) : (
                  <div className="flex items-center gap-3 mb-3">
                    <CreditCard className="w-8 h-8 text-stone-500" />
                    <div>
                      <p className="text-stone-200 text-sm">{proofFile.name}</p>
                      <p className="text-stone-500 text-xs">{(proofFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={clearProof}
                  className="text-red-400 text-sm hover:text-red-300 transition-colors"
                >
                  Remover
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-stone-700 rounded-xl p-6 text-center hover:border-stone-600 transition-colors"
              >
                <Upload className="w-6 h-6 text-stone-500 mx-auto mb-2" />
                <p className="text-stone-400 text-sm">Clica para selecionar o comprovativo</p>
                <p className="text-stone-600 text-xs mt-1">JPG, PNG ou PDF (máx. 10MB)</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Error */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{submitError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!proofFile || submitting}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-amber-400 hover:to-amber-500 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                A enviar...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Confirmar Pagamento
              </>
            )}
          </button>

          {/* WhatsApp redirect info */}
          <div className="mt-4 text-center">
            <p className="text-stone-500 text-xs">
              Após aprovação, serás redirecionado para o WhatsApp para enviar as fotos/vídeos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
