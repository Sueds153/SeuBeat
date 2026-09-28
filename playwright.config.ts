import { defineConfig, devices } from '@playwright/test';

// Porta do webServer/baseURL. Default 3000 (CI inalterado). Locally, se a
// porta estiver ocupada por outro projeto (ex.: dev server de outro app),
// correr com E2E_PORT=3100 npx playwright test.
const PORT = Number(process.env.E2E_PORT) || 3000;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  // CI: além da lista no stdout, grava playwright-results.json para o
  // scripts/e2e-failures-summary.mjs publicar as falhas no job summary.
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'playwright-results.json' }], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    navigationTimeout: 60000,
    actionTimeout: 20000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}/health`,
    // CI arranca o servidor buildado (`node dist/server.js`) e espera pelo
    // /health antes de correr o Playwright — sem reuse, o Playwright aborta
    // logo com "http://localhost:3000/health is already used" e os testes
    // nunca chegam a correr. Local mantém-se isolado (servidor próprio).
    reuseExistingServer: !!process.env.CI,
    timeout: 120000,
    cwd: '.',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(PORT),
    },
  },
});
