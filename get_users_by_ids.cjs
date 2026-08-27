const { createClient } = require('@supabase/supabase-js');
const supa = createClient(
  'https://uqmqkntnpuecswcrtulz.supabase.co',
  'sb_publishable_LXb0QpiezvwKFscRtFhw_g_ov2VBxaz'
);

// Direct query by the user IDs we found
supa.from('auth.users').select('id, email').in('id', ['1fe14b05-76ec-467f-8d23-79698c13854d', '6bed92b3-7ea7-4766-9dec-80c601cdf244']).then(usersResult => {
  const users = usersResult.data;
  console.log('Users found:', JSON.stringify(users, null, 2));
}).catch(err => {
  console.error('Error:', err.message);
});