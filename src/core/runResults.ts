import { awardUnlockXp, getCharacterProgress, unlockNextAscension, type MetaState } from './meta'
import type { RunState } from './run'
import { calculateScore } from './score'
import type { UnlockBundle } from './unlocks'

export function reachedFirstBoss(run: RunState): boolean {
    return Boolean(run.runFlags?.reachedFirstBoss || run.act > 1 || run.actsCleared?.includes(1)
        || (run.act === 1 && run.pendingRoom?.scene === 'Combat' && run.pendingRoom.roomKind === 'boss'))
}
/** Record once; content XP and standard-run progression have different eligibility. */
export function recordRunResult(meta: MetaState, run: RunState, result: 'victory' | 'defeat'): { unlockedNext: boolean; unlockBundle?: UnlockBundle; score: number } {
    const id = run.runId ?? run.seed, score = calculateScore(run, result === 'victory').total
    if (meta.lastRecordedRunId === id || meta.history?.some(entry => entry.id === id)) return { unlockedNext: false, score }
    const progress = getCharacterProgress(meta, run.character)
    const defectWasUnlocked = getCharacterProgress(meta, 'defect').unlocked
    meta.lastRecordedRunId = id
    progress.previousRunReachedBoss = reachedFirstBoss(run)
    if (run.character === 'ironclad') meta.previousRunReachedBoss = progress.previousRunReachedBoss
    meta.totalRuns++
    if (result === 'victory') meta.totalWins++
    const cleared = run.actsCleared?.includes(3) || result === 'victory'
    const standard = run.mode === 'standard'
    const unlockedNext = cleared && standard ? unlockNextAscension(meta, run.asc, run.character) : false
    if (standard && cleared) progress.act3Cleared = true
    const unlockBundle = awardUnlockXp(meta, run.character, score)
    if (!(run.mode === 'daily' && result === 'victory')) {
        getCharacterProgress(meta, 'silent').unlocked = true
        if (run.character === 'silent') getCharacterProgress(meta, 'defect').unlocked = true
        if (standard && cleared && defectWasUnlocked) getCharacterProgress(meta, 'watcher').unlocked = true
    }
    meta.history ??= []
    meta.history.unshift({ id, date: new Date().toISOString(), character: run.character, mode: run.mode, seed: run.seed, ascension: run.asc,
        result, floor: run.floor, actsCleared: [...(run.actsCleared ?? [])], score, elapsedSeconds: run.elapsedSeconds ?? 0,
        deck: run.deck.map(card => ({ id: card.defId, upgrade: card.upgradeLevel })), relics: [...run.relics] })
    meta.history = meta.history.slice(0, 500)
    return { unlockedNext, unlockBundle, score }
}
