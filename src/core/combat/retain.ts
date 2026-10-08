import type { Engine } from '../engine'
import { CARD_DEFS, resolveCard } from '../cards'
import { powerAmount } from '../combatMath'

export function prepareRetainChoice(engine: Engine): void {
    const player = engine.state.player
    const count = powerAmount(player, 'WELL_LAID_PLANS')
    if (count <= 0 || powerAmount(player, 'EQUILIBRIUM') > 0 || engine.run?.relics.includes('RUNIC_PYRAMID')) return
    const cards = player.hand.filter(card => !resolveCard(card).retain && !card.retained)
    if (!cards.length) return
    engine.beginChoice({ prompt: `Retain up to ${count} cards`, zone: 'hand', sourceCardInstanceId: 'well-laid-plans',
        eligibleInstanceIds: cards.map(card => card.instanceId), minSelections: 0, maxSelections: Math.min(count, cards.length), canSkip: true,
        onSubmit: ids => { for (const card of player.hand) if (ids.includes(card.instanceId)) card.retained = true } })
}

export function discardEndTurnHand(engine: Engine): void {
    const player = engine.state.player
    const pyramid = engine.run?.relics.includes('RUNIC_PYRAMID')
    const equilibrium = powerAmount(player, 'EQUILIBRIUM') > 0
    for (const card of [...player.hand]) {
        if (resolveCard(card).retain || card.retained || equilibrium) {
            CARD_DEFS[card.defId].onRetain?.({ engine, card })
            const reduction = powerAmount(player, 'ESTABLISHMENT')
            if (reduction > 0 && !resolveCard(card).xCost && !resolveCard(card).unplayable)
                card.costForCombat = Math.max(0, (card.costForCombat ?? resolveCard(card).cost) - reduction)
        } else if (!pyramid) engine.discardCards([card.instanceId], 'end_turn')
    }
    for (const card of [...player.hand, ...player.drawPile, ...player.discardPile, ...player.exhaustPile]) {
        card.costForTurn = undefined
        card.retained = false
    }
    engine.setPowerStacks(player, 'EQUILIBRIUM', Math.max(0, powerAmount(player, 'EQUILIBRIUM') - 1))
}
