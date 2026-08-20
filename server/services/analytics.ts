import { getAdminSupabase } from './supabase';
import { logWarn } from '../utils/logger';

export type AnalyticsEventName =
  | 'wizard_step_complete'
  | 'lyrics_generated'
  | 'plan_viewed'
  | 'plan_selected'
  | 'payment_submitted'
  | 'payment_approved'
  | 'payment_rejected'
  | 'song_delivered'
  | 'video_upsell_clicked'
  | 'referral_link_clicked';

export async function logAnalyticsEvent(
  eventName: AnalyticsEventName,
  options: {
    requestId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return;
    await supabase.from('analytics_events').insert({
      event_name: eventName,
      request_id: options.requestId || null,
      session_id: options.sessionId || null,
      metadata: options.metadata || null,
    });
  } catch (err) {
    // Silently fail — analytics must never break the main flow
    logWarn('[Analytics] Falha ao registar evento', {
      event: eventName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
