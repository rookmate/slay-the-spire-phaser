import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
    resolve: {
        alias: {
            '@sprites': path.resolve(__dirname, 'src/sprites'),
        },
    },
})


