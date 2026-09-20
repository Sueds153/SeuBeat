const https = require('https');

async function main() {
  // Use Supabase JS client to find a request (same client the API uses)

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient('https://uqmqkntnpuecswcrtulz.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10');

  const { data: requests, error } = await sb.from('song_requests')
    .select('id, status, email')
    .eq('status', 'lyrics_ready')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !requests || requests.length === 0) {
    console.log('No requests found via Supabase client', error);
    return;
  }
  const req = requests[0];
  console.log('Using request:', JSON.stringify(req));

  const boundary = '----Boundary' + Date.now();
  const tinyJpeg = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMCwsKCwsMDRANDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=';

  function field(name, value) {
    return `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
  }
  function fileField(name, filename, mime, data) {
    return `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n${data}\r\n`;
  }

  let body = '';
  body += field('songRequestId', req.id);
  body += field('userEmail', req.email || 'test@test.com');
  body += field('plan', 'standard');
  body += field('amount', '7900');
  body += field('paymentMethod', 'reference');
  body += field('eventIds', '{}');
  body += fileField('proof', 'test_proof.jpg', 'image/jpeg', tinyJpeg);
  body += `--${boundary}--\r\n`;

  const buf = Buffer.from(body);

  return new Promise((resolve) => {
    const r2 = https.request({
      hostname: 'seubeat.onrender.com',
      path: '/api/submit-payment',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': buf.length,
      },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        try {
          console.log('Response:', JSON.stringify(JSON.parse(data), null, 2));
        } catch {
          console.log('Response (raw):', data.slice(0, 2000));
        }
        resolve();
      });
    });
    r2.on('error', e => { console.error('Error:', e.message); resolve(); });
    r2.on('timeout', () => { console.error('TIMEOUT after 120s'); r2.destroy(); resolve(); });
    r2.write(buf);
    r2.end();
  });
}

main().catch(e => { console.error(e); process.exit(1); });
