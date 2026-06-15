import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, Music, CreditCard, CheckCircle, XCircle,
  Clock, RefreshCw, Eye, LogOut, ChevronDown, ChevronRight,
  Download, Play, AlertTriangle, Sparkles, TrendingUp, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
  amount: string;
  proof_url: string | null;
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
    users?: { name: string; email: string };
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
  users?: { name: string; email: string; phone: string };
  songs?: { id: string; title: string; audio_url: string | null; mureka_status: string; created_at: string }[];
}

interface Song {
  id: string;
  title: string;
  audio_url: string | null;
  mureka_status: string;
  mureka_task_id: string | null;
  created_at: string;
  song_requests?: {
    recipient_name: string;
    music_style: string;
    occasion: string;
    users?: { name: string; email: string };
  };
}

type AdminView = 'dashboard' | 'payments' | 'requests' | 'songs' | 'clients';

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

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(() => {
    return !!sessionStorage.getItem('seubeat_admin_password');
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [adminPassword, setAdminPassword] = useState(() => {
    return sessionStorage.getItem('seubeat_admin_password') || '';
  });

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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const apiHeaders = { 'x-admin-password': adminPassword, 'Content-Type': 'application/json' };

  const fetchStats = useCallback(async () => {
    if (!adminPassword) return;
    try {
      const res = await fetch('/api/admin/stats', { headers: apiHeaders });
      if (res.ok) setStats(await res.json());
    } catch (e) { console.error(e); }
  }, [adminPassword]);

  const fetchPayments = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payments', { headers: apiHeaders });
      if (res.ok) { const d = await res.json(); setPayments(d.payments || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [adminPassword]);

  const fetchRequests = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/requests', { headers: apiHeaders });
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [adminPassword]);

  const fetchSongs = useCallback(async () => {
    if (!adminPassword) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/songs', { headers: apiHeaders });
      if (res.ok) { const d = await res.json(); setSongs(d.songs || []); }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [adminPassword]);

  useEffect(() => {
    if (!authenticated) return;
    fetchStats();
    if (activeView === 'payments') fetchPayments();
    else if (activeView === 'requests') fetchRequests();
    else if (activeView === 'songs') fetchSongs();
  }, [authenticated, activeView, fetchStats, fetchPayments, fetchRequests, fetchSongs]);

  const handleLogin = async () => {
    if (!passwordInput) {
      setAuthError('Por favor introduza a password.');
      return;
    }
    setLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'x-admin-password': passwordInput }
      });
      if (res.ok) {
        setAdminPassword(passwordInput);
        setAuthenticated(true);
        sessionStorage.setItem('seubeat_admin_password', passwordInput);
      } else if (res.status === 401) {
        setAuthError('Password incorreta. Tente novamente.');
      } else if (res.status === 500) {
        // 500 = servidor com erro interno (ex: variáveis de ambiente em falta no Render)
        setAuthError(`⚠️ Erro no servidor (500). Verifique as variáveis de ambiente no Render (SUPABASE_URL, SUPABASE_ANON_KEY, etc).`);
      } else {
        setAuthError(`Erro inesperado (${res.status}). Tente novamente.`);
      }
    } catch (e) {
      setAuthError('Erro ao ligar ao servidor. Verifique se o Render está online.');
    }
    setLoading(false);
  };

  const handleApprove = async (paymentId: string) => {
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
        showToast(data.error || 'Erro ao aprovar pagamento.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
    setActionLoading(null);
  };

  const handleReject = async (paymentId: string) => {
    const notes = rejectNotes[paymentId] || '';
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
        showToast(data.error || 'Erro ao rejeitar.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
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
        showToast(`🎵 Geração Mureka iniciada! Task: ${data.taskId}`);
        fetchSongs();
      } else {
        showToast(data.error || 'Erro ao gerar música.', 'error');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
    setActionLoading(null);
  };

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
              <p className="text-rose-400 text-xs font-mono">{authError}</p>
            )}
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-rose-600 text-stone-950 font-bold text-sm rounded-xl hover:opacity-95 transition-opacity cursor-pointer"
            >
              Entrar no Painel
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
  ];

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
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Layout */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 min-h-screen bg-stone-900/40 border-r border-stone-800 flex flex-col py-6 px-3 sticky top-0">
          <div className="px-2 mb-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-tr from-amber-500 to-rose-600 rounded-lg flex items-center justify-center text-stone-950 font-black text-xs shadow">SB</div>
              <div>
                <span className="text-sm font-bold text-stone-100 font-serif block">SeuBeat</span>
                <span className="text-[9px] text-stone-500 font-mono uppercase tracking-wider">Admin Panel</span>
              </div>
            </div>
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
                  {item.id === 'payments' && stats?.pendingPayments ? (
                    <span className="ml-auto bg-amber-500 text-stone-950 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {stats.pendingPayments}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-6 px-2 space-y-2">
            <button
              onClick={() => { fetchStats(); if (activeView === 'payments') fetchPayments(); else if (activeView === 'requests') fetchRequests(); else if (activeView === 'songs') fetchSongs(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-300 hover:bg-stone-800/50 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar Dados
            </button>
            <button
              onClick={() => { setAuthenticated(false); sessionStorage.removeItem('seubeat_admin_password'); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 hover:text-rose-400 hover:bg-rose-500/5 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 max-w-6xl">
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
                      <StatCard icon={Sparkles} label="Músicas Geradas" value={stats.musicGenerated} color="bg-amber-500/15 text-amber-400" subtitle="Com áudio Mureka" />
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
                    <button onClick={fetchPayments} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-16 text-stone-600 font-mono text-sm">Nenhum pagamento encontrado.</div>
                  ) : (
                    <div className="space-y-3">
                      {payments.map(payment => (
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
                                  {payment.proof_url ? (
                                    <div className="space-y-2">
                                      <p className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">Comprovativo Anexado:</p>
                                      <button
                                        onClick={() => setProofModal(payment.proof_url!)}
                                        className="flex items-center gap-2 px-3 py-2 bg-stone-950 border border-stone-800 hover:border-amber-500/40 rounded-xl text-xs text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        Ver Comprovativo ({payment.proof_filename || 'comprovativo'})
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                      Nenhum comprovativo anexado (pode ter sido enviado por WhatsApp)
                                    </div>
                                  )}

                                  {/* Notes for rejection */}
                                  {payment.notes && (
                                    <div className="bg-stone-950 rounded-xl p-3 border border-stone-800 text-xs">
                                      <p className="text-stone-500 font-mono text-[9px] uppercase mb-1">Notas:</p>
                                      <p className="text-stone-400">{payment.notes}</p>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  {payment.status === 'pending_verification' && (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1.5">Motivo de Rejeição (opcional)</label>
                                        <input
                                          type="text"
                                          value={rejectNotes[payment.id] || ''}
                                          onChange={e => setRejectNotes(prev => ({ ...prev, [payment.id]: e.target.value }))}
                                          placeholder="Ex: Comprovativo ilegível, valor incorreto..."
                                          className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-rose-500/50 transition-colors font-mono"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleApprove(payment.id)}
                                          disabled={actionLoading === payment.id + '_approve'}
                                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                                        >
                                          {actionLoading === payment.id + '_approve' ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                            <CheckCircle className="w-3.5 h-3.5" />
                                          )}
                                          Aprovar + Gerar Música (Mureka)
                                        </button>
                                        <button
                                          onClick={() => handleReject(payment.id)}
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
                                    <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
                                      <CheckCircle className="w-4 h-4" />
                                      Aprovado em {formatDate(payment.approved_at || '')} — Música Mureka em processamento.
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* REQUESTS */}
              {activeView === 'requests' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Pedidos</h1>
                      <p className="text-stone-500 text-sm mt-1">Todos os pedidos de música recebidos</p>
                    </div>
                    <button onClick={fetchRequests} className="flex items-center gap-2 text-xs text-stone-400 hover:text-amber-400 bg-stone-900 border border-stone-800 px-3 py-2 rounded-xl transition-colors cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Atualizar
                    </button>
                  </div>

                  {loading ? (
                    <div className="flex items-center justify-center h-40"><RefreshCw className="w-6 h-6 text-stone-600 animate-spin" /></div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-stone-800">
                      <table className="w-full text-xs">
                        <thead className="bg-stone-900/80">
                          <tr>
                            {['Cliente', 'Para', 'Relação', 'Ocasião', 'Estilo', 'Estado', 'Data'].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-[10px] font-mono text-stone-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800/50">
                          {requests.map(req => (
                            <tr key={req.id} className="hover:bg-stone-800/20 transition-colors">
                              <td className="px-4 py-3">
                                <p className="text-stone-300 font-medium">{req.users?.name || '—'}</p>
                                <p className="text-stone-600 font-mono text-[10px]">{req.users?.email || '—'}</p>
                              </td>
                              <td className="px-4 py-3 text-stone-300">{req.recipient_name}</td>
                              <td className="px-4 py-3 text-stone-400">{req.relationship}</td>
                              <td className="px-4 py-3 text-stone-400">{req.occasion}</td>
                              <td className="px-4 py-3 text-stone-400">{req.music_style}</td>
                              <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                              <td className="px-4 py-3 text-stone-600 font-mono text-[10px]">{formatDate(req.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {requests.length === 0 && (
                        <div className="text-center py-12 text-stone-600 font-mono text-sm">Nenhum pedido encontrado.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SONGS */}
              {activeView === 'songs' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="font-serif text-2xl font-bold text-stone-100">Músicas</h1>
                      <p className="text-stone-500 text-sm mt-1">Letras geradas e áudio Mureka</p>
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
                        <div key={song.id} className="bg-stone-900/50 border border-stone-800 rounded-2xl p-4 flex items-center gap-4">
                          <div className="w-10 h-10 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-center shrink-0">
                            <Music className="w-5 h-5 text-amber-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-serif text-sm font-bold text-stone-200 truncate">{song.title}</p>
                            <p className="text-[10px] font-mono text-stone-500">
                              Para: {(song.song_requests as any)?.recipient_name || '—'} • {(song.song_requests as any)?.music_style || '—'}
                            </p>
                            <p className="text-[10px] font-mono text-stone-600">{formatDate(song.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <StatusBadge status={song.mureka_status || 'not_started'} />
                            {song.audio_url ? (
                              <a href={song.audio_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/20 border border-emerald-600/30 text-emerald-400 text-xs rounded-xl hover:bg-emerald-600/30 transition-colors font-mono">
                                <Play className="w-3 h-3 fill-emerald-400" /> Ouvir
                              </a>
                            ) : (
                              <button
                                onClick={() => handleGenerateMusic(song.id)}
                                disabled={actionLoading === song.id + '_music' || song.mureka_status === 'generating' || song.mureka_status === 'processing'}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs rounded-xl hover:bg-amber-500/25 transition-colors disabled:opacity-50 cursor-pointer font-mono"
                              >
                                {actionLoading === song.id + '_music' ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Sparkles className="w-3 h-3" />
                                )}
                                Gerar Mureka
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {songs.length === 0 && (
                        <div className="text-center py-12 text-stone-600 font-mono text-sm">Nenhuma música encontrada.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CLIENTS */}
              {activeView === 'clients' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="font-serif text-2xl font-bold text-stone-100">Clientes</h1>
                    <p className="text-stone-500 text-sm mt-1">Base de dados de clientes registados</p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-stone-800">
                    <table className="w-full text-xs">
                      <thead className="bg-stone-900/80">
                        <tr>
                          {['Nome', 'Email', 'Telefone', 'Pedidos', 'Data de Registo'].map(h => (
                            <th key={h} className="text-left px-4 py-3 text-[10px] font-mono text-stone-500 uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-800/50">
                        {requests.map(req => req.users).filter(Boolean).map((user, i) => (
                          <tr key={i} className="hover:bg-stone-800/20 transition-colors">
                            <td className="px-4 py-3 text-stone-300 font-medium">{(user as any)?.name || '—'}</td>
                            <td className="px-4 py-3 text-stone-400 font-mono">{(user as any)?.email || '—'}</td>
                            <td className="px-4 py-3 text-stone-400 font-mono">{(user as any)?.phone || '—'}</td>
                            <td className="px-4 py-3 text-stone-500">—</td>
                            <td className="px-4 py-3 text-stone-600 font-mono text-[10px]">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="text-center py-4">
                      <button onClick={fetchRequests} className="text-xs text-amber-400 hover:underline cursor-pointer font-mono">
                        Carregar clientes
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
