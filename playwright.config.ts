import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/browser',
    timeout: 60_000,
    expect: { timeout: 5_000 },
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    workers: 1,
    reporter: [['list'], ['html', { open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:5174',
        viewport: { width: 1280, height: 800 },
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
        url: 'http://127.0.0.1:5174/tests/browser/',
        reuseExistingServer: !process.env.CI,
    },
})
