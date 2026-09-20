const { Client } = require('pg');

async function main() {
  const c = new Client({
    connectionString: 'postgresql://postgres.xdlssfxbndwuirwcofdx:Sued12345@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=no-verify',
    ssl: { rejectUnauthorized: false }
  });
  await c.connect();

  const r = await c.query(
    "SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns WHERE table_name = 'payments' ORDER BY ordinal_position"
  );
  console.log('=== payments columns ===');
  for (const row of r.rows) {
    console.log(`  ${row.column_name}: ${row.data_type} nullable=${row.is_nullable} default=${row.column_default || 'NONE'}`);
  }

  await c.end();
}

main().catch(e => { console.error(e); process.exit(1); });
