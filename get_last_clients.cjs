const { createClient } = require('@supabase/supabase-js');
const supa = createClient(
  'https://uqmqkntnpuecswcrtulz.supabase.co',
  'sb_publishable_LXb0QpiezvwKFscRtFhw_g_ov2VBxaz'
);

// First get the last 2 song requests
supa.from('song_requests').select('id, user_id, created_at, status').order('created_at', { ascending: false }).limit(2).then(srResult => {
  const sr = srResult.data;
  console.log('Last 2 song requests:', JSON.stringify(sr, null, 2));
  
  if (sr && sr.length > 0) {
    const userIds = sr.map(x => x.user_id).join(',');
    // Then get those users
    return supa.from('auth.users').select('id, email').in('id', userIds).then(usersResult => {
      const users = usersResult.data;
      console.log('\\nUsers behind those requests:', JSON.stringify(users, null, 2));
    });
  }
}).catch(err => {
  console.error('Error:', err.message);
});