import { grantNextIroncladUnlock, unlockNextAscension, type MetaState } from './meta'
import type { RunState } from './run'
import type { UnlockBundle } from './unlocks'

export function reachedFirstBoss(run: RunState): boolean {
    return Boolean(run.runFlags?.reachedFirstBoss || run.act > 1 || run.actsCleared?.includes(1)
        || (run.act === 1 && run.pendingRoom?.scene === 'Combat' && run.pendingRoom.roomKind === 'boss'))
}

/** A saved result is recorded once, including an Act 3 clear followed by an Act 4 loss. */
export function recordRunResult(meta: MetaState, run: RunState, result: 'victory' | 'defeat'): { unlockedNext: boolean; unlockBundle?: UnlockBundle } {
    const id = run.runId ?? run.seed
    if (meta.lastRecordedRunId === id) return { unlockedNext: false }
    meta.lastRecordedRunId = id
    meta.previousRunReachedBoss = reachedFirstBoss(run)
    meta.totalRuns++
    const cleared = run.actsCleared?.includes(3) || result === 'victory'
    const unlockedNext = cleared ? unlockNextAscension(meta, run.asc) : false
    let unlockBundle: UnlockBundle | undefined
    if (result === 'victory') {
        meta.totalWins++
        unlockBundle = grantNextIroncladUnlock(meta)
    }
    return { unlockedNext, unlockBundle }
}
