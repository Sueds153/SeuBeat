export function getDeepSeekApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_SECRET_KEY || '';
}

export function hasDeepSeekApiKey(): boolean {
  return !!getDeepSeekApiKey();
}
