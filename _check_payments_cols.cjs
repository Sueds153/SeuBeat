const { createClient } = require('@supabase/supabase-js');

async function main() {
  const sb = createClient(
    'https://uqmqkntnpuecswcrtulz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10'
  );

  const { data, error } = await sb.from('payments').select('*').limit(1);
  if (data && data[0]) {
    console.log('PostgREST payments columns:', Object.keys(data[0]).join(', '));
  }
  if (error) console.log('error:', JSON.stringify(error));
}

main();
