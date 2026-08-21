import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script para restaurar a base de dados do SeuBeat num NOVO projeto PostgreSQL/Supabase.
 * Pode ser executado fornecendo a URL de conexão do NOVO projeto.
 * Exemplo: NEW_DATABASE_URL="postgresql://..." node scripts/restore_db.js
 */

async function restore() {
  const targetUrl = process.env.NEW_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!targetUrl) {
    console.error('❌ Erro: Nenhuma URL de base de dados de destino especificada. Defina NEW_DATABASE_URL no .env ou como variável de ambiente.');
    process.exit(1);
  }

  // Encontrar o ficheiro de backup mais recente
  const backupDir = './backup';
  if (!fs.existsSync(backupDir)) {
    console.error('❌ Pasta ./backup não encontrada.');
    process.exit(1);
  }

  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('seubeat_backup_') && f.endsWith('.json'));
  if (files.length === 0) {
    console.error('❌ Nenhum ficheiro de backup encontrado.');
    process.exit(1);
  }

  files.sort();
  const latestBackup = path.join(backupDir, files[files.length - 1]);
  console.log(`📦 A carregar backup mais recente: ${latestBackup}`);
  const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));

  const client = new Client({ connectionString: targetUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('⚡ Conectado à base de dados de destino!');

  try {
    // Step 1: Aplicar os ficheiros SQL de esquema na ordem correta
    const sqlFiles = [
      'supabase_setup.sql',
      'supabase_migration_utm.sql',
      'supabase_migration_scheduler.sql',
      'supabase_migration_phantom_columns.sql',
      'supabase_migration_fix_auth_rls_initplan.sql',
      'supabase_migration_email_events_request_id_idx.sql',
      'supabase_migration_authlink.sql',
      'supabase_migration_analytics_events.sql',
      'supabase_migration_advisor.sql',
      'supabase_migration_advisor_fixes.sql',
      'supabase_migration_advisor_fixes2.sql',
      'supabase_migration_advisor_fixes3.sql',
      'supabase_migration_abandoned_whatsapp.sql'
    ];

    console.log('\n🧱 A aplicar esquemas, tabelas, índices e funções SQL...');
    for (const sqlFile of sqlFiles) {
      if (fs.existsSync(sqlFile)) {
        const sql = fs.readFileSync(sqlFile, 'utf8');
        try {
          await client.query(sql);
          console.log(`  ✓ Aplicado: ${sqlFile}`);
        } catch (err) {
          console.warn(`  ⚠️ Aviso ao aplicar ${sqlFile}: ${err.message}`);
        }
      }
    }

    // Step 1b: Criar Buckets de Storage
    console.log('\n🗂️ A criar Buckets de Storage (full-audio e proofs)...');
    try {
      await client.query(`
        INSERT INTO storage.buckets (id, name, public) 
        VALUES 
          ('full-audio', 'full-audio', true),
          ('proofs', 'proofs', true)
        ON CONFLICT (id) DO UPDATE SET public = true;
      `);
      console.log('  ✓ Buckets storage.buckets criado/configurado com sucesso!');
    } catch (err) {
      console.warn('  ⚠️ Aviso ao criar buckets no Storage:', err.message);
    }

    // Step 2: Restaurar dados tabela a tabela
    console.log('\n📥 A restaurar dados...');
    const tableOrder = [
      'users',
      'voice_clones',
      'song_requests',
      'songs',
      'payments',
      'downloads',
      'email_events',
      'whatsapp_send_log',
      'admin_audit_log'
    ];

    for (const table of tableOrder) {
      const rows = backupData[table];
      if (!rows || rows.length === 0) {
        console.log(`  ℹ️ Tabela ${table}: 0 registos.`);
        continue;
      }

      console.log(`  🔄 Restauro de ${table}: ${rows.length} registos...`);
      let inserted = 0;

      for (const row of rows) {
        const keys = Object.keys(row);
        const values = Object.values(row);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const colNames = keys.map(k => `"${k}"`).join(', ');

        const queryText = `
          INSERT INTO public."${table}" (${colNames}) 
          VALUES (${placeholders}) 
          ON CONFLICT DO NOTHING;
        `;

        try {
          await client.query(queryText, values);
          inserted++;
        } catch (err) {
          console.error(`  ❌ Erro ao inserir na tabela ${table}:`, err.message);
        }
      }
      console.log(`  ✅ Tabela ${table}: ${inserted}/${rows.length} registos inseridos com sucesso!`);
    }

    console.log('\n🎉 RESTAURO COMPLETO CONCLUÍDO COM SUCESSO!');
  } catch (err) {
    console.error('❌ Erro no processo de restauro:', err);
  } finally {
    await client.end();
  }
}

restore();
