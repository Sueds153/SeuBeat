import fs from 'fs';
import path from 'path';

function run() {
  let dataSql = '-- SEUBEAT ALL DATA INSERTS --\n\n';

  const backupDir = './backup';
  const files = fs.readdirSync(backupDir).filter(f => f.startsWith('seubeat_backup_') && f.endsWith('.json'));
  files.sort();
  const latestBackup = path.join(backupDir, files[files.length - 1]);
  console.log('Lendo dados de:', latestBackup);
  const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));

  function escapeSqlVal(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') return val;
    if (typeof val === 'object') return "'" + JSON.stringify(val).replace(/'/g, "''") + "'::jsonb";
    return "'" + String(val).replace(/'/g, "''") + "'";
  }

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
    if (!rows || rows.length === 0) continue;

    dataSql += `-- INSERT INTO ${table} (${rows.length} rows) --\n`;
    for (const row of rows) {
      const keys = Object.keys(row);
      const colNames = keys.map(k => `"${k}"`).join(', ');
      const valList = keys.map(k => escapeSqlVal(row[k])).join(', ');
      dataSql += `INSERT INTO public."${table}" (${colNames}) VALUES (${valList}) ON CONFLICT DO NOTHING;\n`;
    }
    dataSql += '\n';
  }

  fs.writeFileSync('full_data_restore.sql', dataSql);
  console.log(`🎉 Ficheiro full_data_restore.sql gerado com sucesso! Tamanho: ${(dataSql.length / 1024 / 1024).toFixed(2)} MB`);
}

run();
