import type { Engine } from '../engine'
import { resolveCard } from '../cards'
import type { CardInstance, PowerId } from '../state'
import { powerAmount } from '../combatMath'

export function prepareRepeats(engine: Engine, card: CardInstance, spentEnergy: number): ('original' | 'echo' | 'other')[] {
    const type = resolveCard(card).type
    const player = engine.state.player
    const result: ('original' | 'echo' | 'other')[] = ['original']
    if ((engine.state.cardsPlayed ?? 0) - (engine.state.echoRepeatsThisTurn ?? 0) < powerAmount(player, 'ECHO_FORM')) result.push('echo')
    const ids: PowerId[] = ['DUPLICATION']
    if (type === 'attack') ids.push('DOUBLE_TAP')
    if (type === 'skill') ids.push('BURST')
    if (type === 'power') ids.push('AMPLIFY')
    for (const id of ids) if (powerAmount(player, id) > 0) {
        engine.setPowerStacks(player, id, powerAmount(player, id) - 1)
        result.push('other')
    }
    if (type === 'attack' && spentEnergy >= 2 && engine.run?.relics.includes('NECRONOMICON')) {
        const entry = engine.getRelicContext().runtime.NECRONOMICON ??= {}
        if (entry.turnCounter !== engine.state.turnNumber) { entry.turnCounter = engine.state.turnNumber; result.push('other') }
    }
    return result
}
