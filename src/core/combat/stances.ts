import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'
import type { StanceId } from './resources'

export function changeStance(engine: Engine, stance: StanceId): void {
    const player = engine.state.player
    if (player.stance === stance) return
    if (player.stance === 'calm') engine.enqueue({ kind: 'GainEnergy', amount: engine.run?.relics.includes('VIOLET_LOTUS') ? 3 : 2 })
    player.stance = stance
    if (stance === 'divinity') engine.enqueue({ kind: 'GainEnergy', amount: 3 })
    const block = powerAmount(player, 'MENTAL_FORTRESS')
    if (block > 0) engine.enqueue({ kind: 'GainBlock', target: player.id, amount: block })
    const draw = powerAmount(player, 'RUSHDOWN')
    if (stance === 'wrath' && draw > 0) engine.enqueue({ kind: 'DrawCards', count: draw })
    for (const card of [...player.discardPile]) if (card.defId === 'FLURRY_OF_BLOWS') engine.moveCardToDestination(card.instanceId, 'discard', 'hand')
}

export function gainMantra(engine: Engine, amount: number): void {
    if (amount <= 0) return
    engine.state.mantraGained = (engine.state.mantraGained ?? 0) + amount
    const total = powerAmount(engine.state.player, 'MANTRA') + amount
    engine.setPowerStacks(engine.state.player, 'MANTRA', total % 10)
    if (total >= 10) engine.enqueue({ kind: 'ChangeStance', stance: 'divinity' })
}
