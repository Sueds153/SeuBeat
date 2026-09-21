import { getAdminSupabase } from '../supabase';

function adminErrorDetails(stage: string, err: unknown) {
  return {
    stage,
    message: err instanceof Error ? err.message : String(err ?? ''),
    name: err instanceof Error ? err.name : typeof err,
    at: new Date().toISOString()
  };
}

export async function updateRequestStatus(requestId: string, status: string, err?: unknown) {
  const supabase = getAdminSupabase();
  if (!supabase) throw new Error('Supabase client nao inicializado.');

  const payload: Record<string, unknown> = { status };
  if (err) payload.error_details = adminErrorDetails(status, err);

  const { error } = await supabase.from('song_requests').update(payload).eq('id', requestId);
  if (!error) return;

  if (err && /error_details/i.test(error.message || '')) {
    const { error: fallbackError } = await supabase.from('song_requests').update({ status }).eq('id', requestId);
    if (!fallbackError) return;
    throw fallbackError;
  }

  throw error;
}
