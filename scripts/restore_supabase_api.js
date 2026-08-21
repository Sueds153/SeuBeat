import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const url = 'https://uqmqkntnpuecswcrtulz.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxbXFrbnRucHVlY3N3Y3J0dWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzMwNjIzMCwiZXhwIjoyMTAyODgyMjMwfQ.yGcVG1RTqqRoj-dMH0k0lhLGHtbniPxdHAGo3v0wT10';

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

async function restoreViaApi() {
  console.log('🚀 A iniciar restauro de dados para o novo projeto Supabase...');

  const backupDir = './backup';
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('seubeat_backup_') && f.endsWith('.json'));
  files.sort();
  const latestBackup = path.join(backupDir, files[files.length - 1]);
  console.log(`📦 Ficheiro de backup: ${latestBackup}`);

  const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));

  // 1. Garantir que os buckets de storage existem
  console.log('\n🗂️ A verificar e criar buckets de Storage (full-audio, proofs)...');
  const bucketsToEnsure = ['full-audio', 'proofs', 'photos', 'preview', 'voice-samples'];
  for (const b of bucketsToEnsure) {
    const { data: bData, error: bErr } = await supabase.storage.createBucket(b, { public: true });
    if (bErr && !bErr.message.includes('already exists')) {
      console.log(`  ℹ️ Bucket ${b}: ${bErr.message}`);
    } else {
      console.log(`  ✓ Bucket ${b} pronto (público).`);
    }
  }

  // 2. Ordem de inserção das tabelas
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

  console.log('\n📥 A restaurar registos nas tabelas...');

  for (const table of tableOrder) {
    const rows = backupData[table];
    if (!rows || rows.length === 0) {
      console.log(`  ℹ️ Tabela ${table}: 0 registos.`);
      continue;
    }

    console.log(`  🔄 Restauro de ${table}: ${rows.length} registos...`);

    // Inserir em lotes de 50 para máxima velocidade e fiabilidade
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      // Mapeamento de nomes alternativos de colunas
      if (table === 'payments') {
        batch.forEach(r => {
          if (!r.plan_type && r.plan) r.plan_type = r.plan;
          if (!r.amount_kz && r.amount !== undefined) r.amount_kz = r.amount;
        });
      }
      if (table === 'email_events') {
        batch.forEach(r => {
          if (!r.event_type && r.event) r.event_type = r.event;
        });
      }
      if (table === 'whatsapp_send_log') {
        batch.forEach(r => {
          if (!r.sent_at && r.created_at) r.sent_at = r.created_at;
          if (!r.bucket) r.bucket = 'manual';
          delete r.created_at;
        });
      }
      if (table === 'admin_audit_log') {
        batch.forEach(r => {
          if (!r.payload && (r.new_data || r.previous_data)) {
            r.payload = { previous: r.previous_data, new: r.new_data, notes: r.notes };
          }
          delete r.previous_data;
          delete r.new_data;
        });
      }

      const { data, error } = await supabase.from(table).upsert(batch, { ignoreDuplicates: true });

      if (error) {
        console.error(`  ❌ Erro no lote da tabela ${table}:`, error.message);
        // Tentar um a um se o lote falhar
        for (const row of batch) {
          const { error: singleErr } = await supabase.from(table).upsert(row, { ignoreDuplicates: true });
          if (singleErr) {
            console.error(`     Erro no registo ${row.id || 'sem id'}:`, singleErr.message);
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount += batch.length;
      }
    }

    console.log(`  ✅ Tabela ${table}: ${insertedCount}/${rows.length} registos restaurados com sucesso!`);
  }

  console.log('\n🎉 RESTAURO CONCLUÍDO COM SUCESSO!');
}

restoreViaApi().catch(err => console.error('Erro fatal no restauro:', err));
