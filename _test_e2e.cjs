const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const SB_URL = 'https://uqmqkntnpuecswcrtulz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10';
const BASE = 'https://seubeat.onrender.com';

function postMultipart(path, fields, fileField, fileBuffer, fileName, fileMime) {
  return new Promise((resolve, reject) => {
    const boundary = '----Test' + Date.now();
    const parts = [];
    for (const [name, value] of Object.entries(fields)) {
      parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
    }
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField}"; filename="${fileName}"\r\nContent-Type: ${fileMime}\r\n\r\n`);
    const headerBuf = Buffer.from(parts.join(''));
    const footerBuf = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([headerBuf, fileBuffer, footerBuf]);

    const req = https.request({
      hostname: 'seubeat.onrender.com',
      path,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      timeout: 120000,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data.slice(0, 500) }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  const sb = createClient(SB_URL, SB_KEY);

  // Step 1: Create user + song_request via API (full wizard flow simulation)
  console.log('=== Step 1: Create user via /generate-lyrics (wizard end) ===');

  // Actually, let's create directly in DB since wizard requires many steps
  const ts = Date.now();
  const testEmail = `e2e_test_${ts}@gmail.com`;

  const { data: user, error: uErr } = await sb.from('users').insert({
    name: 'Teste E2E',
    email: testEmail,
    phone: '929123456',
  }).select('id').single();

  if (uErr) { console.error('User error:', JSON.stringify(uErr)); return; }
  console.log('User created:', user.id);

  const { data: songReq, error: sErr } = await sb.from('song_requests').insert({
    user_id: user.id,
    recipient_name: 'Maria',
    relationship: 'Esposa',
    occasion: 'Aniversario',
    music_style: 'Kizomba',
    voice_type: 'male',
    status: 'lyrics_ready',
    email: testEmail,
    phone: '929123456',
  }).select('id').single();

  if (sErr) { console.error('Song request error:', JSON.stringify(sErr)); return; }
  console.log('Song request created:', songReq.id);

  // Step 2: Submit payment with a real-ish proof image
  console.log('\n=== Step 2: Submit payment with proof ===');

  // Create a minimal JPEG (valid header + ~2KB body)
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
  const jpegBody = Buffer.alloc(2000, 0x41);
  const jpegEnd = Buffer.from([0xFF, 0xD9]);
  const proofImage = Buffer.concat([jpegHeader, jpegBody, jpegEnd]);

  const result = await postMultipart('/api/submit-payment', {
    songRequestId: songReq.id,
    userEmail: testEmail,
    plan: 'standard',
    amount: '7900',
    paymentMethod: 'reference',
    eventIds: JSON.stringify({}),
  }, 'proof', proofImage, 'comprovativo_multicaixa.jpg', 'image/jpeg');

  console.log('Status:', result.status);
  console.log('Response:', JSON.stringify(result.body, null, 2));

  // Step 3: Check what happened
  if (result.status === 200 && result.body.success) {
    console.log('\n=== SUCCESS! Payment submitted ===');
    console.log('Payment ID:', result.body.paymentId);
    console.log('Verification:', JSON.stringify(result.body.verification));

    // Check DB state
    const { data: sr } = await sb.from('song_requests').select('id,status').eq('id', songReq.id).single();
    console.log('Song request status:', sr?.status);

    const { data: pm } = await sb.from('payments').select('id,status,ai_verified,verification_result,proof_url').eq('request_id', songReq.id).single();
    console.log('Payment record:', JSON.stringify(pm, null, 2));
  } else {
    console.log('\n=== FAILED ===');
    console.log('Error:', result.body.error || result.body);
  }

  // Cleanup
  console.log('\n=== Cleanup ===');
  await sb.from('payments').delete().eq('request_id', songReq.id);
  await sb.from('song_requests').delete().eq('id', songReq.id);
  await sb.from('users').delete().eq('id', user.id);
  console.log('Cleaned up test data');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
