import type { Engine } from '../engine'
import type { CardInstance } from '../state'
import { resolveCard } from '../cards'

/** Unclamped adjustments let Confusion replace the current cost while later changes still apply. */
export function dynamicCostOffset(engine: Engine, card: CardInstance): number {
    return resolveCard(card).dynamicCost?.({ engine, card, cost: 0 }) ?? 0
}
export function recordPlayerHpLoss(engine: Engine): void {
    engine.state.hpLossCount = (engine.state.hpLossCount ?? 0) + 1
    const player = engine.state.player
    const cards = [...player.hand, ...player.drawPile, ...player.discardPile, ...player.exhaustPile, ...engine.state.limbo.map(entry => entry.card)]
    for (const id of new Set(cards.map(card => card.instanceId))) {
        const runtime = engine.getCombatCardRuntime(id)
        runtime.hpLossCount = (runtime.hpLossCount ?? 0) + 1
    }
}
