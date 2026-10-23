import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import path from 'node:path'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8789',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node ../scripts/local-server.mjs',
    url: 'http://127.0.0.1:8789',
    reuseExistingServer: false,
    env: {
      LUNCH_ADMIN_CODE: 'e2e-only-admin',
      PORT: '8789',
      LOCAL_DB_PATH: path.join(tmpdir(), `easy-eat-e2e-${process.pid}.sqlite`),
    },
  },
})
