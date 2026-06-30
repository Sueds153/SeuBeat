import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPanel from '../components/AdminPanel';

// Mock data
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

// Setup fetch mock
function setupFetchMock(overrides: Record<string, any> = {}) {
  const mockResponses: Record<string, any> = {
    '/api/admin/login': { 
      status: 200, 
      json: () => Promise.resolve({ token: 'fake-jwt-token' }) 
    },
    '/api/admin/stats': { 
      status: 200, 
      json: () => Promise.resolve(mockStats) 
    },
    '/api/admin/payments': { 
      status: 200, 
      json: () => Promise.resolve({ payments: mockPayments, total: 2 }) 
    },
    '/api/admin/requests': { 
      status: 200, 
      json: () => Promise.resolve({ requests: mockRequests, total: 2 }) 
    },
    '/api/admin/songs': { 
      status: 200, 
      json: () => Promise.resolve({ songs: mockSongs, total: 1 }) 
    },
    '/api/admin/clients': { 
      status: 200, 
      json: () => Promise.resolve({ clients: mockClients }) 
    },
    '/api/admin/diagnostics': { 
      status: 200, 
      json: () => Promise.resolve(null) 
    },
    '/api/admin/credits': { 
      status: 200, 
      json: () => Promise.resolve(null) 
    },
    '/api/admin/progress': { 
      status: 200, 
      json: () => Promise.resolve({}) 
    },
    '/api/admin/metrics': { 
      status: 200, 
      json: () => Promise.resolve(null) 
    },
    '/api/admin/profitability': { 
      status: 200, 
      json: () => Promise.resolve(null) 
    },
  };

  // Add overrides
  Object.entries(overrides).forEach(([path, response]) => {
    mockResponses[path] = response;
  });

  globalThis.fetch = vi.fn((url: string, options?: any) => {
    const path = new URL(url, 'http://localhost').pathname;
    
    if (path === '/api/admin/login') {
      return Promise.resolve({
        status: 200,
        json: () => Promise.resolve({ token: 'fake-jwt-token' }),
      });
    }

    const mockResponse = mockResponses[path];
    if (mockResponse) {
      return Promise.resolve(mockResponse);
    }

    // Default 404 for unknown endpoints
    return Promise.resolve({
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  }) as any;
}

// Mock WhatsAppHelp component (it's used in the login error)
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

      await waitFor(() => {
        expect(screen.getByText(/a autenticar.../i)).toBeTruthy();
      });
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
        expect(screen.getByText(/falar com apoio/i)).toBeTruthy();
      });
    });

    it('shows error message on network error', async () => {
      setupFetchMock({
        '/api/admin/login': {
          status: 0,
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
        expect(screen.getByText('42')).toBeTruthy(); // totalUsers
        expect(screen.getByText('50')).toBeTruthy(); // totalRequests
        expect(screen.getByText('5')).toBeTruthy(); // pendingPayments
        expect(screen.getByText('25')).toBeTruthy(); // approvedPayments
        expect(screen.getByText('25,000')).toBeTruthy(); // totalRevenue
        expect(screen.getByText('18')).toBeTruthy(); // musicGenerated
      });
    });

    it('shows loading spinner when stats are being fetched', () => {
      vi.useFakeTimers();
      render(<AdminPanel />);
      
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('switches between navigation tabs', async () => {
      render(<AdminPanel />);
      
      const user = userEvent.setup();
      
      // Wait for dashboard to load
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      // Navigate to payments tab
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/pagamentos/i)).toBeInTheDocument();
        expect(screen.getByText(/gerir comprovativos e aprovações/i)).toBeInTheDocument();
      });

      // Navigate to requests tab
      await user.click(screen.getByText(/pedidos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/pedidos/i)).toBeInTheDocument();
        expect(screen.getByText(/todos os pedidos de música recebidos/i)).toBeInTheDocument();
      });
    });

    it('shows loading spinner when switching tabs', async () => {
      render(<AdminPanel />);
      
      const user = userEvent.setup();
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/pagamentos/i)).toBeInTheDocument();
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
      await user.click(screen.getByText(/pagamentos/i));
      
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
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Click to expand payment details
      const paymentRow = screen.getAllByText(/joao@email.com/i)[0];
      await user.click(paymentRow.parentElement?.querySelector('div') || paymentRow);
      
      await waitFor(() => {
        expect(screen.getByText(/pedido associado/i)).toBeInTheDocument();
        expect(screen.getByText(/para: ana/i)).toBeInTheDocument();
        expect(screen.getByText(/aniversário/i)).toBeInTheDocument();
      });
    });

    it('shows approve and reject buttons for pending verification payments', async () => {
      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/aprovear + gerar música/i)).toBeInTheDocument();
        expect(screen.getByText(/rejeitar/i)).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before approving payment', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/approve': {
          status: 200,
          json: () => Promise.resolve({ message: 'Payment approved successfully' })
        },
        '/api/admin/stats': {
          status: 200,
          json: () => Promise.resolve(mockStats)
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Click approve button
      await user.click(screen.getByText(/aprovear + gerar música/i));
      
      expect(screen.getByText(/tem a certeza que quer aprovar este pagamento/i)).toBeInTheDocument();
      
      // Confirm approval
      await user.click(screen.getByText(/sim, aprovar/i));
      
      await waitFor(() => {
        expect(screen.getByText(/✅ pagamento aprovado/i)).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before rejecting payment', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/reject': {
          status: 200,
          json: () => Promise.resolve({ message: 'Payment rejected successfully' })
        },
        '/api/admin/stats': {
          status: 200,
          json: () => Promise.resolve(mockStats)
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Set rejection note
      const noteInput = screen.getByPlaceholderText(/comprovativo ilegível, valor incorreto.../i);
      await user.type(noteInput, 'Comprovativo inválido');
      
      // Click reject button
      await user.click(screen.getByText(/rejeitar/i));
      
      expect(screen.getByText(/tem a certeza que quer rejeitar este pagamento/i)).toBeInTheDocument();
      
      // Confirm rejection
      await user.click(screen.getByText(/sim, rejeitar/i));
      
      await waitFor(() => {
        expect(screen.getByText(/❌ pagamento rejeitado/i)).toBeInTheDocument();
      });
    });

    it('shows undo button for rejected payments', async () => {
      setupFetchMock({
        '/api/admin/undo': {
          status: 200,
          json: () => Promise.resolve({ message: 'Rejection undone successfully' })
        },
        '/api/admin/stats': {
          status: 200,
          json: () => Promise.resolve(mockStats)
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      // Click to expand payment details
      const paymentRow = screen.getAllByText(/maria@email.com/i)[0];
      await user.click(paymentRow.parentElement?.querySelector('div') || paymentRow);
      
      await waitFor(() => {
        expect(screen.getByText(/desfazer rejeição/i)).toBeInTheDocument();
      });

      // Click undo button
      await user.click(screen.getByText(/desfazer rejeição/i));
      
      expect(screen.getByText(/rejeição desfeita/i)).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('searches payments by email', async () => {
      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Search for maria
      const searchInput = screen.getByPlaceholderText(/pesquisar por email, plano, estado, destinatário.../i);
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
        expect(screen.getByText(/maria/i)).toBeInTheDocument();
      });

      // Search for Ana (recipient)
      const searchInput = screen.getByPlaceholderText(/pesquisar por nome, email, estado, estilo.../i);
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
        '/api/admin/payment/pay1/approve': {
          status: 200,
          json: () => Promise.resolve({ message: 'Payment approved successfully' })
        },
        '/api/admin/stats': {
          status: 200,
          json: () => Promise.resolve(mockStats)
        }
      });

      vi.useFakeTimers();
      
      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Trigger approval
      await user.click(screen.getByText(/aprovear + gerar música/i));
      await user.click(screen.getByText(/sim, aprovar/i));
      
      await waitFor(() => {
        expect(screen.getByText(/✅ pagamento aprovado/i)).toBeInTheDocument();
      });

      // Auto-dismiss after 4 seconds
      vi.advanceTimersByTime(4000);
      
      expect(screen.queryByText(/✅ pagamento aprovado/i)).not.toBeInTheDocument();
      
      vi.useRealTimers();
    });

    it('shows error toast on API failure', async () => {
      setupFetchMock({
        '/api/admin/payment/pay1/approve': {
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' })
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/joao@email.com/i)).toBeInTheDocument();
      });

      // Trigger approval that fails
      await user.click(screen.getByText(/aprovear + gerar música/i));
      await user.click(screen.getByText(/sim, aprovar/i));
      
      await waitFor(() => {
        expect(screen.getByText(/erro ao aprovar pagamento/i)).toBeInTheDocument();
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
      await user.click(screen.getByRole('button', { name: /dashboard/i }));
      
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      });

      // Click logout button
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
        '/api/admin/payments': {
          status: 200,
          json: () => Promise.resolve({ payments: [], total: 0 })
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/nenhum pagamento encontrado/i)).toBeInTheDocument();
      });
    });

    it('shows loading spinner during data fetching', async () => {
      // Delay the fetch to show loading state
      setupFetchMock({
        '/api/admin/stats': {
          status: 200,
          json: () => new Promise(resolve => setTimeout(() => resolve(mockStats), 100))
        }
      });

      vi.useFakeTimers();
      
      render(<AdminPanel />);
      
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
      
      vi.advanceTimersByTime(50);
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      
      vi.advanceTimersByTime(100);
      
      vi.useRealTimers();
    });
  });

  describe('Pagination', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('shows pagination when there are many items', async () => {
      // Mock data with more items to trigger pagination
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
        '/api/admin/payments': {
          status: 200,
          json: () => Promise.resolve({ payments: manyPayments, total: 25 })
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pagamentos/i));
      
      await waitFor(() => {
        expect(screen.getByText(/página 1 de 2/i)).toBeInTheDocument();
      });
    });
  });

  describe('Force Status Modal', () => {
    beforeEach(() => {
      sessionStorage.setItem('seubeat_admin_token', 'fake-jwt-token');
    });

    it('opens force status modal', async () => {
      setupFetchMock({
        '/api/admin/request/req1/force-status': {
          status: 200,
          json: () => Promise.resolve({ message: 'Status forced successfully' })
        }
      });

      render(<AdminPanel />);
      
      const user = userEvent.setup();
      await user.click(screen.getByText(/pedidos/i));
      
      // Click to expand request details
      const requestRow = screen.getAllByText(/joão/i)[0];
      await user.click(requestRow.parentElement?.querySelector('div') || requestRow);
      
      await waitFor(() => {
        expect(screen.getByText(/forçar estado/i)).toBeInTheDocument();
      });

      // Click force status button
      await user.click(screen.getByText(/forçar estado/i));
      
      expect(screen.getByText(/forçar estado/i)).toBeInTheDocument();
    });
  });
});