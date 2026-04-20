import { defineConfig, devices } from '@playwright/test'

const testServerUrl = 'http://localhost:5173'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: testServerUrl,
  },
  webServer: {
    command: 'pnpm exec vite --host localhost --port 5173 --strictPort',
    url: testServerUrl,
    reuseExistingServer: true,
  },
})
