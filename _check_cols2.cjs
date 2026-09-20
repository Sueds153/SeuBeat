const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres.xdlssfxbndwuirwcofdx:Sued12345@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  // Try a direct column check
  const r = await c.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'payments' AND table_schema = 'public' ORDER BY ordinal_position");
  console.log('pg pooler columns:', r.rows.map(x => x.column_name).join(', '));

  // Check if we can see the columns PostgREST says exist
  try {
    const r2 = await c.query("SELECT plan_type FROM payments LIMIT 1");
    console.log('plan_type exists:', true);
  } catch (e) {
    console.log('plan_type error:', e.message);
  }

  try {
    const r3 = await c.query("SELECT amount_kz FROM payments LIMIT 1");
    console.log('amount_kz exists:', true);
  } catch (e) {
    console.log('amount_kz error:', e.message);
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
