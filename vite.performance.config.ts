import { mergeConfig } from 'vite'
import { resolve } from 'node:path'
import base from './vite.config'

// The shipping build stays separate. This minified fixture adds only the existing
// read-only inspector for deterministic combat measurements.
export default mergeConfig(base, {
    build: { outDir: 'dist-performance', rollupOptions: { input: resolve('tests/browser/index.html') } },
})
