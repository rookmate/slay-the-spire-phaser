import { createGame } from '../../src/game'

// Vite serves this test-only entry; the production build only includes src/main.ts.
declare global {
    interface Window { __testGame: ReturnType<typeof createGame> }
}
window.__testGame = createGame()
