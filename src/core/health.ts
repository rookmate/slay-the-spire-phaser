import type { RunState } from './run'

export function healRun(run: RunState, amount: number): number {
    if (run.relics.includes('MARK_OF_THE_BLOOM') || run.player.hp <= 0) return 0
    const healed = Math.max(0, Math.min(Math.floor(amount), run.player.maxHp - run.player.hp))
    run.player.hp += healed
    return healed
}
export function changeMaxHp(run: RunState, amount: number): void {
    const previous = run.player.maxHp
    run.player.maxHp = Math.max(1, previous + amount)
    if (amount > 0) healRun(run, amount)
    run.player.hp = Math.min(run.player.hp, run.player.maxHp)
}
export function gainGold(run: RunState, amount: number): void {
    run.gold += Math.max(0, Math.floor(amount))
    if (amount > 0 && run.relics.includes('BLOODY_IDOL')) healRun(run, 5)
}
