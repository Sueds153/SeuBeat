import fs from 'fs';

const path = 'C:\\Users\\Pagora\\.gemini\\antigravity\\mcp_config.json';
const newConfig = {
  "mcpServers": {
    "supabase": {
      "serverUrl": "https://mcp.supabase.com/mcp?project_ref=uqmqkntnpuecswcrtulz&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching%2Cstorage"
    }
  }
};

fs.writeFileSync(path, JSON.stringify(newConfig, null, 2));
console.log('🎉 mcp_config.json atualizado com sucesso com o project_ref uqmqkntnpuecswcrtulz!');
