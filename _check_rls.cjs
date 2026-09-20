const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres.xdlssfxbndwuirwcofdx:Sued12345@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Check RLS policies
  const policies = await c.query(
    "SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename='song_requests'"
  );
  console.log('=== RLS Policies on song_requests ===');
  console.log(JSON.stringify(policies.rows, null, 2));

  // Check if the specific request exists
  const check = await c.query(
    "SELECT id, status, email, deleted_at FROM song_requests WHERE id = 'e22235e9-608b-409e-a0cd-3bb0282ba9d7'"
  );
  console.log('\n=== Direct query for test request ===');
  console.log(JSON.stringify(check.rows, null, 2));

  // Also check via Supabase anon (service_role bypasses RLS)
  // Check what role the Supabase client uses
  const roles = await c.query(
    "SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'service_role', 'authenticated', 'supabase_admin')"
  );
  console.log('\n=== Relevant roles ===');
  console.log(JSON.stringify(roles.rows));

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
