import type { EnemyState } from '../state'
import type { RunState } from '../run'
import { obtainCurse } from '../run'
import { RNG } from '../rng'
import { RANDOM_CURSE_IDS } from '../cards'

export const BLIGHTS = {
    ACCURSED: { name: 'Accursed', description: 'After each boss, gain 2 Curses per stack.' },
    ANCIENT_AUGMENTATION: { name: 'Ancient Augmentation', description: 'Enemies gain 1 Artifact, 10 Plated Armor and 10 Regenerate per stack.' },
    HAUNTINGS: { name: 'Hauntings', description: 'Enemies start combat with 1 Intangible per stack.' },
    VOID_ESSENCE: { name: 'Void Essence', description: 'Lose 1 Energy per turn per stack.' },
    TWISTING_MIND: { name: 'Twisting Mind', description: 'At the end of your turn, add a random Status to your draw pile per stack.' },
    SCATTERBRAIN: { name: 'Scatterbrain', description: 'Draw 1 fewer card each turn per stack.' },
    POST_DURIAN: { name: 'Durian', description: 'Lose half your max HP.' },
} as const
export type BlightId = keyof typeof BLIGHTS
export function blightStacks(run: Partial<RunState> | undefined, id: BlightId): number { return run?.blights?.[id] ?? 0 }
export function hasMuzzle(run: Partial<RunState> | undefined): boolean { return (run?.endlessLoop ?? 0) >= 3 }
export function endlessAttackMultiplier(run: RunState | undefined): number {
    const loop = run?.endlessLoop ?? 0
    return loop ? 2 + 0.75 * (loop - 1) : 1
}
export function modifyEndlessEnemy(run: RunState | undefined, enemy: EnemyState): void {
    if (!run || enemy.aiState?.blightsApplied) return
    enemy.aiState = { ...enemy.aiState, blightsApplied: true }
    if (!enemy.aiState.inheritedHp) {
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * (1 + 0.5 * (run.endlessLoop ?? 0))))
        enemy.hp = Math.min(enemy.maxHp, Math.round(enemy.hp * (1 + 0.5 * (run.endlessLoop ?? 0))))
    }
    const ancient = blightStacks(run, 'ANCIENT_AUGMENTATION'), haunt = blightStacks(run, 'HAUNTINGS')
    if (ancient) enemy.powers.push({ id: 'ARTIFACT', stacks: ancient }, { id: 'PLATED_ARMOR', stacks: 10 * ancient }, { id: 'REGENERATE', stacks: 10 * ancient })
    if (haunt) enemy.powers.push({ id: 'INTANGIBLE', stacks: haunt })
}
export function beginEndlessLoop(run: RunState): void {
    run.endlessLoop = (run.endlessLoop ?? 0) + 1
    if (run.endlessLoop >= 4) for (let i = 0; i < 3; i++) obtainCurse(run, 'PRIDE')
    run.act = 1
    run.eventHistory = {}
    run.keys = { ruby: false, emerald: false, sapphire: false }
}
export function drawBlights(run: RunState): BlightId[] {
    const pool = Object.keys(BLIGHTS) as BlightId[]
    new RNG(`${run.seed}-blights-${run.floor}`).shuffleInPlace(pool)
    return pool.slice(0, 2)
}
export function takeBlight(run: RunState, id: BlightId): boolean {
    if (!run.pendingBlights?.includes(id)) return false
    run.blights ??= {}; run.blights[id] = blightStacks(run, id) + 1
    if (id === 'POST_DURIAN') { run.player.maxHp = Math.max(1, Math.floor(run.player.maxHp / 2)); run.player.hp = Math.min(run.player.hp, run.player.maxHp) }
    run.pendingBlights = undefined
    return true
}
export function bossCurses(run: RunState): void {
    const count = blightStacks(run, 'ACCURSED') * 2 + Number(run.modifiers?.includes('CURSED_RUN') ?? false)
    const rng = new RNG(`${run.seed}-boss-curses-${run.floor}`)
    for (let i = 0; i < count; i++) obtainCurse(run, RANDOM_CURSE_IDS[rng.int(0, RANDOM_CURSE_IDS.length - 1)])
}
