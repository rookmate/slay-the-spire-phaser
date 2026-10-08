import { hasMuzzle } from './modes/endless'
import type { RunState } from './run'

export function healRun(run: RunState, amount: number): number {
    if (run.relics.includes('MARK_OF_THE_BLOOM') || run.player.hp <= 0) return 0
    const healed = Math.max(0, Math.min(Math.floor(amount * (hasMuzzle(run) ? 0.5 : 1)), run.player.maxHp - run.player.hp))
    run.player.hp += healed
    return healed
}
export function canIncreaseMaxHp(run: Partial<RunState> | undefined): boolean { return !hasMuzzle(run) }
export function changeMaxHp(run: RunState, amount: number): void {
    if (amount > 0 && !canIncreaseMaxHp(run)) return
    const previous = run.player.maxHp
    run.player.maxHp = Math.max(1, previous + amount)
    if (amount > 0) healRun(run, amount)
    run.player.hp = Math.min(run.player.hp, run.player.maxHp)
}
export function gainGold(run: RunState, amount: number, heal: (amount: number) => void = amount => { healRun(run, amount) }): void {
    if (run.relics.includes('ECTOPLASM')) return
    run.gold += Math.max(0, Math.floor(amount))
    run.stats ??= {}; run.stats.goldEarned = (run.stats.goldEarned ?? 0) + Math.max(0, Math.floor(amount))
    if (amount > 0 && run.relics.includes('BLOODY_IDOL')) heal(5)
}

export function combatHealingAmount(run: Pick<RunState, 'relics'> & Partial<Pick<RunState, 'endlessLoop'>> | undefined, amount: number): number {
    if (run?.relics.includes('MARK_OF_THE_BLOOM')) return 0
    return Math.max(0, Math.round(amount * (hasMuzzle(run) ? 0.5 : 1) * (run?.relics.includes('MAGIC_FLOWER') ? 1.5 : 1)))
}
