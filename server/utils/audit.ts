import { getAdminSupabase } from '../services/supabase';

export async function logAdminAction(params: {
  action: string;
  entityType: string;
  entityId?: string;
  previousData?: any;
  newData?: any;
  notes?: string;
}) {
  try {
    const supabase = getAdminSupabase();
    if (!supabase) return;
    await supabase.from('admin_audit_log').insert([{
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      previous_data: params.previousData || null,
      new_data: params.newData || null,
      notes: params.notes || null,
    }]);
  } catch (err) {
    // silêncio — log de auditoria nunca deve quebrar o fluxo
  }
}
