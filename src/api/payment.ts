import { getStoredUtm } from '../lib/utm';

export interface SubmitPaymentRequest {
  songRequestId: string | null;
  userEmail: string;
  phone: string;
  plan: string;
  amount: string;
  proofBase64: string;
  proofFilename: string;
  proofMimeType: string;
  voiceSampleBase64?: string | null;
  voiceSampleFilename?: string | null;
  voiceSampleMimeType?: string | null;
}

export interface SubmitPaymentResponse {
  success: boolean;
  paymentId?: string;
  error?: string;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
  error?: string;
}

export interface PaymentDetailsResponse {
  entidade?: string;
  referencia?: string;
  error?: string;
}

export async function submitPayment(
  data: SubmitPaymentRequest,
  signal?: AbortSignal,
): Promise<SubmitPaymentResponse> {
  const payload = { ...data, ...getStoredUtm() };
  const res = await fetch('/api/submit-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  const response: SubmitPaymentResponse = await res.json().catch(() => ({
    success: false,
    error: 'Erro na conexão ao submeter pagamento.',
  }));

  if (res.status === 409) {
    response.success = true;
  }

  return response;
}

export async function getPaymentStatus(
  email: string,
  requestId?: string,
  signal?: AbortSignal,
): Promise<PaymentStatusResponse> {
  const params = new URLSearchParams({ email });
  if (requestId) params.set('requestId', requestId);

  const res = await fetch(`/api/payment-status?${params.toString()}`, { signal });
  return res.json().catch(() => ({ status: 'pending' as const, error: 'Erro na conexão ao verificar pagamento.' }));
}

export async function getPaymentDetails(signal?: AbortSignal): Promise<PaymentDetailsResponse> {
  const res = await fetch('/api/payment-details', { signal });
  return res.json().catch(() => ({ error: 'Erro ao obter dados de pagamento.' }));
}