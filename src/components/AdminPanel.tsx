import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  BarChart3, Users, Music, CreditCard, CheckCircle, XCircle,
  Clock, RefreshCw, Eye, LogOut, ChevronDown, ChevronRight,
  Download, Play, AlertTriangle, Sparkles, TrendingUp, Shield,
  Activity, RotateCcw, Mic, Mail, Pencil, Upload, Search, FileText, ExternalLink, List, Zap,
  Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import LogoIcon from './LogoIcon';
import WhatsAppHelp from './WhatsAppHelp';

const ADMIN_PASSWORD_KEY = 'seubeat_admin_auth';

interface Stats {
  totalUsers: number;
  totalRequests: number;
  pendingPayments: number;
  approvedPayments: number;
  totalRevenue: string;
  musicGenerated: number;
  requestsByStatus: Record<string, number>;
}

interface Payment {
  id: string;
  user_email: string;
  plan: string;
  amount: string | number;
  proof_url: string | null;
  proof_path: string | null;
  proof_filename: string | null;
  status: 'pending_verification' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  song_requests?: {
    id: string;
    recipient_name: string;
    occasion: string;
    music_style: string;
    status: string;
    users?: { name: string; email: string; phone: string };
  };
}

interface SongRequest {
  id: string;
  recipient_name: string;
  relationship: string;
  occasion: string;
  music_style: string;
  voice_type: string;
  status: string;
  created_at: string;
  voice_sample_url?: string | null;
  users?: { name: string; email: string; phone: string };
  songs?: { id: string; title: string; audio_url: string | null; mureka_status: string; created_at: string; letter_text?: string; lyrics?: string[] }[];
  payments?: { plan: string; amount: string; status: string }[];
}

interface Song {
  id: string;
  title: string;
  audio_url: string | null;
  full_song_url?: string | null;
  preview_url?: string | null;
  mureka_status: string;
  mureka_task_id: string | null;
  created_at: string;
  letter_text?: string | null;
  lyrics?: string[] | null;
  song_requests?: {
    recipient_name: string;
    music_style: string;
    occasion: string;
    users?: { name: string; email: string };
  };
}

interface DiagnosticsResult {
  supabase: { ok: boolean; error?: string; buckets?: { name: string; public: boolean }[] };
  claude: { ok: boolean; error?: string };
  openai: { ok: boolean; error?: string };
  gemini: { ok: boolean; error?: string };
  suno: { ok: boolean; error?: string; credits?: number };
  sunoVoice: { ok: boolean; error?: string };
  email: { ok: boolean; error?: string; provider?: string; host?: string };
}

interface CreditsResult {
  suno: { ok: boolean; error?: string; credits: number; low?: boolean; lastCheck: string };
  claude: { ok: boolean; error?: string; model?: string; quota_exceeded?: boolean; lastCheck: string };
  openai: { ok: boolean; error?: string; total_granted?: number; total_used?: number; total_available?: number; model?: string; quota_exceeded?: boolean; lastCheck: string };
  gemini: { ok: boolean; error?: string; model?: string; quota_exceeded?: boolean; lastCheck: string };
  email: { ok: boolean; error?: string; provider?: string; host?: string; lastCheck: string };
  usage: {
    totalSongs: number;
    songsThisMonth: number;
    songsByMonth: { month: string; count: number }[];
    estimatedSunoCreditsUsed: number;
    estimatedSongsRemaining: number;
    cost: { sunoUSD: number; claudeUSD: number; openaiUSD: number; totalUSD: number; perSong: number };
  };
}

interface ProgressEntry {
  status: string;
  progress: number;
  message: string;
  error?: string;
}

type AdminView = 'dashboard' | 'payments' | 'requests' | 'songs' | 'clients' | 'credits' | 'diagnostics' | 'metrics';

const STATUS_COLORS: Record<string, string> = {
  pending_verification: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  pending: 'bg-stone-700/50 text-stone-400 border-stone-700',
  payment_submitted: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  paid: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  payment_rejected: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  music_generating: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  music_ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  not_started: 'bg-stone-700/50 text-stone-500 border-stone-700',
  generating: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  processing: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  draft: 'bg-stone-700/50 text-stone-400 border-stone-700',
  lyrics_ready: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  preview_ready: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  voice_processing: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  delivered: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
};

const STATUS_LABELS: Record<string, string> = {
  pending_verification: '⏳ Aguardando Verificação',
  approved: '✅ Aprovado',
  rejected: '❌ Rejeitado',
  pending: '⏳ Pendente',
  payment_submitted: '💳 Comprovativo Enviado',
  paid: '✅ Pago',
  payment_rejected: '❌ Pagamento Rejeitado',
  music_generating: '🎵 Gerando Música',
  music_ready: '🎶 Música Pronta',
  not_started: '⏸ Não Iniciado',
  generating: '🎵 Gerando...',
  completed: '✅ Concluído',
  failed: '❌ Falhou',
  processing: '⏳ Em Processamento',
  draft: '📝 Rascunho',
  lyrics_ready: '📝 Letra Pronta',
  preview_ready: '🎧 Preview Pronto',
  voice_processing: '🎙️ Processando Voz',
  delivered: '🎁 Entregue',
};

function StatusBadge({ status }: { status: string }) {
  const colorClass = STATUS_COLORS[status] || 'bg-stone-700/50 text-stone-400 border-stone-700';
  const label = STATUS_LABELS[status] || status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${colorClass} whitespace-nowrap`}>
      {label}
    </span>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

const VALID_STATUSES_FRONTEND: Record<string, { label: string; value: string }[]> = {
  song_requests: [
    { label: '📝 A gerar letra', value: 'lyrics_generating' },
    { label: '📝 Letra pronta', value: 'lyrics_ready' },
    { label: '🎵 A processar música', value: 'music_processing' },
    { label: '🎙️ A processar voz', value: 'voice_processing' },
    { label: '🎶 Música pronta', value: 'music_ready' },
    { label: '🎁 Entregue', value: 'delivered' },
    { label: '❌ Falhou', value: 'failed' },
    { label: '💳 Pagamento rejeitado', value: 'payment_rejected' },
    { label: '💳 Comprovativo enviado', value: 'payment_submitted' },
  ],
  payments: [
    { label: '⏳ A aguardar verificação', value: 'pending_verification' },
    { label: '✅ Aprovado', value: 'approved' },
    { label: '❌ Rejeitado', value: 'rejected' },
  ],
  songs: [
    { label: '⏸ Não iniciado', value: 'not_started' },
    { label: '🎵 A gerar', value: 'generating' },
    { label: '⏳ Em processamento', value: 'processing' },
    { label: '✅ Concluído', value: 'completed' },
    { label: '❌ Falhou', value: 'failed' },
  ],
};

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('seubeat_admin_token');
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [adminToken, setAdminToken] = useState(() => {
    return sessionStorage.getItem('seubeat_admin_token') || '';
  });
  const [loginLoading, setLoginLoading] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [requests, setRequests] = useState<SongRequest[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  const [proofModal, setProofModal] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [progressMap, setProgressMap] = useState<Record<string, ProgressEntry>>({});
  const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
  const [editingSong, setEditingSong] = useState<{ id: string; title: string; lyrics: string; letterText: string } | null>(null);
  const [uploadingSongId, setUploadingSongId] = useState<string | null>(null);
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [credits, setCredits] = useState<CreditsResult | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(false);
  const [forceStatusModal, setForceStatusModal] = useState<{ id: string; table: string; currentStatus: string } | null>(null);
  const [forceStatusValue, setForceStatusValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<'all' | 'name' | 'email' | 'status' | 'style' | 'occasion' | 'relationship'>('all');
  const [notifCount, setNotifCount] = useState(0);
  const [notifDot, setNotifDot] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [profitability, setProfitability] = useState<any>(null);
  const [profitLoading, setProfitLoading] = useState(false);
  const [logsModal, setLogsModal] = useState<{ id: string; loading: boolean; logs: any[] } | null>(null);
  const [previewLyrics, setPreviewLyrics] = useState<{ title: string; lyrics: string[]; letterText?: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string } | null>(null);
  const prevCountsRef = useRef({ requests: 0, payments: 0 });
  const notifIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ action: 'approve' | 'reject'; paymentId: string } | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
  const [reqSort, setReqSort] = useState('created_at_desc');
  const [paySort, setPaySort] = useState('created_at_desc');
  const [reqPage, setReqPage] = useState(1);
  const [payPage, setPayPage] = useState(1);
  const PER_PAGE = 20;

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const apiHeaders: Record<string, string> = adminToken 
    ? { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };

  const handleFetchError = useCallback(async (res: Response) => {
    if (res.ok) return true;
    if (res.status === 401) {
      expireSession();
      return false;
    }
    try {
      const data = await res.json();
      showToast(data.error || `Erro ${res.status}`, 'error');
    } catch {
      showToast(`Erro ${res.status}`, 'error');
    }
    return false;
  }, [adminToken]);

  const apiFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<any> => {
    try {
      const res = await fetch(url, { ...options, headers: { ...apiHeaders, ...options.headers } });
      const ok = await handleFetchError(res);
      return ok ? await res.json() : null;
    } catch (e: any) {
      showToast('Erro de ligação ao servidor.', 'error');
      return null;
    }
  }, [adminToken, apiHeaders, handleFetchError]);

  const expireSession = useCallback(() => {
    showToast('Sessão expirada. Faça login novamente.', 'error');
    setTimeout(() => {
      sessionStorage.removeItem('seubeat_admin_token');
      setAdminToken('');
      setAuthenticated(false);
    }, 1500);
  }, []);

  const handleLogin = async () => {
    setAuthError('');
    setLoginLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        sessionStorage.setItem('seubeat_admin_token', data.token);
        setAdminToken(data.token);
        setAuthenticated(true);
        setPasswordInput('');
      } else {
        setAuthError(data.error || 'Password inválida.');
        setLoginLoading(false);
        return;
      }
    } catch {
      setAuthError('Erro de ligação ao servidor.');
      setLoginLoading(false);
      return;
    }
    setLoginLoading(false);
  };  

  const fetchStats = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const data = await apiFetch('/api/admin/stats');
    if (data) { setStats(data); prevCountsRef.current = { requests: data.totalRequests || 0, payments: data.pendingPayments || 0 }; }
    setLoading(false);
  }, [adminToken, apiFetch]);

  const fetchPayments = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const d = await apiFetch('/api/admin/payments');
    if (d) setPayments(d.payments || []);
    setLoading(false);
  }, [adminToken, apiFetch]);

  const fetchRequests = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const d = await apiFetch('/api/admin/requests');
    if (d) setRequests(d.requests || []);
    setLoading(false);
  }, [adminToken, apiFetch]);

  const fetchSongs = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const d = await apiFetch('/api/admin/songs');
    if (d) setSongs(d.songs || []);
    setLoading(false);
  }, [adminToken, apiFetch]);

  const fetchClientsList = useCallback(async () => {
    if (!adminToken) return;
    setLoading(true);
    const d = await apiFetch('/api/admin/clients');
    if (d) setClients(d.clients || []);
    setLoading(false);
  }, [adminToken, apiFetch]);

  const fetchDiagnostics = useCallback(async () => {
    if (!adminToken) return;
    setDiagLoading(true);
    const data = await apiFetch('/api/admin/diagnostics');
    if (data) setDiagnostics(data);
    setDiagLoading(false);
  }, [adminToken, apiFetch]);

  const fetchCredits = useCallback(async () => {
    if (!adminToken) return;
    setCreditsLoading(true);
    const data = await apiFetch('/api/admin/credits');
    if (data) setCredits(data);
    setCreditsLoading(false);
  }, [adminToken, apiFetch]);

  const handleForceStatus = useCallback(async () => {
    if (!forceStatusModal || !forceStatusValue) return;
    setActionLoading(forceStatusModal.id + '_force');
    try {
      const res = await fetch(`/api/admin/request/${forceStatusModal.id}/force-status`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ table: forceStatusModal.table, status: forceStatusValue })
      });
      const data = await res.json();
      if (res.ok) { showToast(`Estado forçado para "${forceStatusValue}"`); setForceStatusModal(null); setForceStatusValue(''); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao forçar estado.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
    fetchRequests(); fetchPayments(); fetchSongs();
  }, [forceStatusModal, forceStatusValue, adminToken, expireSession]);

  const handleUpdateStyle = useCallback(async (requestId: string, musicStyle?: string, voiceType?: string) => {
    setActionLoading(requestId + '_style');
    try {
      const res = await fetch(`/api/admin/request/${requestId}/update-style`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ music_style: musicStyle, voice_type: voiceType })
      });
      const data = await res.json();
      if (res.ok) { showToast('🎵 Estilo atualizado!'); fetchRequests(); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao atualizar.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  }, [adminToken, expireSession]);

  const handleRegenerateLyrics = useCallback(async (requestId: string) => {
    setActionLoading(requestId + '_reg');
    try {
      const res = await fetch(`/api/admin/request/${requestId}/regenerate-lyrics`, {
        method: 'POST', headers: apiHeaders
      });
      const data = await res.json();
      if (res.ok) { showToast('✏️ Letra regenerada com sucesso!'); fetchRequests(); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao regenerar.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  }, [adminToken, expireSession]);

  const fetchMetrics = useCallback(async () => {
    if (!adminToken) return;
    setMetricsLoading(true);
    const data = await apiFetch('/api/admin/metrics');
    if (data) setMetrics(data);
    setMetricsLoading(false);
  }, [adminToken, apiFetch]);

  const fetchProfitability = useCallback(async () => {
    if (!adminToken) return;
    setProfitLoading(true);
    const data = await apiFetch('/api/admin/profitability');
    if (data) setProfitability(data);
    setProfitLoading(false);
  }, [adminToken, apiFetch]);

  const fetchLogs = useCallback(async (requestId: string) => {
    setLogsModal({ id: requestId, loading: true, logs: [] });
    const d = await apiFetch(`/api/admin/request/${requestId}/logs`);
    if (d) setLogsModal({ id: requestId, loading: false, logs: d.logs || [] });
    else setLogsModal(null);
  }, [adminToken, apiFetch]);

  const checkNewData = useCallback(async () => {
    if (!adminToken) return;
    const statsData = await apiFetch('/api/admin/stats');
    if (!statsData) return;
    setStats(statsData);
    const prev = prevCountsRef.current;
    const currentRequests = statsData.totalRequests || 0;
    const currentPayments = statsData.pendingPayments || 0;

    if (prev.requests > 0 && currentRequests > prev.requests) {
      setNotification({ message: `📦 Novo pedido de música recebido!` });
      setNotifCount(c => c + 1);
      setNotifDot(true);
    }
    if (prev.payments >= 0 && currentPayments > prev.payments) {
      setNotification({ message: `💳 Novo pagamento pendente!` });
      setNotifCount(c => c + 1);
      setNotifDot(true);
    }
    prevCountsRef.current = { requests: currentRequests, payments: currentPayments };
  }, [adminToken, apiFetch]);

  // Notification polling when on admin panel
  useEffect(() => {
    if (authenticated) {
      notifIntervalRef.current = setInterval(checkNewData, 15000);
      checkNewData();
    }
    return () => { if (notifIntervalRef.current) clearInterval(notifIntervalRef.current); };
  }, [authenticated, checkNewData]);

  // Clear notification after 5s
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  const fetchProgress = useCallback(async () => {
    if (!adminToken) return;
    try {
      const res = await fetch('/api/admin/progress', { headers: apiHeaders });
      if (res.ok) setProgressMap(await res.json());
      else if (res.status === 401) {
        showToast('Sessão expirada.', 'error');
        setTimeout(() => {
          sessionStorage.removeItem('seubeat_admin_token');
          setAdminToken('');
          setAuthenticated(false);
        }, 1500);
      }
    } catch (e) {}
  }, [adminToken]);

  useEffect(() => {
    if (!authenticated) return;
    fetchStats();
    if (activeView === 'payments') fetchPayments();
    else if (activeView === 'requests') { fetchRequests(); fetchProgress(); }
    else if (activeView === 'songs') fetchSongs();
    else if (activeView === 'credits') fetchCredits();
    else if (activeView === 'diagnostics') fetchDiagnostics();
    else if (activeView === 'metrics') { fetchMetrics(); fetchProfitability(); }
    else if (activeView === 'clients') fetchClientsList();
  }, [authenticated, activeView]);

  // Poll progress every 5s when on requests tab
  useEffect(() => {
    if (activeView === 'requests' && authenticated) {
      progressPollRef.current = setInterval(fetchProgress, 5000);
    } else {
      if (progressPollRef.current) clearInterval(progressPollRef.current);
    }
    return () => { if (progressPollRef.current) clearInterval(progressPollRef.current); };
  }, [activeView, authenticated]);

  // Poll current view data every 30s
  useEffect(() => {
    if (!authenticated) return;
    const poll = () => {
      if (activeView === 'payments') fetchPayments();
      else if (activeView === 'requests') fetchRequests();
      else if (activeView === 'songs') fetchSongs();
      else if (activeView === 'clients') fetchClientsList();
      else if (activeView === 'metrics') { fetchMetrics(); fetchProfitability(); }
      else if (activeView === 'credits') fetchCredits();
      else if (activeView === 'diagnostics') fetchDiagnostics();
    };
    viewPollRef.current = setInterval(poll, 30000);
    return () => { if (viewPollRef.current) clearInterval(viewPollRef.current); };
  }, [authenticated, activeView, fetchPayments, fetchRequests, fetchSongs, fetchClientsList, fetchMetrics, fetchProfitability, fetchCredits, fetchDiagnostics]);

  useEffect(() => { setReqPage(1); }, [searchQuery]);
  useEffect(() => { setPayPage(1); }, [paymentSearchQuery]);

  useEffect(() => { setReqPage(1); }, [activeView]);
  useEffect(() => { setPayPage(1); }, [activeView]);

  // login handler removido — ver handleLogin acima

  const handleConfirmApprove = async () => {
    if (!confirmAction) return;
    const paymentId = confirmAction.paymentId;
    setConfirmAction(null);
    setActionLoading(paymentId + '_approve');
    try {
      const res = await fetch(`/api/admin/payment/${paymentId}/approve`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ notes: 'Pagamento verificado e aprovado.' })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Pagamento aprovado! ${data.murekaTriggered ? '🎵 Mureka em processamento.' : ''}`);
        fetchPayments();
        fetchStats();
      } else {
        if (res.status === 401) expireSession();
        else showToast(data.error || 'Erro ao aprovar pagamento.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Erro de ligação.', 'error');
    }
    setActionLoading(null);
  };

  const handleConfirmReject = async () => {
    if (!confirmAction) return;
    const paymentId = confirmAction.paymentId;
    const notes = rejectNotes[paymentId] || '';
    setConfirmAction(null);
    setActionLoading(paymentId + '_reject');
    try {
      const res = await fetch(`/api/admin/payment/${paymentId}/reject`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ notes })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('❌ Pagamento rejeitado. Cliente notificado.');
        fetchPayments();
        fetchStats();
      } else {
        if (res.status === 401) expireSession();
        else showToast(data.error || 'Erro ao rejeitar.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Erro de ligação.', 'error');
    }
    setActionLoading(null);
  };

  const handleGenerateMusic = async (songId: string) => {
    setActionLoading(songId + '_music');
    try {
      const res = await fetch(`/api/admin/song/${songId}/generate-music`, {
        method: 'POST',
        headers: apiHeaders
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Geracao Mureka iniciada em background.');
        fetchSongs();
        fetchProgress();
      } else {
        if (res.status === 401) expireSession();
        else showToast(data.error || 'Erro ao gerar música.', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Erro de ligação.', 'error');
    }
    setActionLoading(null);
  };

  const handleRetry = async (requestId: string) => {
    setActionLoading(requestId + '_retry');
    try {
      const res = await fetch(`/api/admin/request/${requestId}/retry`, { method: 'POST', headers: apiHeaders });
      const data = await res.json();
      if (res.ok) { showToast('🔁 Fluxo reiniciado!'); fetchRequests(); fetchProgress(); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao reiniciar.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  };

  const handleForceVoice = async (requestId: string) => {
    setActionLoading(requestId + '_voice');
    try {
      const res = await fetch(`/api/admin/request/${requestId}/force-voice`, { method: 'POST', headers: apiHeaders });
      const data = await res.json();
      if (res.ok) { showToast('🎙️ Processamento de voz iniciado!'); fetchRequests(); fetchProgress(); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao forçar voz.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  };

  const handleResendEmail = async (requestId: string) => {
    setActionLoading(requestId + '_email');
    try {
      const res = await fetch(`/api/admin/request/${requestId}/resend-email`, { method: 'POST', headers: apiHeaders });
      const data = await res.json();
      if (res.ok) showToast('📧 Email reenviado com sucesso!');
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao reenviar email.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  };

  const handleSaveLyrics = async () => {
    if (!editingSong) return;
    setActionLoading('lyrics_' + editingSong.id);
    try {
      const res = await fetch(`/api/admin/song/${editingSong.id}/edit-lyrics`, {
        method: 'POST', headers: apiHeaders,
        body: JSON.stringify({ title: editingSong.title, lyrics: editingSong.lyrics, letterText: editingSong.letterText })
      });
      const data = await res.json();
      if (res.ok) { showToast('✏️ Letra atualizada!'); setEditingSong(null); fetchSongs(); fetchRequests(); }
      else if (res.status === 401) expireSession();
      else showToast(data.error || 'Erro ao guardar letra.', 'error');
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
    setActionLoading(null);
  };

  const handleUploadAudio = async (songId: string, file: File) => {
    setActionLoading(songId + '_upload');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (!e.target?.result) {
          showToast('Erro ao ler o arquivo.', 'error');
          setActionLoading(null);
          return;
        }
        const base64 = e.target.result as string;
        const res = await fetch(`/api/admin/song/${songId}/upload-audio`, {
          method: 'POST', headers: apiHeaders,
          body: JSON.stringify({ audioBase64: base64, audioFilename: file.name, audioMimeType: file.type })
        });
        const data = await res.json();
        if (res.ok) { showToast('📤 Áudio carregado com sucesso!'); fetchSongs(); setUploadingSongId(null); }
        else if (res.status === 401) { expireSession(); setUploadingSongId(null); }
        else showToast(data.error || 'Erro ao carregar áudio.', 'error');
        setActionLoading(null);
      };
      reader.onerror = () => {
        showToast('Erro ao ler o arquivo.', 'error');
        setActionLoading(null);
      };
      reader.readAsDataURL(file);
    } catch (e: any) { showToast(e.message, 'error'); setActionLoading(null); }
  };

  const handleSongAudio = async (song: Song, download = false) => {
    setActionLoading(song.id + (download ? '_download_audio' : '_listen_audio'));
    try {
      const data = await apiFetch(`/api/admin/song/${song.id}/audio-url${download ? '?download=1' : ''}`);
      if (!data?.url) return;

      const a = document.createElement('a');
      a.href = data.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (download) a.download = data.filename || `${song.title || 'seubeat-musica'}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast(download ? 'Download da música completa iniciado.' : 'A abrir música completa.');
    } catch (e: any) {
      showToast(e.message || 'Erro ao abrir áudio.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const sortData = <T extends Record<string, any>>(items: T[], sortKey: string, fieldMap: Record<string, (item: T) => string>): T[] => {
    const [field, dir] = sortKey.split('_');
    const asc = dir === 'asc';
    const getVal = fieldMap[field];
    if (!getVal) return items;
    return [...items].sort((a, b) => {
      const aVal = getVal(a).toLowerCase();
      const bVal = getVal(b).toLowerCase();
      const cmp = aVal.localeCompare(bVal);
      return asc ? cmp : -cmp;
    });
  };

  const reqFieldMap: Record<string, (r: any) => string> = {
    created_at: r => r.created_at || '',
    name: r => r.users?.name || r.recipient_name || '',
    status: r => r.status || '',
  };
  const payFieldMap: Record<string, (p: any) => string> = {
    created_at: p => p.created_at || '',
    email: p => p.user_email || '',
    plan: p => p.plan || '',
    status: p => p.status || '',
  };

  const filteredRequests = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter(r => {
      const name = (r.users?.name || '').toLowerCase();
      const email = (r.users?.email || '').toLowerCase();
      const status = r.status.toLowerCase();
      const style = (r.music_style || '').toLowerCase();
      const recipient = (r.recipient_name || '').toLowerCase();
      const occasion = (r.occasion || '').toLowerCase();
      const relationship = (r.relationship || '').toLowerCase();
      if (searchFilter === 'name') return name.includes(q) || recipient.includes(q);
      if (searchFilter === 'email') return email.includes(q);
      if (searchFilter === 'status') return status.includes(q);
      if (searchFilter === 'style') return style.includes(q);
      if (searchFilter === 'occasion') return occasion.includes(q);
      if (searchFilter === 'relationship') return relationship.includes(q);
      return name.includes(q) || email.includes(q) || status.includes(q) || style.includes(q) || recipient.includes(q) || occasion.includes(q) || relationship.includes(q);
    });
  }, [requests, searchQuery, searchFilter]);

  const filteredPayments = useMemo(() => {
    if (!paymentSearchQuery) return payments;
    const q = paymentSearchQuery.toLowerCase();
    return payments.filter(p => {
      const email = (p.user_email || '').toLowerCase();
      const plan = (p.plan || '').toLowerCase();
      const status = p.status.toLowerCase();
      const recipient = (p.song_requests?.recipient_name || '').toLowerCase();
      return email.includes(q) || plan.includes(q) || status.includes(q) || recipient.includes(q);
    });
  }, [payments, paymentSearchQuery]);

  const sortedRequests = useMemo(() => sortData(filteredRequests, reqSort, reqFieldMap), [filteredRequests, reqSort]);
  const sortedPayments = useMemo(() => sortData(filteredPayments, paySort, payFieldMap), [filteredPayments, paySort]);

  const paginatedRequests = useMemo(() => {
    const start = (reqPage - 1) * PER_PAGE;
    return sortedRequests.slice(start, start + PER_PAGE);
  }, [sortedRequests, reqPage]);

  const paginatedPayments = useMemo(() => {
    const start = (payPage - 1) * PER_PAGE;
    return sortedPayments.slice(start, start + PER_PAGE);
  }, [sortedPayments, payPage]);

  const reqTotalPages = Math.ceil(sortedRequests.length / PER_PAGE);
  const payTotalPages = Math.ceil(sortedPayments.length / PER_PAGE);

  // ─── LOGIN SCREEN ───
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.05)_0%,_transparent_70%)]" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-stone-900/60 border border-stone-800 rounded-3xl p-8 max-w-md w-full space-y-6 backdrop-blur relative z-10"
        >
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
              <Shield className="w-8 h-8 text-stone-950" />
            </div>
            <h1 className="font-serif text-2xl font-bold text-stone-100">Painel Admin</h1>
            <p className="text-stone-400 text-sm">SeuBeat — Área Restrita</p>
          </div>

          <div className="space-y-3">
            <label className="text-xs font-mono text-stone-400 block">PASSWORD DE ACESSO</label>
            <input
              type="password"
              value={passwordInput}
              onChange={e => setPasswordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="••••••••••••"
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition-colors font-mono"
            />
            {authError && (
              <>
                <p className="text-rose-400 text-xs font-mono">{authError}</p>
                <div className="flex justify-start">
                  <WhatsAppHelp context="erro_fatal" label="Falar com apoio" />
                </div>
              </>
            )}
            <button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-sm rounded-xl hover:opacity-95 disabled:opacity-50 transition-opacity cursor-pointer flex items-center justify-center gap-2"
            >
              {loginLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> A autenticar...</> : 'Entrar no Painel'}
            </button>
          </div>

          <p className="text-center text-[10px] text-stone-600 font-mono">
            SEUBEAT ADMIN v1.0 • ACESSO RESTRITO
          </p>
        </motion.div>
      </div>
    );
  }

  // ─── STAT CARD ───
  const StatCard = ({ icon: Icon, label, value, color, subtitle }: {
    icon: any; label: string; value: string | number; color: string; subtitle?: string;
  }) => (
    <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold font-mono text-stone-100 mt-0.5">{value}</p>
        {subtitle && <p className="text-[10px] text-stone-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'payments', label: 'Pagamentos', icon: CreditCard },
    { id: 'requests', label: 'Pedidos', icon: Music },
    { id: 'songs', label: 'Músicas', icon: Sparkles },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'metrics', label: 'Métricas', icon: TrendingUp },
    { id: 'credits', label: 'Créditos API', icon: Activity },
    { id: 'diagnostics', label: 'Diagnóstico', icon: Shield },
  ];

  const PLAN_COLORS: Record<string, string> = {
    standard: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    express: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    premium: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  };
  const PlanBadge = ({ plan }: { plan?: string }) => {
    if (!plan) return null;
    const color = PLAN_COLORS[plan.toLowerCase()] || 'bg-stone-700/50 text-stone-400 border-stone-700';
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${color} whitespace-nowrap uppercase`}>{plan}</span>;
  };

  const DiagBadge = ({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) => (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${ok ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
      <div className={`mt-0.5 w-4 h-4 shrink-0 ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
        {ok ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
      </div>
      <div>
        <p className={`text-xs font-mono font-bold ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</p>
        {detail && <p className="text-[10px] text-stone-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );

  const Pagination = ({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (n: number) => void }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-center gap-2 py-3">
        <button onClick={() => setPage(1)} disabled={page <= 1} className="px-2 py-1 text-[10px] font-mono text-stone-500 bg-stone-900 border border-stone-800 rounded-lg hover:text-amber-400 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer">«</button>
        <button onClick={() => setPage(page - 1)} disabled={page <= 1} className="px-2 py-1 text-[10px] font-mono text-stone-500 bg-stone-900 border border-stone-800 rounded-lg hover:text-amber-400 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer">‹</button>
        <span className="text-[10px] font-mono text-stone-500 px-2">{page} / {totalPages}</span>
        <button onClick={() => setPage(page + 1)} disabled={page >= totalPages} className="px-2 py-1 text-[10px] font-mono text-stone-500 bg-stone-900 border border-stone-800 rounded-lg hover:text-amber-400 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer">›</button>
        <button onClick={() => setPage(totalPages)} disabled={page >= totalPages} className="px-2 py-1 text-[10px] font-mono text-stone-500 bg-stone-900 border border-stone-800 rounded-lg hover:text-amber-400 disabled:opacity-30 disabled:cursor-default transition-colors cursor-pointer">»</button>
      </div>
    );
  };

  const REJECT_TEMPLATES = [
    { label: 'Comprovativo ilegível', value: 'O comprovativo enviado está ilegível. Por favor, envie uma foto mais nítida do comprovativo de pagamento.' },
    { label: 'Valor incorreto', value: 'O valor do pagamento não corresponde ao plano selecionado. Por favor, verifique e envie o valor correto.' },
    { label: 'Dados incompletos', value: 'Os dados enviados estão incompletos. Por favor, preencha todos os campos obrigatórios e tente novamente.' },
  ];

  const exportCSV = async (type: string) => {
    try {
      const res = await fetch(`/api/admin/export/${type}`, { headers: apiHeaders });
      if (res.status === 401) { expireSession(); return; }
      if (!res.ok) { showToast('Erro ao exportar.', 'error'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${type}_${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
      showToast(`📥 ${type} exportado com sucesso!`);
    } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl font-mono text-sm shadow-2xl border ${
              toast.type === 'success'
                ? 'bg-emerald-900/90 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-900/90 border-rose-500/30 text-rose-300'
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification banner */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-mono text-sm shadow-2xl border bg-amber-900/90 border-amber-500/30 text-amber-300 backdrop-blur"
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proof image modal */}
      <AnimatePresence>
        {proofModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setProofModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="max-w-2xl w-full bg-stone-900 rounded-2xl overflow-hidden border border-stone-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-stone-800">
                <span className="font-mono text-xs text-stone-400 uppercase tracking-wider">Comprovativo de Pagamento</span>
                <button onClick={() => setProofModal(null)} className="text-stone-500 hover:text-white text-xs font-mono cursor-pointer">✕ Fechar</button>
              </div>
              <div className="p-4">
                {proofModal?.startsWith('https://') ? (
                  <>
                    <img
                      src={proofModal}
                      alt="Comprovativo"
                      className="w-full rounded-xl object-contain max-h-[70vh]"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <a
                      href={proofModal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center gap-2 text-xs text-amber-400 hover:underline font-mono"
                    >
                      <Download className="w-3.5 h-3.5" /> Abrir em nova aba / Descarregar
                    </a>
                  </>
                ) : (
                  <p className="text-stone-400 text-sm text-center py-8">URL do comprovativo inválida</p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout */}
      <div className="flex min-h-screen">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-stone-950/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:sticky top-0 left-0 z-50 lg:z-auto w-56 min-h-screen bg-stone-900/40 border-r border-stone-800 flex flex-col py-6 px-3 transition-transform duration-300 ease-in-out`}>
          <div className="flex items-center justify-between px-2 mb-8">
            <div className="flex items-center gap-2">
              <LogoIcon size={32} />
              <div>
                <span className="font-sans text-base font-black tracking-tight block leading-none">
                  <span className="text-stone-100">Seu</span><span className="bg-gradient-to-r from-amber-400 to-rose-500 bg-clip-text text-transparent">Beat</span>
                </span>
                <span className="text-[9px] text-stone-500 font-mono uppercase tracking-wider">Admin Panel</span>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 text-stone-500 hover:text-stone-100 transition-colors touch-target"
              aria-label="Fechar menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="space-y-1 flex-grow">
            {navItems.map(item => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as AdminView)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer text-left ${
                    isActive
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-800/50'
                  }`}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                  {item.id === 'dashboard' && notifDot ? (
                    <span className="ml-auto w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Novas atividades" />
                  ) : item.id === 'payments' && stats?.pendingPayments ? (
                    <span className="ml-auto bg-amber-500 text-stone-950 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {stats.pendingPayments}
                    </span>
                  ) : item.id === 'credits' && credits && (credits.suno.low || credits.claude.quota_exceeded || (credits.openai && !credits.openai.ok)) ? (
                    <span className="ml-auto w-2 h-2 rounded-full bg-rose-500 animate-pulse" title="API com créditos baixos" />
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 px-2 space-y-2">
            <button
              onClick={() => { fetchStats(); if (activeView === 'payments') fetchPayments(); else if (activeView === 'requests') { fetchRequests(); fetchProgress(); } else if (activeView === 'songs') fetchSongs(); else if (activeView === 'credits') fetchCredits(); else if (activeView === 'diagnostics') fetchDiagnostics(); else if (activeView === 'metrics') fetchMetrics(); else if (activeView === 'clients') fetchClientsList(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-300 hover:bg-stone-800/50 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar Dados
            </button>
            <button
              onClick={() => { setAuthenticated(false); sessionStorage.removeItem('seubeat_admin_token'); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 max-w-6xl min-w-0">
          <div className="flex items-center gap-3 mb-4 lg:hidden">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 text-stone-400 hover:text-stone-100 bg-stone-900/60 rounded-xl border border-stone-800 transition-colors touch-target"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono text-stone-500 uppercase tracking-wider">Admin Panel</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
            >

              {/* DASHBOARD */}
              {activeView === 'dashboard' && (
                <div className="space-y-6">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-stone-100">Dashboard</h1>
                    <p className="text-stone-500 text-sm mt-1">Visão geral do negócio SeuBeat</p>
                  </div>

                  {stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <StatCard icon={Users} label="Total Clientes" value={stats.totalUsers} color="bg-blue-500/15 text-blue-400" />
                      <StatCard icon={Music} label="Total Pedidos" value={stats.totalRequests} color="bg-purple-500/15 text-purple-400" />
                      <StatCard icon={Clock} label="Pagamentos Pendentes" value={stats.pendingPayments} color="bg-amber-500/15 text-amber-400" subtitle="Aguardando verificação" />
                      <StatCard icon={CheckCircle} label="Pagamentos Aprovados" value={stats.approvedPayments} color="bg-emerald-500/15 text-emerald-400" />
                      <StatCard icon={TrendingUp} label="Receita Total" value={stats.totalRevenue} color="bg-rose-500/15 text-rose-400" subtitle="Pagamentos aprovados" />
                      <StatCard icon={Sparkles} label="Músicas Geradas" value={stats.musicGenerated} color="bg-amber-500/15 text-amber-400" subtitle="Com áudio Suno" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 text-stone-600 animate-spin" />
                    </div>
                  )}

                  {stats && (
                    <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                      <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">Pedidos por Estado</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(stats.requestsByStatus).map(([status, count]) => (
                          <div key={status} className="bg-stone-950 rounded-xl p-3 border border-stone-800">
                            <StatusBadge status={status} />
                            <p className="text-xl font-mono font-bold text-stone-100 mt-2">{count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAYMENTS */}
              {activeView === 'payments' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Pagamentos</h1>
                      <p className="text-stone-500 text-sm mt-1">Gerir comprovativos e aprovações</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => exportCSV('payments')} className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 border border-stone-800 text-stone-400 text-xs rounded-xl hover:text-emerald-400 hover:border-emerald-500/30 transition-colors cursor-pointer font-mono">
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                      <button onClick={fetchPayments} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : !paginatedPayments.length ? (
                    <div className="text-center py-16 text-stone-600 font-mono text-sm">{paymentSearchQuery ? 'Nenhum pagamento corresponde à pesquisa.' : 'Nenhum pagamento encontrado.'}</div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                          <input
                            type="text"
                            value={paymentSearchQuery}
                            onChange={e => setPaymentSearchQuery(e.target.value)}
                            placeholder="Pesquisar por email, plano, estado, destinatário..."
                            className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-300 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                          />
                        </div>
                        {paymentSearchQuery && (
                          <button onClick={() => setPaymentSearchQuery('')} className="text-xs text-stone-500 hover:text-stone-300 font-mono cursor-pointer shrink-0">
                            Limpar
                          </button>
                        )}
                        <select value={paySort} onChange={e => setPaySort(e.target.value)} className="bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2.5 text-[10px] text-stone-400 focus:outline-none focus:border-amber-500/50 transition-colors font-mono">
                          <option value="created_at_desc">Mais recentes</option>
                          <option value="created_at_asc">Mais antigos</option>
                          <option value="email_asc">Email A-Z</option>
                          <option value="email_desc">Email Z-A</option>
                          <option value="plan_asc">Plano A-Z</option>
                          <option value="status_asc">Estado</option>
                        </select>
                      </div>
                      <Pagination page={payPage} totalPages={payTotalPages} setPage={setPayPage} />
                      <div className="space-y-3">
                      {paginatedPayments.map(payment => {
                        const phone = payment.song_requests?.users?.phone || '';
                        const waMsg = encodeURIComponent(`Olá! O seu pagamento no SeuBeat foi ${payment.status === 'approved' ? 'aprovado ✅' : 'rejeitado ❌'}.`);
                        return (
                        <div key={payment.id} className="bg-stone-900/50 border border-stone-800 rounded-2xl overflow-hidden">
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-800/30 transition-colors"
                            onClick={() => setExpandedPayment(expandedPayment === payment.id ? null : payment.id)}
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <CreditCard className="w-4 h-4 text-amber-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-stone-200 truncate">{payment.user_email}</p>
                                <p className="text-[10px] font-mono text-stone-500">{payment.plan} • {payment.amount} • {formatDate(payment.created_at)}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <StatusBadge status={payment.status} />
                              {expandedPayment === payment.id ? <ChevronDown className="w-4 h-4 text-stone-500" /> : <ChevronRight className="w-4 h-4 text-stone-500" />}
                            </div>
                          </div>

                          <AnimatePresence>
                            {expandedPayment === payment.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-stone-800 overflow-hidden"
                              >
                                <div className="p-4 space-y-4">
                                  {/* Recipient info */}
                                  {payment.song_requests && (
                                    <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                      <p className="text-stone-500 font-mono mb-1 uppercase tracking-wider text-[9px]">Pedido Associado</p>
                                      <p className="text-stone-300"><strong>Para:</strong> {payment.song_requests.recipient_name}</p>
                                      <p className="text-stone-400"><strong>Ocasião:</strong> {payment.song_requests.occasion} • <strong>Estilo:</strong> {payment.song_requests.music_style}</p>
                                      <StatusBadge status={payment.song_requests.status} />
                                    </div>
                                  )}

                                  {/* Proof */}
                                  {(payment.proof_path || payment.proof_url) ? (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Comprovativo Anexado:</p>
                                      <button
                                        onClick={async () => {
                                          try {
                                            const res = await fetch(`/api/admin/payment/${payment.id}/proof-url`, {
                                              headers: apiHeaders
                                            });
                                            if (res.status === 401) { expireSession(); return; }
                                            const data = await res.json();
                                            if (data.url) setProofModal(data.url);
                                            else showToast('Erro ao carregar comprovativo.', 'error');
                                          } catch {
                                            showToast('Erro de ligação ao servidor.', 'error');
                                          }
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-stone-950 border border-stone-800 hover:border-amber-500/40 rounded-xl text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        Ver Comprovativo ({payment.proof_filename || 'comprovativo'})
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                      Nenhum comprovativo anexado
                                    </div>
                                  )}

                                  {/* WhatsApp notification */}
                                  {phone && (
                                    <a
                                      href={`https://wa.me/${phone.replace(/\D/g, '')}?text=${waMsg}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl hover:bg-emerald-500/20 transition-colors font-mono w-fit"
                                    >
                                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                      Notificar via WhatsApp
                                    </a>
                                  )}

                                  {/* Notes for rejection */}
                                  {payment.notes && (
                                    <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                      <p className="text-stone-500 font-mono text-[9px] uppercase mb-1">Notas:</p>
                                      <p className="text-stone-400">{payment.notes}</p>
                                    </div>
                                  )}

                                  {payment.status === 'rejected' && (
                                    <div className="flex items-center justify-between text-xs text-rose-400 font-mono bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">
                                      <div className="flex items-center gap-2">
                                        <XCircle className="w-4 h-4" />
                                        Rejeitado
                                      </div>
                                      <button
                                        onClick={async () => {
                                          if (!confirm('Tem a certeza que quer desfazer esta rejeição?')) return;
                                          setActionLoading(payment.id + '_undo');
                                          try {
                                            const res = await fetch('/api/admin/undo', {
                                              method: 'POST', headers: apiHeaders,
                                              body: JSON.stringify({ entityType: 'payment', entityId: payment.id, action: 'reject' })
                                            });
                                            const data = await res.json();
                                            if (res.ok) { showToast('↩️ ' + (data.message || 'Rejeição desfeita.')); fetchPayments(); fetchStats(); }
                                            else if (res.status === 401) { expireSession(); }
                                            else showToast(data.error || 'Erro ao desfazer.', 'error');
                                          } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
                                          setActionLoading(null);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-stone-800 hover:bg-emerald-500/20 border border-stone-700 text-emerald-400 text-[10px] rounded-lg transition-colors cursor-pointer font-mono"
                                      >
                                        {actionLoading === payment.id + '_undo' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Desfazer Rejeição
                                      </button>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  {payment.status === 'pending_verification' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1.5">Motivo de Rejeição</label>
                                        <input
                                          type="text"
                                          value={rejectNotes[payment.id] || ''}
                                          onChange={e => setRejectNotes(prev => ({ ...prev, [payment.id]: e.target.value }))}
                                          placeholder="Ex: Comprovativo ilegível, valor incorreto..."
                                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-rose-500/50 transition-colors font-mono"
                                        />
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {REJECT_TEMPLATES.map(t => (
                                          <button
                                            key={t.value}
                                            onClick={() => setRejectNotes(prev => ({ ...prev, [payment.id]: t.value }))}
                                            className="px-2.5 py-1.5 bg-stone-800 border border-stone-700 text-stone-400 text-[10px] rounded-xl hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer font-mono"
                                          >
                                            {t.label}
                                          </button>
                                        ))}
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => setConfirmAction({ action: 'approve', paymentId: payment.id })}
                                          disabled={actionLoading === payment.id + '_approve'}
                                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                        >
                                          {actionLoading === payment.id + '_approve' ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <CheckCircle className="w-3.5 h-3.5" />
                                          )}
                                          Aprovar + Gerar Música (Suno)
                                        </button>
                                        <button
                                          onClick={() => setConfirmAction({ action: 'reject', paymentId: payment.id })}
                                          disabled={actionLoading === payment.id + '_reject'}
                                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-900/50 hover:bg-rose-800/50 border border-rose-800/50 disabled:opacity-50 text-rose-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                        >
                                          {actionLoading === payment.id + '_reject' ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <XCircle className="w-3.5 h-3.5" />
                                          )}
                                          Rejeitar
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {payment.status === 'approved' && (
                                    <div className="flex items-center justify-between text-xs text-emerald-400 font-mono bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                      <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4" />
                                        Aprovado em {formatDate(payment.approved_at || '')}
                                      </div>
                                      <button
                                        onClick={async () => {
                                          if (!confirm('Tem a certeza que quer desfazer esta aprovação?')) return;
                                          setActionLoading(payment.id + '_undo');
                                          try {
                                            const res = await fetch('/api/admin/undo', {
                                              method: 'POST', headers: apiHeaders,
                                              body: JSON.stringify({ entityType: 'payment', entityId: payment.id, action: 'approve' })
                                            });
                                            const data = await res.json();
                                            if (res.ok) { showToast('↩️ ' + (data.message || 'Acção desfeita.')); fetchPayments(); fetchStats(); }
                                            else if (res.status === 401) { expireSession(); }
                                            else showToast(data.error || 'Erro ao desfazer.', 'error');
                                          } catch (e: any) { showToast(e.message || 'Erro de ligação.', 'error'); }
                                          setActionLoading(null);
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 bg-stone-800 hover:bg-rose-500/20 border border-stone-700 text-rose-400 text-[10px] rounded-lg transition-colors cursor-pointer font-mono"
                                      >
                                        {actionLoading === payment.id + '_undo' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Desfazer
                                      </button>
                                    </div>
                                  )}

                                  <button onClick={() => { setForceStatusModal({ id: payment.id, table: 'payments', currentStatus: payment.status }); setForceStatusValue(''); }} className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl hover:bg-rose-500/20 transition-colors cursor-pointer font-mono">
                                    <AlertTriangle className="w-3 h-3" /> Forçar Estado
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                      </div>
                    );
                  })}
                      </div>
                      <Pagination page={payPage} totalPages={payTotalPages} setPage={setPayPage} />
                    </div>
                  )}
                </div>
              )}

              {/* REQUESTS */}
              {activeView === 'requests' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Pedidos</h1>
                      <p className="text-stone-500 text-sm mt-1">Todos os pedidos de música recebidos</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => exportCSV('requests')} className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 border border-stone-800 text-stone-400 text-xs rounded-xl hover:text-emerald-400 hover:border-emerald-500/30 transition-colors cursor-pointer font-mono">
                        <Download className="w-3.5 h-3.5" /> CSV
                      </button>
                      <button onClick={() => { fetchRequests(); fetchProgress(); }} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </button>
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-600" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar por nome, email, estado, estilo..."
                        className="w-full bg-stone-950 border border-stone-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-stone-300 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                      />
                    </div>
                    <select
                      value={searchFilter}
                      onChange={e => setSearchFilter(e.target.value as any)}
                      className="bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-400 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                    >
                      <option value="all">Todos</option>
                      <option value="name">Nome</option>
                      <option value="email">Email</option>
                      <option value="status">Estado</option>
                      <option value="style">Estilo</option>
                      <option value="occasion">Ocasião</option>
                      <option value="relationship">Relação</option>
                    </select>
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-xs text-stone-500 hover:text-stone-300 font-mono cursor-pointer">
                        Limpar
                      </button>
                    )}
                    <select value={reqSort} onChange={e => setReqSort(e.target.value)} className="bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2.5 text-[10px] text-stone-400 focus:outline-none focus:border-amber-500/50 transition-colors font-mono">
                      <option value="created_at_desc">Mais recentes</option>
                      <option value="created_at_asc">Mais antigos</option>
                      <option value="name_asc">Nome A-Z</option>
                      <option value="name_desc">Nome Z-A</option>
                      <option value="status_asc">Estado</option>
                    </select>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : (<>
                    <Pagination page={reqPage} totalPages={reqTotalPages} setPage={setReqPage} />
                    <div className="space-y-3">
                      {paginatedRequests.map(req => {
                        const plan = req.payments?.[0]?.plan;
                        const progress = progressMap[req.id];
                        const isExpanded = expandedRequest === req.id;
                        const song = req.songs?.[0];
                        return (
                          <div key={req.id} className="bg-stone-900/50 border border-stone-800 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-stone-800/20 transition-colors" onClick={() => setExpandedRequest(isExpanded ? null : req.id)}>
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                  <Music className="w-4 h-4 text-purple-400" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-stone-200">{req.users?.name || '—'}</p>
                                    <span className="text-stone-600 text-xs">→</span>
                                    <p className="text-sm text-stone-400">{req.recipient_name}</p>
                                    {plan && <PlanBadge plan={plan} />}
                                  </div>
                                  <p className="text-[10px] font-mono text-stone-500">{req.occasion} • {req.music_style} • {req.users?.email}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={req.status} />
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-stone-500" /> : <ChevronRight className="w-4 h-4 text-stone-500" />}
                              </div>
                            </div>

                            {/* Progress bar */}
                            {progress && (
                              <div className="px-4 pb-2">
                                <div className="bg-stone-950 rounded-xl p-3 border border-stone-800">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <p className="text-[10px] font-mono text-stone-400">{progress.message}</p>
                                    <span className="text-[10px] font-mono text-stone-500">{progress.progress}%</span>
                                  </div>
                                  <div className="w-full bg-stone-800 rounded-full h-1.5">
                                    <div className={`h-1.5 rounded-full transition-all duration-500 ${progress.status === 'failed' ? 'bg-rose-500' : progress.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${progress.progress}%` }} />
                                  </div>
                                  {progress.error && <p className="text-[10px] text-rose-400 font-mono mt-1.5">❌ {progress.error}</p>}
                                </div>
                              </div>
                            )}

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="border-t border-stone-800 overflow-hidden">
                                  <div className="p-4 space-y-3">
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div className="bg-stone-950 rounded-xl p-3 border border-stone-800">
                                        <p className="text-stone-500 font-mono text-[9px] uppercase mb-1">Relação</p>
                                        <p className="text-stone-300">{req.relationship}</p>
                                      </div>
                                      <div className="bg-stone-950 rounded-xl p-3 border border-stone-800">
                                        <p className="text-stone-500 font-mono text-[9px] uppercase mb-1">Plano Pago</p>
                                        <div className="flex items-center gap-1.5">{plan ? <PlanBadge plan={plan} /> : <span className="text-stone-600">—</span>}
                                          {req.payments?.[0]?.amount && <span className="text-stone-500 text-[10px]">({req.payments[0].amount})</span>}</div>
                                      </div>
                                    </div>
                                    {song && (
                                      <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                        <p className="text-stone-500 font-mono text-[9px] uppercase mb-1">Música Associada</p>
                                        <p className="text-stone-300 font-serif font-bold">{song.title}</p>
                                        <div className="flex items-center gap-2 mt-1"><StatusBadge status={song.mureka_status || 'not_started'} /></div>
                                      </div>
                                    )}
                                    {/* Style Editor */}
                                    <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                      <p className="text-stone-500 font-mono text-[9px] uppercase mb-2">✏️ Editor de Estilo & Voz</p>
                                      <div className="flex gap-2 items-center">
                                        <select
                                          defaultValue={req.music_style}
                                          onChange={e => handleUpdateStyle(req.id, e.target.value)}
                                          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-300 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                                        >
                                          {['Kizomba', 'Semba', 'Afrobeat', 'Gospel', 'Acoustic', 'Romantic Pop', 'Zouk', 'Balada', 'Pop', 'R&B', 'Rap', 'Funk', 'Trap', 'Reggae', 'Samba', 'Hino'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                          ))}
                                        </select>
                                        <select
                                          defaultValue={req.voice_type}
                                          onChange={e => handleUpdateStyle(req.id, undefined, e.target.value)}
                                          className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-2.5 py-2 text-xs text-stone-300 focus:outline-none focus:border-amber-500/50 transition-colors font-mono"
                                        >
                                          {['masculina', 'feminina', 'neutra'].map(v => (
                                            <option key={v} value={v}>{v}</option>
                                          ))}
                                        </select>
                                        <span className="text-stone-600 text-[9px]">(auto-save)</span>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                      <button onClick={() => handleRetry(req.id)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer font-mono transition-colors">
                                        {actionLoading === req.id + '_retry' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Tentar Novamente
                                      </button>
                                      {req.voice_sample_url && (
                                        <button onClick={() => handleForceVoice(req.id)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs rounded-xl hover:bg-purple-500/20 disabled:opacity-50 cursor-pointer font-mono transition-colors">
                                          {actionLoading === req.id + '_voice' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mic className="w-3 h-3" />} Forçar Voz
                                        </button>
                                      )}
                                      <button onClick={() => handleResendEmail(req.id)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-xl hover:bg-blue-500/20 disabled:opacity-50 cursor-pointer font-mono transition-colors">
                                        {actionLoading === req.id + '_email' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />} Reenviar Email
                                      </button>
                                      <button onClick={() => { setForceStatusModal({ id: req.id, table: 'song_requests', currentStatus: req.status }); setForceStatusValue(''); }} className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl hover:bg-rose-500/20 disabled:opacity-50 cursor-pointer font-mono transition-colors">
                                        <AlertTriangle className="w-3 h-3" /> Forçar Estado
                                      </button>
                                      <button onClick={() => handleRegenerateLyrics(req.id)} disabled={!!actionLoading} className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-xl hover:bg-amber-500/20 disabled:opacity-50 cursor-pointer font-mono transition-colors">
                                        {actionLoading === req.id + '_reg' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Regenerar Letra
                                      </button>
                                      <button onClick={() => fetchLogs(req.id)} className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-stone-300 transition-colors cursor-pointer font-mono">
                                        <List className="w-3 h-3" /> Logs
                                      </button>
                                      {req.songs?.[0] && (
                                        <>
                                          <button onClick={() => setPreviewLyrics({ title: req.songs![0].title, lyrics: req.songs![0].lyrics || [], letterText: req.songs![0].letter_text })} className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-blue-400 transition-colors cursor-pointer font-mono">
                                            <FileText className="w-3 h-3" /> Pré-visualizar Letra
                                          </button>
                                          <a
                                            href={`/song/${(req.recipient_name || 'especial').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')}?id=${req.songs![0].id}`}
                                            target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-2 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-amber-400 transition-colors cursor-pointer font-mono"
                                          >
                                            <ExternalLink className="w-3 h-3" /> Ver como Cliente
                                          </a>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                      {paginatedRequests.length === 0 && (
                        <div className="text-center py-12 text-stone-600 font-mono text-sm">{searchQuery ? 'Nenhum pedido corresponde à pesquisa.' : 'Nenhum pedido encontrado.'}</div>
                      )}
                    </div>
                    <Pagination page={reqPage} totalPages={reqTotalPages} setPage={setReqPage} />
                    </>)}
                </div>
              )}

              {/* SONGS */}
              {activeView === 'songs' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Músicas</h1>
                      <p className="text-stone-500 text-sm mt-1">Letras geradas e áudio Suno</p>
                    </div>
                    <button onClick={fetchSongs} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : (
                    <div className="space-y-3">
                      {songs.map(song => (
                        <div key={song.id} className="bg-stone-900/50 border border-stone-800 rounded-2xl p-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-center shrink-0">
                              <Music className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-serif text-sm font-bold text-stone-200 truncate">{song.title}</p>
                              <p className="text-[10px] font-mono text-stone-500">
                                Para: {song.song_requests?.recipient_name || '—'} • {song.song_requests?.music_style || '—'}
                              </p>
                              <p className="text-[10px] font-mono text-stone-600">{formatDate(song.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                              <StatusBadge status={song.mureka_status || 'not_started'} />
                              <button onClick={() => setEditingSong({ id: song.id, title: song.title, lyrics: (song.lyrics || []).join('\n'), letterText: song.letter_text || '' })}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer font-mono">
                                <Pencil className="w-3 h-3" /> Editar
                              </button>
                              <button onClick={() => setUploadingSongId(song.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-blue-400 hover:border-blue-500/30 transition-colors cursor-pointer font-mono">
                                <Upload className="w-3 h-3" /> Upload
                              </button>
                              <button onClick={() => { setForceStatusModal({ id: song.id, table: 'songs', currentStatus: song.mureka_status || 'not_started' }); setForceStatusValue(''); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl hover:bg-rose-500/20 transition-colors cursor-pointer font-mono">
                                <AlertTriangle className="w-3 h-3" /> Forçar
                              </button>
                              {song.song_requests && (
                                <a
                                  href={`/song/${(song.song_requests?.recipient_name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'especial'}?id=${song.id}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer font-mono"
                                >
                                  <ExternalLink className="w-3 h-3" /> Ver
                                </a>
                              )}
                              {song.lyrics && song.lyrics.length > 0 && (
                                <button onClick={() => setPreviewLyrics({ title: song.title, lyrics: song.lyrics || [], letterText: song.letter_text || '' })} className="flex items-center gap-1 px-2.5 py-1.5 bg-stone-800 border border-stone-700 text-stone-400 text-xs rounded-xl hover:text-blue-400 hover:border-blue-500/30 transition-colors cursor-pointer font-mono">
                                  <FileText className="w-3 h-3" /> Letra
                                </button>
                              )}
                              {song.audio_url || song.full_song_url || song.preview_url ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSongAudio(song)}
                                    disabled={actionLoading === song.id + '_listen_audio'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-xs rounded-xl hover:bg-emerald-600/30 transition-colors font-mono disabled:opacity-50 cursor-pointer"
                                  >
                                    {actionLoading === song.id + '_listen_audio' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-emerald-400" />} Ouvir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSongAudio(song, true)}
                                    disabled={actionLoading === song.id + '_download_audio'}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 border border-blue-600/30 text-blue-400 text-xs rounded-xl hover:bg-blue-600/30 transition-colors font-mono disabled:opacity-50 cursor-pointer"
                                  >
                                    {actionLoading === song.id + '_download_audio' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Baixar
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => handleGenerateMusic(song.id)}
                                  disabled={actionLoading === song.id + '_music' || song.mureka_status === 'generating' || song.mureka_status === 'processing'}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs rounded-xl hover:bg-amber-500/25 transition-colors disabled:opacity-50 cursor-pointer font-mono">
                                  {actionLoading === song.id + '_music' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Gerar Suno
                                </button>
                              )}
                            </div>
                          </div>
                          {/* Inline upload input */}
                          {uploadingSongId === song.id && (
                            <div className="mt-3 p-3 bg-stone-950 border border-blue-500/20 rounded-xl flex items-center gap-3">
                              <Upload className="w-4 h-4 text-blue-400 shrink-0" />
                              <input type="file" accept="audio/*" className="text-xs text-stone-400 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-blue-500/20 file:text-blue-400 cursor-pointer"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadAudio(song.id, f); }} />
                              <button onClick={() => setUploadingSongId(null)} className="text-stone-500 hover:text-stone-300 text-xs font-mono cursor-pointer">Cancelar</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {songs.length === 0 && (
                        <div className="text-center py-12 text-stone-600 font-mono text-sm">Nenhuma música encontrada.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CRÉDITOS API */}
              {activeView === 'credits' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Créditos das APIs</h1>
                      <p className="text-stone-500 text-sm mt-1">Saldo, consumo e custos reais dos serviços</p>
                    </div>
                    <button onClick={fetchCredits} disabled={creditsLoading} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 ${creditsLoading ? 'animate-spin' : ''}`} /> {creditsLoading ? 'A verificar...' : 'Atualizar'}
                    </button>
                  </div>

                  {creditsLoading && (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  )}

                  {!credits && !creditsLoading && (
                    <div className="text-center py-16 text-stone-600 font-mono text-sm">Clique em "Atualizar" para verificar os créditos.</div>
                  )}

                  {credits && !creditsLoading && (
                    <div className="space-y-5">
                      {/* API Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Suno Card */}
                        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-200">Suno AI</p>
                              <p className="text-[10px] font-mono text-stone-500">Geração de Música</p>
                            </div>
                          </div>

                          {credits.suno.ok ? (
                            <>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-mono text-stone-400">Créditos Restantes</span>
                              <span className={`text-lg font-mono font-black ${credits.suno.low ? 'text-rose-400' : credits.suno.credits < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                  {credits.suno.credits}
                                </span>
                              </div>
                              <div className="w-full bg-stone-800 rounded-full h-2">
                                <div className={`h-2 rounded-full transition-all ${credits.suno.low ? 'bg-rose-500' : credits.suno.credits < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${Math.min(100, credits.suno.credits / 10)}%` }} />
                                </div>
                                <div className="flex items-center justify-between text-[10px] font-mono">
                                  <span className={credits.suno.low ? 'text-rose-400' : 'text-stone-500'}>
                                    {credits.suno.low ? '⚠️ Créditos baixos!' : credits.suno.credits < 50 ? '⚡ A ficar baixo' : '✅ Saldo saudável'}
                                  </span>
                                  <span className="text-stone-600">
                                    ~{credits.usage?.estimatedSongsRemaining || 0} músicas
                                  </span>
                                </div>
                              </div>
                              <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono space-y-1">
                                <div className="flex justify-between text-stone-500">
                                  <span>Última verificação</span>
                                  <span className="text-stone-400">{new Date(credits.suno.lastCheck).toLocaleString('pt')}</span>
                                </div>
                                <div className="flex justify-between text-stone-500">
                                  <span>Créditos usados (est.)</span>
                                  <span className="text-stone-400">{credits.usage?.estimatedSunoCreditsUsed || 0}</span>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                              <p className="text-xs text-rose-400 font-mono">{credits.suno.error || 'Indisponível'}</p>
                            </div>
                          )}
                        </div>

                        {/* Claude Card */}
                        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-200">Anthropic Claude</p>
                              <p className="text-[10px] font-mono text-stone-500">Geração de Letras</p>
                            </div>
                          </div>

                          {credits.claude.ok ? (
                            <div className="space-y-2">
                              <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-stone-500">Modelo</span>
                                  <span className="text-xs font-mono text-stone-300">{credits.claude.model || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-stone-500">Estado</span>
                                  <span className={`text-xs font-mono font-bold ${credits.claude.quota_exceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {credits.claude.quota_exceeded ? '⚠️ Quota excedida' : '✅ Operacional'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-stone-500">Letras geradas</span>
                                  <span className="text-xs font-mono text-stone-300">{credits.usage?.totalSongs || 0}</span>
                                </div>
                              </div>
                              {credits.claude.quota_exceeded ? (
                                <p className="text-[10px] font-mono text-rose-400">A chave está sem saldo. Recarrega em console.anthropic.com</p>
                              ) : (
                                <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono">
                                  <div className="flex justify-between text-stone-500">
                                    <span>Última verificação</span>
                                    <span className="text-stone-400">{new Date(credits.claude.lastCheck).toLocaleString('pt')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                              <p className="text-xs text-rose-400 font-mono">{credits.claude.error || 'Indisponível'}</p>
                            </div>
                          )}
                        </div>

                        {/* OpenAI Card */}
                        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-200">OpenAI</p>
                              <p className="text-[10px] font-mono text-stone-500">Geração de Letras (Primário)</p>
                            </div>
                          </div>

                          {credits.openai?.ok ? (
                            <div className="space-y-2">
                              {credits.openai.total_available !== undefined ? (
                                <>
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-mono text-stone-400">Saldo Disponível</span>
                                      <span className={`text-lg font-mono font-black ${credits.openai.total_available < 1 ? 'text-rose-400' : credits.openai.total_available < 5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        ${credits.openai.total_available.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="w-full bg-stone-800 rounded-full h-2">
                                      <div className={`h-2 rounded-full transition-all ${credits.openai.total_available < 1 ? 'bg-rose-500' : credits.openai.total_available < 5 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${(credits.openai.total_granted ?? 0) > 0 ? Math.min(100, (credits.openai.total_available / (credits.openai.total_granted ?? 1)) * 100) : 100}%` }} />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-mono">
                                      <span className={credits.openai.total_available < 1 ? 'text-rose-400' : credits.openai.total_available < 5 ? 'text-amber-400' : 'text-emerald-400'}>
                                        {credits.openai.total_available < 1 ? '⚠️ Saldo baixo!' : credits.openai.total_available < 5 ? '⚡ A ficar baixo' : '✅ Saldo saudável'}
                                      </span>
                                      <span className="text-stone-600">
                                        ~{Math.floor((credits.openai.total_available || 0) / 0.01)} letras
                                      </span>
                                    </div>
                                  </div>
                                  <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono space-y-1">
                                    <div className="flex justify-between text-stone-500">
                                      <span>Total usado</span>
                                      <span className="text-stone-400">${(credits.openai.total_used || 0).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-stone-500">
                                      <span>Total concedido</span>
                                      <span className="text-stone-400">${(credits.openai.total_granted || 0).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-stone-500">Modelo</span>
                                    <span className="text-xs font-mono text-stone-300">{credits.openai.model || 'gpt-4o'}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-mono text-stone-500">Estado</span>
                                    <span className="text-xs font-mono font-bold text-emerald-400">✅ Operacional</span>
                                  </div>
                                </div>
                              )}
                              {credits.openai.lastCheck && (
                                <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono">
                                  <div className="flex justify-between text-stone-500">
                                    <span>Última verificação</span>
                                    <span className="text-stone-400">{new Date(credits.openai.lastCheck).toLocaleString('pt')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                              <p className="text-xs text-rose-400 font-mono">{credits.openai?.error || 'Indisponível'}</p>
                            </div>
                          )}
                        </div>

                        {/* Gemini Card */}
                        <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-6 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-stone-200">Google Gemini</p>
                              <p className="text-[10px] font-mono text-stone-500">Geração de Letras (Fallback)</p>
                            </div>
                          </div>

                          {credits.gemini?.ok ? (
                            <div className="space-y-2">
                              <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-stone-500">Modelo</span>
                                  <span className="text-xs font-mono text-stone-300">{credits.gemini.model || '—'}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-mono text-stone-500">Estado</span>
                                  <span className={`text-xs font-mono font-bold ${credits.gemini.quota_exceeded ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    {credits.gemini.quota_exceeded ? '⚠️ Quota excedida' : '✅ Operacional'}
                                  </span>
                                </div>
                              </div>
                              {credits.gemini.quota_exceeded ? (
                                <p className="text-[10px] font-mono text-rose-400">Quota excedida. Verifica em console.cloud.google.com</p>
                              ) : (
                                <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono">
                                  <div className="flex justify-between text-stone-500">
                                    <span>Última verificação</span>
                                    <span className="text-stone-400">{new Date(credits.gemini.lastCheck).toLocaleString('pt')}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                              <p className="text-xs text-rose-400 font-mono">{credits.gemini?.error || 'Indisponível'}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Brevo SMTP Card */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">📧 Brevo SMTP (Envios de Email)</h3>
                        {credits.email ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between bg-stone-950 rounded-xl p-4 border border-stone-800">
                              <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${credits.email.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <div>
                                  <p className="text-xs font-mono font-bold text-stone-200">{credits.email.ok ? 'Operacional' : 'Indisponível'}</p>
                                  {credits.email.ok && credits.email.provider && (
                                    <p className="text-[10px] font-mono text-stone-500">{credits.email.provider} · {credits.email.host}</p>
                                  )}
                                </div>
                              </div>
                              <span className={`text-xs font-mono font-bold ${credits.email.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {credits.email.ok ? '✅ Online' : '❌ Offline'}
                              </span>
                            </div>
                            {!credits.email.ok && credits.email.error && (
                              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                                <p className="text-xs text-rose-400 font-mono">{credits.email.error}</p>
                              </div>
                            )}
                            {credits.email.lastCheck && (
                              <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-[10px] font-mono">
                                <div className="flex justify-between text-stone-500">
                                  <span>Última verificação</span>
                                  <span className="text-stone-400">{new Date(credits.email.lastCheck).toLocaleString('pt')}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                            <p className="text-xs text-stone-500 font-mono">A aguardar verificação...</p>
                          </div>
                        )}
                      </div>

                      {/* Usage & Cost Summary */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">📊 Consumo Real</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                          <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 text-center">
                            <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Músicas Geradas</p>
                            <p className="text-xl font-bold text-stone-200">{credits.usage?.totalSongs || 0}</p>
                            <p className="text-[9px] font-mono text-stone-600">{credits.usage?.songsThisMonth || 0} este mês</p>
                          </div>
                          <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 text-center">
                            <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Créditos Suno</p>
                            <p className="text-xl font-bold text-purple-400">{credits.usage?.estimatedSunoCreditsUsed || 0}</p>
                            <p className="text-[9px] font-mono text-stone-600">usados (est.)</p>
                          </div>
                          <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 text-center">
                            <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Custo Estimado</p>
                            <p className="text-xl font-bold text-amber-400">${credits.usage?.cost?.totalUSD.toFixed(2) || '0.00'}</p>
                            <p className="text-[9px] font-mono text-stone-600">${credits.usage?.cost?.perSong.toFixed(2) || '0.00'}/música</p>
                          </div>
                          <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 text-center">
                            <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Músicas Restantes</p>
                            <p className="text-xl font-bold text-emerald-400">{credits.usage?.estimatedSongsRemaining || 0}</p>
                            <p className="text-[9px] font-mono text-stone-600">com saldo atual</p>
                          </div>
                        </div>

                        {/* Songs by month chart */}
                        {credits.usage?.songsByMonth?.length > 0 && (
                          <div>
                            <p className="text-[10px] font-mono text-stone-500 uppercase mb-2">Músicas Geradas por Mês</p>
                            <div className="space-y-1.5">
                              {credits.usage.songsByMonth.map((m: any, i: number) => {
                                const maxCount = Math.max(...credits.usage.songsByMonth.map((x: any) => x.count), 1);
                                const pct = (m.count / maxCount) * 100;
                                return (
                                  <div key={i} className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-stone-500 w-16">{m.month}</span>
                                    <div className="flex-1 bg-stone-800 rounded-full h-5 overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-violet-500 to-purple-400 rounded-full flex items-center justify-end pr-2 transition-all"
                                        style={{ width: `${pct}%`, minWidth: pct > 0 ? '2rem' : '0' }}>
                                        <span className="text-[9px] font-mono font-bold text-stone-950">{m.count}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DIAGNOSTICS */}
              {activeView === 'diagnostics' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Diagnóstico</h1>
                      <p className="text-stone-500 text-sm mt-1">Estado das APIs e serviços externos</p>
                    </div>
                    <button onClick={fetchDiagnostics} disabled={diagLoading} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 ${diagLoading ? 'animate-spin' : ''}`} /> {diagLoading ? 'A verificar...' : 'Verificar Agora'}
                    </button>
                  </div>
                  {!diagnostics && !diagLoading && (
                    <div className="text-center py-16 text-stone-600 font-mono text-sm">Clique em "Verificar Agora" para testar as APIs.</div>
                  )}
                  {diagLoading && <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>}
                  {diagnostics && !diagLoading && (
                    <div className="space-y-3">
                      <DiagBadge ok={diagnostics.supabase.ok} label="Supabase (Base de Dados & Storage)"
                        detail={diagnostics.supabase.ok ? `Buckets: ${diagnostics.supabase.buckets?.map(b => b.name).join(', ')}` : diagnostics.supabase.error} />
                      <DiagBadge ok={diagnostics.claude.ok} label="Anthropic Claude (Geração de Letras)"
                        detail={diagnostics.claude.error} />
                      <DiagBadge ok={diagnostics.openai?.ok} label="OpenAI GPT-4o (Geração de Letras)"
                        detail={diagnostics.openai?.error} />
                      <DiagBadge ok={diagnostics.gemini?.ok} label="Google Gemini (Geração de Letras)"
                        detail={diagnostics.gemini?.error} />
                      <DiagBadge ok={diagnostics.suno?.ok} label="Suno AI (Geração de Música)"
                        detail={diagnostics.suno?.ok ? `Créditos: ${diagnostics.suno?.credits || 'N/A'}` : diagnostics.suno?.error} />
                      <DiagBadge ok={diagnostics.sunoVoice?.ok} label="Suno Voice (Clonagem de Voz)"
                        detail={diagnostics.sunoVoice?.error} />
                      <DiagBadge ok={diagnostics.email.ok} label="Brevo SMTP (Envio de Emails)"
                        detail={diagnostics.email.ok ? `Servidor: ${diagnostics.email.host || 'configurado'}` : diagnostics.email.error} />
                    </div>
                  )}
                </div>
              )}

              {/* MÉTRICAS */}
              {activeView === 'metrics' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Métricas Avançadas</h1>
                      <p className="text-stone-500 text-sm mt-1">Conversão, prazos, estilos e receita</p>
                    </div>
                    <button onClick={() => { fetchMetrics(); fetchProfitability(); }} disabled={metricsLoading} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className={`w-3.5 h-3.5 ${metricsLoading ? 'animate-spin' : ''}`} /> Atualizar
                    </button>
                  </div>

                  {metricsLoading && (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  )}

                  {!metrics && !metricsLoading && (
                    <div className="text-center py-16 text-stone-600 font-mono text-sm">Clique em "Atualizar" para carregar as métricas.</div>
                  )}

                  {metrics && !metricsLoading && (
                    <div className="space-y-6">
                      {/* KPI Cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard icon={BarChart3} label="Conversão" value={metrics.conversionRate} color="bg-emerald-500/15 text-emerald-400" subtitle={`${metrics.paidRequests} de ${metrics.totalRequests} pagaram`} />
                        <StatCard icon={Clock} label="Tempo Médio (entrega)" value={`${metrics.avgDeliveryHours}h`} color="bg-blue-500/15 text-blue-400" subtitle={metrics.avgDeliveryHours > 0 ? 'Da criação à aprovação' : 'Sem dados'} />
                        <StatCard icon={TrendingUp} label="Receita Total" value={metrics.totalRevenue?.toLocaleString('pt') + ' Kz' || '0 Kz'} color="bg-rose-500/15 text-rose-400" subtitle="Pagamentos aprovados" />
                        <StatCard icon={Music} label="Pedidos Pendentes" value={metrics.pendingCount} color="bg-amber-500/15 text-amber-400" subtitle="Aguardando pagamento" />
                      </div>

                      {/* Popular Styles */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">🎵 Estilos Musicais Populares</h3>
                        {metrics.popularStyles?.length > 0 ? (
                          <div className="space-y-2">
                            {metrics.popularStyles.map((s: any, i: number) => {
                              const maxCount = metrics.popularStyles[0]?.count || 1;
                              const pct = (s.count / maxCount) * 100;
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-stone-400 w-24 text-right">{s.style}</span>
                                  <div className="flex-1 bg-stone-800 rounded-full h-4 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs font-mono text-stone-500 w-8">{s.count}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-stone-600 text-sm">Nenhum estilo registado.</p>
                        )}
                      </div>

                      {/* Monthly Revenue Chart */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">💰 Receita por Mês</h3>
                        {metrics.revenueByMonth?.length > 0 ? (
                          <div className="space-y-2">
                            {metrics.revenueByMonth.map((r: any, i: number) => {
                              const maxRev = Math.max(...metrics.revenueByMonth.map((x: any) => x.revenue), 1);
                              const pct = (r.revenue / maxRev) * 100;
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  <span className="text-xs font-mono text-stone-500 w-16">{r.month}</span>
                                  <div className="flex-1 bg-stone-800 rounded-full h-5 overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all flex items-center justify-end pr-2" style={{ width: `${pct}%`, minWidth: pct > 0 ? '2rem' : '0' }}>
                                      <span className="text-[9px] font-mono font-bold text-stone-950">{r.revenue.toLocaleString('pt')} Kz</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-stone-600 text-sm">Nenhuma receita registada.</p>
                        )}
                      </div>

                      {/* Revenue by Plan */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">📊 Receita por Plano</h3>
                        {metrics.revenueByPlan?.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {metrics.revenueByPlan.map((r: any, i: number) => {
                              const colors = ['from-amber-500 to-rose-500', 'from-emerald-500 to-teal-400', 'from-violet-500 to-purple-400'];
                              const color = colors[i % colors.length];
                              return (
                                <div key={i} className="bg-stone-950 rounded-xl p-4 border border-stone-800 text-center">
                                  <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider mb-1">{r.plan}</p>
                                  <p className={`text-lg font-bold bg-gradient-to-r ${color} bg-clip-text text-transparent`}>{r.revenue.toLocaleString('pt')} Kz</p>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-stone-600 text-sm">Nenhuma receita registada.</p>
                        )}
                      </div>

                      {/* Profitability */}
                      <div className="bg-stone-900/50 border border-stone-800 rounded-2xl p-5">
                        <h3 className="text-sm font-mono text-stone-400 uppercase tracking-wider mb-4">📈 Rentabilidade</h3>
                        {profitability && !profitLoading ? (
                          <div className="space-y-5">
                            {/* Summary cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Receita Total</p>
                                <p className="text-lg font-bold text-emerald-400">${profitability.summary.totalRevenueUSD.toFixed(2)}</p>
                                <p className="text-[9px] font-mono text-stone-600">{profitability.summary.songCount} músicas geradas</p>
                              </div>
                              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Custos API</p>
                                <p className="text-lg font-bold text-rose-400">${profitability.summary.totalCostsUSD.toFixed(2)}</p>
                                <p className="text-[9px] font-mono text-stone-600">{profitability.costs.sunoUSD > 0 ? `Suno $${profitability.costs.sunoUSD}` : ''}{profitability.costs.claudeUSD > 0 ? ` + Claude $${profitability.costs.claudeUSD}` : ''}</p>
                              </div>
                              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Lucro Líquido</p>
                                <p className={`text-lg font-bold ${profitability.summary.netProfitUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {profitability.summary.netProfitUSD >= 0 ? '+' : ''}${profitability.summary.netProfitUSD.toFixed(2)}
                                </p>
                              </div>
                              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                <p className="text-[9px] font-mono text-stone-500 uppercase mb-1">Margem</p>
                                <p className={`text-lg font-bold ${parseFloat(profitability.summary.margin) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {profitability.summary.margin}
                                </p>
                              </div>
                            </div>

                            {/* Revenue vs Cost bar */}
                            {profitability.summary.totalRevenueUSD > 0 && (
                              <div className="space-y-2">
                                <p className="text-[10px] font-mono text-stone-500 uppercase">Receita vs Custos</p>
                                <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-[10px] font-mono text-emerald-400 w-12">Receita</span>
                                    <div className="flex-1 bg-stone-800 rounded-full h-5 overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full flex items-center justify-end pr-2" style={{ width: '100%', minWidth: '2rem' }}>
                                        <span className="text-[8px] font-mono font-bold text-stone-950">${profitability.summary.totalRevenueUSD.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-mono text-rose-400 w-12">Custos</span>
                                    <div className="flex-1 bg-stone-800 rounded-full h-5 overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full flex items-center justify-end pr-2" style={{ width: `${Math.min((profitability.summary.totalCostsUSD / profitability.summary.totalRevenueUSD) * 100, 100)}%`, minWidth: '2rem' }}>
                                        <span className="text-[8px] font-mono font-bold text-stone-950">${profitability.summary.totalCostsUSD.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Cost breakdown per song */}
                            {profitability.summary.songCount > 0 && (
                              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800">
                                <p className="text-[10px] font-mono text-stone-500 uppercase mb-2">Custo por Música</p>
                                <div className="grid grid-cols-3 gap-3 text-center">
                                  <div>
                                    <p className="text-[18px] font-bold text-amber-400">${profitability.costs.costPerSong.suno}</p>
                                    <p className="text-[9px] font-mono text-stone-500">Suno (2 créditos)</p>
                                  </div>
                                  <div>
                                    <p className="text-[18px] font-bold text-violet-400">${profitability.costs.costPerSong.claude}</p>
                                    <p className="text-[9px] font-mono text-stone-500">Claude (letra)</p>
                                  </div>
                                  <div>
                                    <p className="text-[18px] font-bold text-stone-300">${profitability.costs.costPerSong.total}</p>
                                    <p className="text-[9px] font-mono text-stone-500">Total</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* By plan */}
                            {profitability.byPlan?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-mono text-stone-500 uppercase mb-2">Lucro por Plano</p>
                                <div className="space-y-2">
                                  {profitability.byPlan.map((pl: any, i: number) => {
                                    const maxRev = Math.max(...profitability.byPlan.map((x: any) => x.revenueUSD), 1);
                                    return (
                                      <div key={i} className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-stone-300 font-medium capitalize">{pl.plan}</span>
                                          <span className={`font-mono font-bold ${pl.profitUSD >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {pl.profitUSD >= 0 ? '+' : ''}${pl.profitUSD.toFixed(2)}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-mono text-stone-500">
                                          <span>💰 ${pl.revenueUSD.toFixed(2)}</span>
                                          <span>→</span>
                                          <span>💸 ${pl.costUSD.toFixed(2)}</span>
                                          <span>•</span>
                                          <span>{pl.songCount} músicas</span>
                                        </div>
                                        <div className="mt-1.5 w-full bg-stone-800 rounded-full h-1.5 overflow-hidden">
                                          <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full" style={{ width: `${(pl.revenueUSD / maxRev) * 100}%` }} />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Note */}
                            <p className="text-[9px] font-mono text-stone-600 text-center">Receita convertida de Kz para USD (taxa: 1 USD ≈ 900 Kz). Custos baseados nas env vars.</p>
                          </div>
                        ) : profitLoading ? (
                          <RefreshCw className="w-5 h-5 text-stone-600 animate-spin mx-auto" />
                        ) : (
                          <div className="text-center py-6 text-stone-600 font-mono text-xs">
                            <button onClick={fetchProfitability} className="text-amber-400 hover:text-amber-300 transition-colors cursor-pointer">Clique aqui</button> para carregar rentabilidade.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CLIENTS */}
              {activeView === 'clients' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Clientes</h1>
                      <p className="text-stone-500 text-sm mt-1">Base de dados de clientes registados</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={fetchClientsList} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                        <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                      </button>
                      <button onClick={() => exportCSV('clients')} className="flex items-center gap-1.5 px-3 py-2 bg-stone-900 border border-stone-800 text-stone-400 text-xs rounded-xl hover:text-emerald-400 hover:border-emerald-500/30 transition-colors cursor-pointer font-mono">
                        <Download className="w-3.5 h-3.5" /> Exportar CSV
                      </button>
                    </div>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : (
                  <div className="overflow-x-auto rounded-2xl border border-stone-800">
                    <table className="w-full text-xs min-w-[500px]">
                      <thead className="bg-stone-900/80">
                        <tr>
                          {['Nome', 'Email', 'Telefone', 'Pedidos', 'Data de Registo'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-mono text-stone-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/50">
                        {clients.map((client, i) => {
                          const songRequests = (client as any)?.song_requests || [];
                          return (
                          <tr key={client.id || i} className="hover:bg-stone-800/20 transition-colors">
                            <td className="px-4 py-3 text-stone-300 font-medium">{(client as any)?.name || '—'}</td>
                            <td className="px-4 py-3 text-stone-400 font-mono">{(client as any)?.email || '—'}</td>
                            <td className="px-4 py-3 text-stone-400 font-mono">{(client as any)?.phone || '—'}</td>
                            <td className="px-4 py-3 text-stone-400">{songRequests.length}</td>
                            <td className="px-4 py-3 text-stone-600 font-mono text-[10px]">{formatDate((client as any)?.created_at || '')}</td>
                          </tr>
                          );
                        })}
                        {!loading && clients.length === 0 && (
                          <tr><td colSpan={5} className="text-center py-8 text-stone-600 text-sm">Nenhum cliente encontrado.</td></tr>
                        )}
                      </tbody>
                    </table>
                    <div className="text-center py-4">
                      <button onClick={fetchClientsList} className="text-xs text-amber-400 hover:underline cursor-pointer font-mono">
                        {clients.length > 0 ? `Atualizar (${clients.length} clientes)` : 'Carregar clientes'}
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {/* Lyrics Editor Modal */}
      <AnimatePresence>
        {editingSong && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setEditingSong(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="max-w-2xl w-full bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-amber-400" />
                  <span className="font-mono text-sm text-stone-300 uppercase tracking-wider">Editar Música</span>
                </div>
                <button onClick={() => setEditingSong(null)} className="text-stone-500 hover:text-white text-xs font-mono cursor-pointer">✕ Fechar</button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1.5">Título da Música</label>
                  <input
                    type="text"
                    value={editingSong.title}
                    onChange={e => setEditingSong(s => s ? { ...s, title: e.target.value } : null)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-stone-100 text-sm focus:outline-none focus:border-amber-500 transition-colors font-serif"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1.5">Letra (uma estrofe por linha)</label>
                  <textarea
                    rows={10}
                    value={editingSong.lyrics}
                    onChange={e => setEditingSong(s => s ? { ...s, lyrics: e.target.value } : null)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-300 text-xs font-mono focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1.5">Texto da Dedicatória</label>
                  <textarea
                    rows={4}
                    value={editingSong.letterText}
                    onChange={e => setEditingSong(s => s ? { ...s, letterText: e.target.value } : null)}
                    className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-stone-300 text-xs font-mono focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleSaveLyrics}
                    disabled={actionLoading === 'lyrics_' + editingSong.id}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 text-sm font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {actionLoading === 'lyrics_' + editingSong.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Guardar Alterações
                  </button>
                  <button onClick={() => setEditingSong(null)} className="px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-sm rounded-xl transition-colors cursor-pointer">
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Modal */}
      <AnimatePresence>
        {logsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setLogsModal(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-amber-400" />
                  <h3 className="font-serif text-lg font-bold text-stone-100">Histórico do Pedido</h3>
                </div>
                <button onClick={() => setLogsModal(null)} className="text-stone-500 hover:text-white text-xs font-mono cursor-pointer">✕ Fechar</button>
              </div>

              {logsModal.loading ? (
                <div className="flex items-center justify-center h-32"><RefreshCw className="w-5 h-5 text-stone-600 animate-spin" /></div>
              ) : logsModal.logs.length === 0 ? (
                <p className="text-center text-stone-500 text-sm py-8">Nenhum evento registado.</p>
              ) : (
                <div className="space-y-0">
                  {logsModal.logs.map((log, i) => (
                    <div key={i} className="flex gap-3 py-3 border-b border-stone-800 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-stone-300 font-medium">{log.event}</p>
                        {log.detail && <p className="text-[10px] text-stone-500 font-mono mt-0.5">{log.detail}</p>}
                        <p className="text-[9px] text-stone-600 font-mono mt-0.5">{formatDate(log.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Lyrics Modal */}
      <AnimatePresence>
        {previewLyrics && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setPreviewLyrics(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-6 w-full max-w-xl space-y-4 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <h3 className="font-serif text-lg font-bold text-stone-100">{previewLyrics.title}</h3>
                </div>
                <button onClick={() => setPreviewLyrics(null)} className="text-stone-500 hover:text-white text-xs font-mono cursor-pointer">✕ Fechar</button>
              </div>

              <div className="bg-stone-950 rounded-xl p-4 border border-stone-800 space-y-3">
                {previewLyrics.lyrics.map((line, i) => (
                  <p key={i} className={`text-sm font-mono leading-relaxed ${line.startsWith('[') ? 'text-amber-400 font-bold mt-4' : 'text-stone-300'}`}>
                    {line}
                  </p>
                ))}
              </div>

              {previewLyrics.letterText && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                  <p className="text-[10px] font-mono text-amber-500 uppercase tracking-wider mb-2">Dedicatória</p>
                  <p className="text-sm text-stone-300 italic leading-relaxed">"{previewLyrics.letterText}"</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Force Status Modal */}
      <AnimatePresence>
        {forceStatusModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => { setForceStatusModal(null); setForceStatusValue(''); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-100">Forçar Estado</h3>
                  <p className="text-[10px] font-mono text-stone-500">Tabela: {forceStatusModal.table}</p>
                </div>
              </div>

              <p className="text-xs text-stone-400">Estado atual: <span className="font-mono text-stone-300">{forceStatusModal.currentStatus}</span></p>

              <select
                value={forceStatusValue}
                onChange={e => setForceStatusValue(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2.5 text-xs text-stone-300 focus:outline-none focus:border-rose-500/50 transition-colors font-mono"
              >
                <option value="">— Selecione um estado —</option>
                {(VALID_STATUSES_FRONTEND[forceStatusModal.table] || []).map(opt => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === forceStatusModal.currentStatus}>
                    {opt.label} {opt.value === forceStatusModal.currentStatus ? '(atual)' : ''}
                  </option>
                ))}
              </select>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setForceStatusModal(null)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleForceStatus}
                  disabled={!forceStatusValue || actionLoading === forceStatusModal.id + '_force'}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {actionLoading === forceStatusModal.id + '_force' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  Forçar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Approve/Reject */}
      <AnimatePresence>
        {confirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmAction(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-6 w-full max-w-sm space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${confirmAction.action === 'approve' ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-rose-500/15 border-rose-500/30'}`}>
                  {confirmAction.action === 'approve'
                    ? <CheckCircle className="w-5 h-5 text-emerald-400" />
                    : <XCircle className="w-5 h-5 text-rose-400" />
                  }
                </div>
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-100">
                    {confirmAction.action === 'approve' ? 'Aprovar Pagamento' : 'Rejeitar Pagamento'}
                  </h3>
                  <p className="text-[10px] font-mono text-stone-500">
                    {confirmAction.action === 'approve'
                      ? 'A música será gerada e enviada ao cliente.'
                      : 'O cliente será notificado por email.'}
                  </p>
                </div>
              </div>

              <p className="text-xs text-stone-400">
                {confirmAction.action === 'approve'
                  ? 'Tem a certeza que pretende aprovar este pagamento? A música será gerada automaticamente pelo Suno e enviada ao cliente.'
                  : 'Tem a certeza que pretende rejeitar este pagamento? O cliente receberá um email com o motivo da rejeição e poderá tentar novamente.'}
              </p>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmAction.action === 'approve' ? handleConfirmApprove : handleConfirmReject}
                  className={`flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer ${
                    confirmAction.action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {confirmAction.action === 'approve' ? '✅ Sim, Aprovar' : '❌ Sim, Rejeitar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
