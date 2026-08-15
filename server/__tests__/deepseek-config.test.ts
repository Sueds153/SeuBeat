import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('deepseek config', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('prefers DEEPSEEK_API_KEY', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'primary');
    vi.stubEnv('DEEPSEEK_SECRET_KEY', 'alias');

    const { getDeepSeekApiKey } = await import('../services/deepseekConfig');

    expect(getDeepSeekApiKey()).toBe('primary');
  });

  it('accepts DEEPSEEK_SECRET_KEY as an alias', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    vi.stubEnv('DEEPSEEK_SECRET_KEY', 'alias');

    const { getDeepSeekApiKey, hasDeepSeekApiKey } = await import('../services/deepseekConfig');

    expect(getDeepSeekApiKey()).toBe('alias');
    expect(hasDeepSeekApiKey()).toBe(true);
  });
});
