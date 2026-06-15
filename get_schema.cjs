const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function run() {
  console.log('🔍 Querying table schema...');
  // We can query the postgrest API or information schema via RPC if it exists,
  // or we can select a row and look at the keys if there is any row,
  // or we can use a query to select all column names by querying postgrest schema.
  // Wait, let's make an HTTP request to the Supabase PostgREST OpenAPI spec endpoint!
  // Every Supabase PostgREST instance exposes a Swagger OpenAPI spec at the root path "/"!
  // This will list all tables and their columns in detail!
  const res = await fetch(process.env.SUPABASE_URL + '/rest/v1/', {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    }
  });

  if (!res.ok) {
    console.error('Failed to get schema:', res.status, await res.text());
    return;
  }

  const spec = await res.json();
  const tables = ['song_requests', 'songs', 'payments', 'users'];
  for (const tableName of tables) {
    const srDef = spec.definitions?.[tableName];
    if (srDef) {
      console.log(`\n📋 Columns of ${tableName}:`);
      for (const [colName, colProps] of Object.entries(srDef.properties)) {
        console.log(`  - ${colName} (${colProps.type})`);
      }
    } else {
      console.log(`${tableName} definition not found in schema.`);
    }
  }
}

run().catch(console.error);
