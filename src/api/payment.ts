export async function submitPayment(data: {
  planId: string;
  amount: string;
  phone: string;
  email: string;
  recipientName: string;
}): Promise<{ success: boolean; reference?: string; error?: string }> {
  const res = await fetch('/api/submit-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}
