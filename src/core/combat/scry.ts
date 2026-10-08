import type { Engine } from '../engine'
import { powerAmount } from '../combatMath'

export function scry(engine: Engine, amount: number, sourceCardInstanceId: string): void {
    const player = engine.state.player
    const nirvana = powerAmount(player, 'NIRVANA')
    if (nirvana) engine.enqueue({ kind: 'GainBlock', target: player.id, amount: nirvana })
    const cards = player.drawPile.slice(0, amount + (engine.run?.relics.includes('GOLDEN_EYE') ? 2 : 0))
    if (!cards.length) return
    const finish = (ids: string[]) => {
        for (const id of ids) engine.moveCardToDestination(id, 'draw', 'discardPile')
        for (const card of [...player.discardPile]) if (card.defId === 'WEAVE') engine.moveCardToDestination(card.instanceId, 'discard', 'hand')
    }
    engine.beginChoice({ zone: 'draw', cards, prompt: 'Scry: choose cards to discard', sourceCardInstanceId,
        eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: 0, maxSelections: cards.length, canSkip: true,
        onSubmit: finish, onCancel: () => finish([]) })
}
