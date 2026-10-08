import type { RelicCombatContext } from '../relics'
import { getRelicState } from '../relics'
import type { RelicId } from '../run'

export function advanceCounter(ctx: RelicCombatContext, id: RelicId, limit: number): boolean {
    const state = getRelicState(ctx.run, id)
    state.counter = ((state.counter ?? 0) + 1) % limit
    return state.counter === 0
}
export function damageAll({ engine }: RelicCombatContext, amount: number): void {
    for (const enemy of engine.state.enemies.filter(e => e.hp > 0)) engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: enemy.id, amount, damageType: 'effect', origin: 'relic' })
}
