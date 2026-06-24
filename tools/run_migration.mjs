import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const sql = readFileSync(new URL('../supabase_migration_advisor.sql', import.meta.url), 'utf8');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Split by semicolons, filter empty
  const stmts = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const stmt of stmts) {
    const full = stmt + ';';
    try {
      const { error } = await supabase.rpc('exec_sql', { query: full });
      if (error) {
        console.log('RPC not available, trying REST...');
      }
    } catch {
      // rpc might not exist, try direct SQL
    }
  }
  console.log('Migration script needs manual execution via SQL Editor.');
  console.log('File: supabase_migration_advisor.sql');
}

run();
