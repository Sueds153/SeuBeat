const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres.xdlssfxbndwuirwcofdx:Sued12345@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Check the specific request that PostgREST can't see
  const r1 = await c.query("SELECT id, email, user_id, status, deleted_at FROM song_requests WHERE id = 'e22235e9-608b-409e-a0cd-3bb0282ba9d7'");
  console.log('Request e22235e9 (pg direct):', JSON.stringify(r1.rows));

  // Check the real one PostgREST found for that email
  const r2 = await c.query("SELECT id, email, user_id, status, deleted_at FROM song_requests WHERE id = '3081f303-6540-49ea-99de-27f4684fe863'");
  console.log('Request 3081f303 (PostgREST found):', JSON.stringify(r2.rows));

  // How many total lyrics_ready?
  const r3 = await c.query("SELECT count(*) FROM song_requests WHERE status = 'lyrics_ready' AND deleted_at IS NULL");
  console.log('Total lyrics_ready (pg):', r3.rows[0].count);

  // Check if e22235e9 user_id exists
  const r4 = await c.query("SELECT id, email FROM users WHERE id = (SELECT user_id FROM song_requests WHERE id = 'e22235e9-608b-409e-a0cd-3bb0282ba9d7')");
  console.log('User for e22235e9:', JSON.stringify(r4.rows));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
