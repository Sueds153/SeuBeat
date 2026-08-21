import { Client } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function checkSchema() {
  await client.connect();
  
  const funcs = await client.query(`
    SELECT routine_name, routine_type 
    FROM information_schema.routines 
    WHERE routine_schema = 'public';
  `);
  console.log('Funções SQL públicas:', funcs.rows);

  const triggers = await client.query(`
    SELECT trigger_name, event_object_table 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
  `);
  console.log('Triggers públicos:', triggers.rows);

  const policies = await client.query(`
    SELECT tablename, policyname, roles, cmd 
    FROM pg_policies 
    WHERE schemaname = 'public';
  `);
  console.log('Políticas RLS:', policies.rows);

  await client.end();
}

checkSchema().catch(err => console.error(err));
