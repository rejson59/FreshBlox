import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 35_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1366, height: 840 },
    launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
      ? {
          executablePath: process.env.PW_CHROMIUM_EXECUTABLE,
          args: [
            '--no-sandbox',
            '--no-zygote',
            '--use-gl=angle',
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
          ],
        }
      : {},
  },
  webServer: {
    command: 'npm run dev -- --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
