import { getAdminSupabase } from '../supabase';
import { getAppUrl } from '../../utils/helpers';
import { logInfo, logWarn, logError } from '../../utils/logger';
import { sendAdminNotification, sendWorkflowFailedEmail } from '../email';

async function rollbackStorageForSong(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  songId: string,
  requestId: string,
  voiceSampleUrl?: string | null
) {
  const { deleteStorageFiles, listStorageFiles } = await import('../storage');
  
  try {
    const files = await listStorageFiles('full-audio', 'songs/');
    const matches = files.filter(f => f.name.startsWith(`${songId}`)).map(f => `songs/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles('full-audio', matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) em full-audio`, { songId });
    }
  } catch {}
  try {
    await deleteStorageFiles('preview', [`previews/${songId}_preview.mp3`]);
  } catch {}
  try {
    const voiceFiles = await listStorageFiles('preview', 'sunovoice/');
    const matches = voiceFiles.filter(f => f.name.startsWith(requestId)).map(f => `sunovoice/${f.name}`);
    if (matches.length > 0) {
      await deleteStorageFiles('preview', matches);
      logInfo(`[Rollback] Storage limpo: ${matches.length} ficheiro(s) de voz em preview`, { requestId });
    }
  } catch {}
  if (voiceSampleUrl && !voiceSampleUrl.startsWith('http')) {
    try {
      await deleteStorageFiles('voice-samples', [voiceSampleUrl]);
    } catch {}
  }
}

export async function rollbackSunoWorkflow(
  supabase: NonNullable<ReturnType<typeof getAdminSupabase>>,
  requestId: string,
  songId: string,
  err: unknown
) {
  let userEmail: string | null | undefined;
  let recipientName: string | undefined;
  try {
    const { data: failedRequest } = await supabase
      .from('song_requests')
      .select('email, recipient_name, users(email)')
      .eq('id', requestId)
      .single();
    userEmail = failedRequest?.email || failedRequest?.users?.[0]?.email || null;
    recipientName = failedRequest?.recipient_name || undefined;
  } catch (infoErr) {
    logError('[Rollback] Não foi possível obter dados do cliente', infoErr, { requestId });
  }

  let revertedCount = 0;
  try {
    const { data: approvedPayments } = await supabase
      .from('payments')
      .select('id')
      .eq('request_id', requestId)
      .eq('status', 'approved');

    if (approvedPayments && approvedPayments.length > 0) {
      revertedCount = approvedPayments.length;
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          approved_at: null,
          notes: 'Revertido automaticamente — falha na geração Suno'
        })
        .eq('request_id', requestId)
        .eq('status', 'approved');
      logWarn(`[Rollback] ${revertedCount} pagamento(s) revertido(s) para 'failed'`, { requestId });
    }
  } catch (rollbackErr) {
    logError('[Rollback] Payment rollback failed', rollbackErr, { requestId });
  }

  try {
    const { data: sr } = await supabase
      .from('song_requests')
      .select('voice_sample_url')
      .eq('id', requestId)
      .maybeSingle();
    await rollbackStorageForSong(supabase, songId, requestId, sr?.voice_sample_url);
  } catch {}

  try {
    const adminUrl = `${getAppUrl()}/admin`;
    await sendAdminNotification(
      'Falha na geração Suno — Pedido ' + requestId.slice(0, 8),
      'Ocorreu um erro ao gerar a música no Suno.\n\n' +
        'Pedido: ' + requestId + '\n' +
        'Música (songId): ' + songId + '\n' +
        'Cliente: ' + (recipientName || '—') + (userEmail ? ` <${userEmail}>` : '') + '\n' +
        'Pagamentos revertidos: ' + revertedCount + '\n' +
        'Erro: ' + (err instanceof Error ? err.message : String(err ?? '')) + '\n\n' +
        'Admin: ' + adminUrl
    );
  } catch (emailErr) {
    logError('[Rollback] Admin notification failed', emailErr, { requestId });
  }

  try {
    if (userEmail) {
      await sendWorkflowFailedEmail(userEmail, recipientName || 'Cliente');
    }
  } catch (emailErr) {
    logError('[Rollback] Client notification failed', emailErr, { requestId });
  }
}
