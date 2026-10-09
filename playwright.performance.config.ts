import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './tests/performance', timeout: 120_000, workers: 1, retries: 0,
    reporter: [['list']], outputDir: 'performance-results',
    use: { viewport: { width: 844, height: 390 }, trace: 'off', screenshot: 'only-on-failure' },
    webServer: [
        { command: 'npx vite preview --host 127.0.0.1 --port 5190 --strictPort', url: 'http://127.0.0.1:5190', reuseExistingServer: false },
        { command: 'npx vite preview --outDir dist-performance --host 127.0.0.1 --port 5191 --strictPort', url: 'http://127.0.0.1:5191/tests/browser/', reuseExistingServer: false },
    ],
})
