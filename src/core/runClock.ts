import { loadRun, saveRun, type RunState } from './run'

/** Only game frames count, so closing the tab never advances event eligibility. */
export function advanceRunClock(run: RunState, deltaMs: number): void {
    if (Number.isFinite(deltaMs) && deltaMs > 0) run.elapsedSeconds = (run.elapsedSeconds ?? 0) + deltaMs / 1000
}

/** Preserve room-entry inventory and relic counters while a fight is in progress. */
export function checkpointRunClock(run: RunState): void {
    const saved = loadRun()
    if (!saved || (saved.runId ?? saved.seed) !== (run.runId ?? run.seed)) return
    saved.elapsedSeconds = run.elapsedSeconds
    saveRun(saved)
}
