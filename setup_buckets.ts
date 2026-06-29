/**
 * @deprecated Use supabase_setup.sql (na raiz do projeto) em vez deste script.
 *             O SQL cobre tabelas, buckets e RLS de forma atómica.
 *             Este script mantém-se apenas como referência histórica.
 *
 * SeuBeat — Script de Criação dos Buckets no Supabase Storage
 * 
 * COMO USAR:
 * 1. Ir a: https://supabase.com/dashboard/project/xdlssfxbndwuirwcofdx/settings/api
 * 2. Copiar a chave "service_role" (a secreta, não a anon)
 * 3. Colar em SUPABASE_SERVICE_ROLE_KEY no ficheiro .env
 * 4. Executar: npx tsx setup_buckets.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY) {
  console.error('\n❌ SUPABASE_SERVICE_ROLE_KEY está vazio no ficheiro .env!');
  console.error('   → Ir a: supabase.com/dashboard > Project Settings > API > service_role key');
  console.error('   → Copiar a chave e colocar em SUPABASE_SERVICE_ROLE_KEY no .env\n');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL está vazio no ficheiro .env!');
  process.exit(1);
}

// Usar service_role key para ter permissões de admin
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKETS = [
  { name: 'payment-proofs', public: false, description: 'Comprovativos de pagamento dos clientes (apenas admin) ' },
  { name: 'full-audio',     public: false, description: 'Músicas completas (acesso privado/pago)' },
  { name: 'preview',        public: true,  description: 'Previews de 30s das músicas (acesso público)' },
  { name: 'voice-samples',  public: false, description: 'Amostras de voz e fotos dos clientes (privado)' },
];

async function createBuckets() {
  console.log('\n🎵 SeuBeat — Criação de Buckets no Supabase Storage');
  console.log('═══════════════════════════════════════════════════\n');

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const bucket of BUCKETS) {
    process.stdout.write(`📦 A criar bucket "${bucket.name}" (${bucket.public ? 'público' : 'privado'})... `);

    try {
      const { data, error } = await supabase.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: 52428800, // 50MB
      });

      if (error) {
        if (error.message?.includes('already exists') || error.message?.includes('Duplicate')) {
          console.log('⚠️  Já existe — ignorado');
          skipCount++;
        } else {
          console.log(`❌ Erro: ${error.message}`);
          errorCount++;
        }
      } else {
        console.log('✅ Criado com sucesso!');
        successCount++;
      }
    } catch (err: any) {
      console.log(`❌ Exceção: ${err.message}`);
      errorCount++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`✅ Criados: ${successCount} | ⚠️  Já existiam: ${skipCount} | ❌ Erros: ${errorCount}`);

  if (errorCount === 0) {
    console.log('\n🎉 Todos os buckets estão configurados! O SeuBeat está pronto para receber ficheiros.\n');
  } else {
    console.log('\n⚠️  Alguns buckets falharam. Verifique a chave service_role e tente novamente.\n');
  }

  // Listar buckets existentes para confirmação
  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (!listError && existing) {
    console.log('📋 Buckets no projeto Supabase:');
    existing.forEach(b => {
      console.log(`   • ${b.name} (${b.public ? 'público' : 'privado'})`);
    });
    console.log('');
  }
}

createBuckets().catch(console.error);
