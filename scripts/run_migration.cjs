const { Client } = require('pg');

const srk = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkbHNzZnhibmR3dWlyd2NvZmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDMyMjQ0OSwiZXhwIjoyMDk1ODk4NDQ5fQ.h4T7TeeEEQW09SOGvPRAxOZe8mOJfdV6my9veDIWj9M';
const connStr = `postgresql://postgres.xdlssfxbndwuirwcofdx:${encodeURIComponent(srk)}@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true`;

const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 15000 });

async function run() {
  try {
    await client.connect();
    console.log('Conectado ao Supabase!');
    await client.query('ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS regeneration_count integer DEFAULT 0');
    console.log('Migration executada com sucesso!');
    const { rows } = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='songs' AND column_name='regeneration_count'"
    );
    console.log('Coluna verificada:', JSON.stringify(rows));
  } catch (err) {
    console.error('Erro:', err.message);
    console.error('Detalhes:', err);
  } finally {
    await client.end();
  }
}
run();
