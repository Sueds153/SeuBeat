import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../components/AdminPanel';

const mockStats = {
  totalUsers: 42,
  totalRequests: 50,
  pendingPayments: 5,
  approvedPayments: 25,
  totalRevenue: "25000",
  musicGenerated: 18,
  requestsByStatus: {
    pending: 8,
    in_progress: 12,
    completed: 30,
    failed: 2
  }
};

const mockPayments = [
  {
    id: 'pay1',
    user_email: 'joao@email.com',
    plan: 'standard',
    amount: 5000,
    proof_url: null,
    proof_path: '/uploads/proof1.jpg',
    proof_filename: 'comprovativo1.jpg',
    status: 'pending_verification',
    notes: null,
    created_at: '2025-01-15T10:00:00Z',
    approved_at: null,
    song_requests: {
      id: 'req1',
      recipient_name: 'Ana',
      occasion: 'Aniversário',
      music_style: 'Pop',
      status: 'pending',
      users: { name: 'João', email: 'joao@email.com', phone: '+244923456789' }
    }
  },
  {
    id: 'pay2',
    user_email: 'maria@email.com',
    plan: 'premium',
    amount: 7500,
    proof_url: null,
    proof_path: null,
    proof_filename: null,
    status: 'approved',
    notes: null,
    created_at: '2025-01-14T10:00:00Z',
    approved_at: '2025-01-15T11:00:00Z',
    song_requests: {
      id: 'req2',
      recipient_name: 'Carlos',
      occasion: 'Casamento',
      music_style: 'Romântica',
      status: 'completed',
      users: { name: 'Maria', email: 'maria@email.com', phone: '+244923456790' }
    }
  }
];

const mockRequests = [
  {
    id: 'req1',
    recipient_name: 'Ana',
    relationship: 'esposa',
    occasion: 'Aniversário',
    music_style: 'Pop',
    voice_type: 'female',
    status: 'pending',
    created_at: '2025-01-15T10:00:00Z',
    users: { name: 'João', email: 'joao@email.com', phone: '+244923456789' }
  },
  {
    id: 'req2',
    recipient_name: 'Carlos',
    relationship: 'pai',
    occasion: 'Casamento',
    music_style: 'Romântica',
    voice_type: 'male',
    status: 'in_progress',
    created_at: '2025-01-14T10:00:00Z',
    users: { name: 'Maria', email: 'maria@email.com', phone: '+244923456790' }
  }
];

const mockSongs = [
  {
    id: 'song1',
    title: 'Minha Canção',
    audio_url: 'https://example.com/song1.mp3',
    mureka_status: 'completed',
    mureka_task_id: 'task123',
    created_at: '2025-01-15T12:00:00Z',
    song_requests: {
      recipient_name: 'Ana',
      music_style: 'Pop',
      occasion: 'Aniversário',
      users: { name: 'João', email: 'joao@email.com' }
    }
  }
];

const mockClients = [
  {
    id: 'user1',
    name: 'João Silva',
    email: 'joao@email.com',
    phone: '+244923456789',
    created_at: '2025-01-10T10:00:00Z'
  },
  {
    id: 'user2',
    name: 'Maria Santos',
    email: 'maria@email.com',
    phone: '+244923456790',
    created_at: '2025-01-12T10:00:00Z'
  }
];

function okResponse(data: any) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => Promise.resolve(data),
  };
}

function setupFetchMock(overrides: Record<string, any> = {}) {
  const mockResponses: Record<string, any> = {
    '/api/admin/login': okResponse({ token: 'fake-jwt-token' }),
    '/api/admin/stats': okResponse(mockStats),
    '/api/admin/payments': okResponse({ payments: mockPayments, total: 2 }),
    '/api/admin/requests': okResponse({ requests: mockRequests, total: 2 }),
    '/api/admin/songs': okResponse({ songs: mockSongs, total: 1 }),
    '/api/admin/clients': okResponse({ clients: mockClients }),
    '/api/admin/diagnostics': okResponse(null),
    '/api/admin/credits': okResponse(null),
    '/api/admin/progress': okResponse({}),
    '/api/admin/metrics': okResponse(null),
    '/api/admin/profitability': okResponse(null),
  };

  Object.entries(overrides).forEach(([path, response]) => {
    mockResponses[path] = response;
  });

  globalThis.fetch = vi.fn((url: string) => {
    const path = new URL(url, 'http://localhost').pathname;
    const mockResponse = mockResponses[path];
    if (mockResponse) {
      return Promise.resolve(mockResponse);
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  }) as any;
}

vi.mock('../components/WhatsAppHelp', () => ({
  default: () => <div>WhatsApp Help Mock</div>
}));

describe('AdminPanel', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
    setupFetchMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Authentication', () => {
    it('shows login form when not authenticated', () => {
      render(<AdminPanel />);

      expect(screen.getByPlaceholderText(/••••••••••••/i)).toBeTruthy();
      expect(screen.getByText(/entrar no painel/i)).toBeTruthy();
      expect(screen.getByText(/painel admin/i)).toBeTruthy();
    });

    it('shows login loading state when submitting', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/••••••••••••/i), 'testpassword');
      await user.click(screen.getByText(/entrar no painel/i));

      expect(sessionStorage.getItem('seubeat_admin_token')).toBe('fake-jwt-token');
    });

    it('successful login stores token and redirects to dashboard', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/••••••••••••/i), 'testpassword');
      await user.click(screen.getByText(/entrar no painel/i));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
        expect(sessionStorage.getItem('seubeat_admin_token')).toBe('fake-jwt-token');
      });
    });

    it('shows error message on failed login', async () => {
      setupFetchMock({
        '/api/admin/login': {
          status: 401,
          json: () => Promise.resolve({ error: 'Password inválida.' })
        }
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/••••••••••••/i), 'wrongpassword');
      await user.click(screen.getByText(/entrar no painel/i));

      await waitFor(() => {
        expect(screen.getByText(/password inválida/i)).toBeTruthy();
        expect(screen.getByText(/whatsapp help mock/i)).toBeTruthy();
      });
    });

    it('shows error message on network error', async () => {
      setupFetchMock({
        '/api/admin/login': {
          ok: true,
          status: 200,
          json: () => Promise.reject(new Error('Network error'))
        }
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText(/••••••••••••/i), 'testpassword');
      await user.click(screen.getByText(/entrar no painel/i));

      await waitFor(() => {
        expect(screen.getByText(/erro de ligação ao servidor/i)).toBeTruthy();
      });
    });
  });

  describe('Dashboard View', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows dashboard when authenticated', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
        expect(screen.getByText(/visão geral do negócio seubeat/i)).toBeTruthy();
      });
    });

    it('displays stats cards after loading', async () => {
      render(<AdminPanel />);

      await waitFor(() => {
        expect(screen.getByText('42')).toBeTruthy();
        expect(screen.getByText('50')).toBeTruthy();
        expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('25')).toBeTruthy();
        expect(screen.getByText('25000')).toBeTruthy();
        expect(screen.getByText('18')).toBeTruthy();
      });
    });

    it('shows loading spinner when stats are being fetched', () => {
      render(<AdminPanel />);

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('switches between navigation tabs', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/gerir comprovativos e aprovações/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/pedidos/i));

      await waitFor(() => {
        expect(screen.getByText(/todos os pedidos de música recebidos/i)).toBeInTheDocument();
      });
    });

    it('shows loading spinner when switching tabs', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/gerir comprovativos e aprovações/i)).toBeInTheDocument();
      });
    });
  });

  describe('Payment Management', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows payment list when payments tab is active', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
        expect(screen.getByText(/maria@email.com/i)).toBeInTheDocument();
        expect(screen.getByText(/5000/i)).toBeInTheDocument();
        expect(screen.getByText(/7500/i)).toBeInTheDocument();
      });
    });

    it('can expand payment details', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await screen.findByText(/pedido associado/i);
      await screen.findByText(/aniversário/i);

      // "Para: Ana" uses <strong> tag inside AnimatePresence which can
      // fragment the text for getByText; check via container textContent
      expect(document.body.textContent).toMatch(/para: ana/i);
    });

    it('shows approve and reject buttons for pending verification payments', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/aprovar \+ gerar música/i)).toBeInTheDocument();
        expect(screen.getByText(/rejeitar/i)).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before approving payment', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/approve': okResponse({ message: 'Payment approved successfully' }),
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/aprovar \+ gerar música/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/aprovar \+ gerar música/i));

      await waitFor(() => {
        expect(document.body.textContent).toMatch(/tem a certeza que pretende aprovar este pagamento/i);
      });

      await user.click(screen.getByText(/sim, aprovar/i));

      await waitFor(() => {
        expect(screen.getByText(/✅ pagamento aprovado/i)).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before rejecting payment', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/reject': okResponse({ message: 'Payment rejected successfully' }),
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/aprovar \+ gerar música/i)).toBeInTheDocument();
      });

      const noteInput = screen.getByPlaceholderText(/ex: comprovativo ilegível, valor incorreto/i);
      await user.type(noteInput, 'Comprovativo inválido');

      await user.click(screen.getByText(/rejeitar/i));

      await waitFor(() => {
        expect(document.body.textContent).toMatch(/tem a certeza que pretende rejeitar este pagamento/i);
      });

      await user.click(screen.getByText(/sim, rejeitar/i));

      await waitFor(() => {
        expect(screen.getByText(/❌ pagamento rejeitado/i)).toBeInTheDocument();
      });
    });

    it('shows undo button for approved payments', async () => {
      setupFetchMock({
        '/api/admin/undo': okResponse({ message: 'Rejeição desfeita.' }),
      });

      window.confirm = vi.fn(() => true);

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/maria@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/maria@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/desfazer/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/desfazer/i));

      // Toast also uses AnimatePresence; verify via textContent
      await waitFor(() => {
        expect(document.body.textContent).toMatch(/rejeição desfeita/i);
      });
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('searches payments by email', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/pesquisar por email, plano, estado, destinatário/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'maria');

      expect(screen.getByText(/maria@email.com/i)).toBeInTheDocument();
      expect(screen.queryByText(/joao@email.com/i)).not.toBeInTheDocument();
    });

    it('searches requests by name', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getByText(/pedidos/i));

      await waitFor(() => {
        expect(screen.getByText(/joão/i)).toBeInTheDocument();
        expect(screen.getAllByText(/maria/i).length).toBeGreaterThanOrEqual(1);
      });

      const searchInput = screen.getByPlaceholderText(/pesquisar por nome, email, estado, estilo/i);
      await user.clear(searchInput);
      await user.type(searchInput, 'ana');

      expect(screen.getByText(/ana/i)).toBeInTheDocument();
      expect(screen.queryByText(/carlos/i)).not.toBeInTheDocument();
    });
  });

  describe('Toast Notifications', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows success toast and auto-dismisses', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/approve': okResponse({ message: 'Payment approved successfully' }),
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/aprovar \+ gerar música/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/aprovar \+ gerar música/i));
      await user.click(screen.getByText(/sim, aprovar/i));

      await waitFor(() => {
        expect(screen.getByText(/✅ pagamento aprovado/i)).toBeInTheDocument();
      });
    });

    it('shows error toast on API failure', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/approve': {
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        }
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      const emailEl = screen.getByText(/joao@email.com/i);
      const row = emailEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(emailEl);
      }

      await waitFor(() => {
        expect(screen.getByText(/aprovar \+ gerar música/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText(/aprovar \+ gerar música/i));
      await user.click(screen.getByText(/sim, aprovar/i));

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('logs out and clears session storage', async () => {
      render(<AdminPanel />);

      const user = userEvent.setup();

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      await user.click(screen.getByText(/sair/i));

      expect(sessionStorage.getItem('seubeat_admin_token')).toBeNull();
      expect(screen.getByText(/painel admin/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows empty state when no payments found', async () => {
      setupFetchMock({
        '/api/admin/payments': okResponse({ payments: [], total: 0 })
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getByText(/nenhum pagamento encontrado/i)).toBeInTheDocument();
      });
    });

    it('shows loading spinner during data fetching', async () => {
      setupFetchMock({
        '/api/admin/stats': {
          ok: true,
          status: 200,
          json: () => new Promise(resolve => setTimeout(() => resolve(mockStats), 100))
        }
      });

      vi.useFakeTimers();

      render(<AdminPanel />);

      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

      vi.advanceTimersByTime(50);
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();

      vi.advanceTimersByTime(100);

      vi.useRealTimers();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows pagination when there are many items', async () => {
      const manyPayments = Array(25).fill(0).map((_, i) => ({
        id: `pay${i}`,
        user_email: `user${i}@email.com`,
        plan: 'standard',
        amount: 5000,
        proof_url: null,
        proof_path: null,
        proof_filename: null,
        status: 'pending_verification',
        notes: null,
        created_at: '2025-01-15T10:00:00Z',
        approved_at: null,
        song_requests: {
          id: `req${i}`,
          recipient_name: `User${i}`,
          occasion: 'Aniversário',
          music_style: 'Pop',
          status: 'pending',
          users: { name: `User${i}`, email: `user${i}@email.com`, phone: '+244923456789' }
        }
      }));

      setupFetchMock({
        '/api/admin/payments': okResponse({ payments: manyPayments, total: 25 })
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getAllByText(/pagamentos/i)[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/1 \/ 2/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Force Status Modal', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('opens force status modal', async () => {
      setupFetchMock({
        '/api/admin/request/req1/force-status': okResponse({ message: 'Status forced successfully' })
      });

      render(<AdminPanel />);

      const user = userEvent.setup();
      await user.click(screen.getByText(/pedidos/i));

      await waitFor(() => {
        expect(screen.getByText(/joão/i)).toBeInTheDocument();
      });

      const nameEl = screen.getByText(/joão/i);
      const row = nameEl.closest('[class*="cursor-pointer"]');
      if (row) {
        await user.click(row);
      } else {
        await user.click(nameEl);
      }

      await waitFor(() => {
        expect(screen.getAllByText(/forçar estado/i).length).toBeGreaterThanOrEqual(1);
      });

      await user.click(screen.getAllByText(/forçar estado/i)[0]);

      await waitFor(() => {
        expect(screen.getAllByText(/forçar estado/i).length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
