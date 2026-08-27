const { createClient } = require('@supabase/supabase-js');
const supa = createClient(
  'https://uqmqkntnpuecswcrtulz.supabase.co',
  'sb_publishable_LXb0QpiezvwKFscRtFhw_g_ov2VBxaz'
);

supa.from('auth.users')
  .select('id, email')
  .order('created_at', { ascending: false })
  .limit(2)
  .then(({ data }) => {
    console.log('Last 2 users:', JSON.stringify(data, null, 2));
  })
  .catch(e => {
    console.error('Error:', e.message);
  });