const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUNO_API_KEY', 'ANTHROPIC_API_KEY', 'SMTP_HOST', 'ADMIN_PASSWORD'] as const;

export function validateEnv(): void {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(`[FATAL] Variaveis de ambiente em falta: ${missing.join(', ')}`);
    process.exit(1);
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
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || '',
};
