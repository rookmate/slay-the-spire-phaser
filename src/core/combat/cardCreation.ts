import type { Engine } from '../engine'
import type { CardInstance } from '../state'
import { canUpgradeCard, createCardInstance } from '../cards'
import { powerAmount } from '../combatMath'

/** New combat cards get distinct identities and share one creation-upgrade policy. */
export function createCombatCard(engine: Engine, source: string | CardInstance, upgradeLevel = 0): CardInstance {
    const card = typeof source === 'string' ? createCardInstance(source, upgradeLevel)
        : { ...source, instanceId: createCardInstance(source.defId).instanceId, retained: false }
    if (typeof source !== 'string') {
        const runtime = engine.getCombatCardRuntime(source.instanceId)
        engine.state.cardRuntime[card.instanceId] = { ...runtime, triggered: false }
    }
    if (powerAmount(engine.state.player, 'MASTER_REALITY') > 0 && canUpgradeCard(card)) card.upgradeLevel++
    return card
}
