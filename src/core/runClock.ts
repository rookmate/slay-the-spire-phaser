import type Phaser from 'phaser'
import { loadRun, saveRun, type RunState } from './run'
import { JOURNAL_KEY } from './profile/storage'
import { PROFILE_REPLACED } from './storageEvents'

const staleRuns = new WeakSet<RunState>()
const checkpointInterval = 5000

/** Only game frames count, so closing the tab never advances event eligibility. */
export function advanceRunClock(run: RunState, deltaMs: number): void {
    if (Number.isFinite(deltaMs) && deltaMs > 0) run.elapsedSeconds = (run.elapsedSeconds ?? 0) + deltaMs / 1000
}

/** Preserve room-entry inventory and never overwrite a foreign profile replacement. */
export function checkpointRunClock(run: RunState): boolean {
    if (staleRuns.has(run) || localStorage.getItem(JOURNAL_KEY)) return false
    const saved = loadRun()
    if (!saved || (saved.runId ?? saved.seed) !== (run.runId ?? run.seed)) return false
    saved.elapsedSeconds = Math.max(saved.elapsedSeconds ?? 0, run.elapsedSeconds ?? 0)
    saveRun(saved)
    return true
}

/** One clock per game, with bounded writes and an explicit listener lifetime. */
export function attachRunClock(game: Phaser.Game): void {
    let current: RunState | undefined
    let sinceSave = 0
    let dirty = false
    const flush = () => {
        if (!current || !dirty) return
        try { if (checkpointRunClock(current)) { sinceSave = 0; dirty = false } }
        catch { /* Retry later if browser storage is temporarily unavailable. */ }
    }
    const step = (_time: number, delta: number) => {
        const scene = game.scene.getScenes(true)[0] as Phaser.Scene & { run?: RunState }
        const run = scene && !['MainMenu', 'RunSummary', 'DeckBuilder'].includes(scene.scene.key) ? scene.run : undefined
        if (run !== current) { flush(); current = run; sinceSave = 0; dirty = false }
        if (!run || document.hidden) return
        advanceRunClock(run, delta)
        dirty = true
        sinceSave += delta
        if (sinceSave >= checkpointInterval) { flush(); sinceSave = 0 }
    }
    const invalidate = () => {
        for (const scene of game.scene.getScenes(false) as (Phaser.Scene & { run?: RunState })[]) if (scene.run) staleRuns.add(scene.run)
        if (current) staleRuns.add(current)
        sinceSave = 0; dirty = false
    }
    const visibility = () => { if (document.hidden) flush() }
    game.events.on('poststep', step)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', flush)
    window.addEventListener(PROFILE_REPLACED, invalidate)
    game.events.once('destroy', () => {
        flush(); game.events.off('poststep', step)
        document.removeEventListener('visibilitychange', visibility)
        window.removeEventListener('pagehide', flush)
        window.removeEventListener(PROFILE_REPLACED, invalidate)
    })
}
