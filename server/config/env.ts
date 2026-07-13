const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'SUNO_API_KEY', 'SMTP_HOST', 'ADMIN_PASSWORD', 'JWT_SECRET'] as const;

export function validateEnv(): void {
  // Mapeamento automático de variáveis com prefixo VITE_ caso as originais não existam
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_ANON_KEY && process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.SUNO_API_KEY && process.env.VITE_SUNO_API_KEY) {
    process.env.SUNO_API_KEY = process.env.VITE_SUNO_API_KEY;
  }
  if (!process.env.ADMIN_PASSWORD && process.env.VITE_ADMIN_PASSWORD) {
    process.env.ADMIN_PASSWORD = process.env.VITE_ADMIN_PASSWORD;
  }
  if (!process.env.JWT_SECRET && process.env.VITE_JWT_SECRET) {
    process.env.JWT_SECRET = process.env.VITE_JWT_SECRET;
  }

  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.warn(`[WARN] Variaveis de ambiente em falta em CI/test: ${missing.join(', ')}`);
      return;
    }
    console.error(`[FATAL] Variaveis de ambiente em falta: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY && !process.env.GEMINI_API_KEY) {
    if (process.env.CI || process.env.NODE_ENV === 'test') {
      console.warn('[WARN] Nenhuma chave de IA configurada (OPENAI_API_KEY, ANTHROPIC_API_KEY ou GEMINI_API_KEY)');
      return;
    }
    console.warn('[WARN] Nenhuma chave de IA configurada — a geração de letras não funcionará.');
  }
}

export function getEnv(key: string, fallback?: string): string {
  return process.env[key] || fallback || '';
}

export function hasEnv(key: string): boolean {
  return !!process.env[key];
}

export const ENV = {
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  SUNO_API_KEY: process.env.SUNO_API_KEY || '',
  SUNO_COST_PER_CREDIT_USD: Number(process.env.SUNO_COST_PER_CREDIT_USD) || 0.005,
  CLAUDE_COST_PER_GENERATION_USD: Number(process.env.CLAUDE_COST_PER_GENERATION_USD) || 0.03,
  OPENAI_COST_PER_GENERATION_USD: Number(process.env.OPENAI_COST_PER_GENERATION_USD) || 0.01,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  MONTHLY_FIXED_COST_USD: Number(process.env.MONTHLY_FIXED_COST_USD) || 0,
};
