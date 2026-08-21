import { Client } from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Nenhuma URL de conexão com a base de dados encontrada no .env');
  process.exit(1);
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

async function runBackup() {
  try {
    await client.connect();
    console.log('Conectado à base de dados PostgreSQL via Direct PG...');

    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Tabelas encontradas:', tables);

    const backupData = {};
    for (const table of tables) {
      const res = await client.query(`SELECT * FROM public."${table}"`);
      backupData[table] = res.rows;
      console.log(`✓ Copiados ${res.rows.length} registos da tabela: ${table}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.mkdirSync('./backup', { recursive: true });
    const backupPath = `./backup/seubeat_backup_${timestamp}.json`;
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    console.log(`\n🎉 BACKUP CONCLUÍDO COM SUCESSO! Guardado em: ${backupPath}`);
  } catch (err) {
    console.error('Erro durante o backup:', err);
  } finally {
    await client.end();
  }
}

runBackup();
