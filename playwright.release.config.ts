import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/release', timeout: 60_000, expect: { timeout: 10_000 },
    fullyParallel: false, workers: 1, retries: 0, forbidOnly: !!process.env.CI,
    reporter: [['list'], ['html', { open: 'never', outputFolder: 'release-report' }]],
    outputDir: 'release-results',
    projects: ['chromium', 'firefox', 'webkit'].map(name => ({ name, use: { browserName: name as 'chromium' | 'firefox' | 'webkit' } })),
    use: {
        baseURL: 'http://127.0.0.1:5195', viewport: { width: 1280, height: 800 },
        trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 10_000, navigationTimeout: 15_000,
    },
    webServer: {
        command: 'npm run preview -- --host 127.0.0.1 --port 5195 --strictPort',
        url: 'http://127.0.0.1:5195/', reuseExistingServer: false,
    },
})
