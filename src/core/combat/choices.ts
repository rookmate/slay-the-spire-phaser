import { createCardInstance } from '../cards'
import { createCombatCard } from './cardCreation'
import type { Engine } from '../engine'
import type { CardDef, CardDestination, CardInstance, CardType } from '../state'
import { selectCombatCardPool } from '../contentPools'

export function chooseDiscard(engine: Engine, count: number, sourceCardInstanceId: string, after?: () => void): void {
    const cards = engine.state.player.hand
    const amount = Math.min(count, cards.length)
    if (!amount) { after?.(); return }
    if (amount === cards.length) { engine.discardCards(cards.map(c => c.instanceId)); after?.(); return }
    engine.beginChoice({ prompt: `Discard ${amount} ${amount === 1 ? 'card' : 'cards'}`, zone: 'hand', sourceCardInstanceId,
        eligibleInstanceIds: cards.map(c => c.instanceId), minSelections: amount, maxSelections: amount, canSkip: false,
        onSubmit: ids => { engine.discardCards(ids); after?.() } })
}
export interface GenerateCardOptions {
    type?: CardType
    zeroCost?: 'turn' | 'combat'
    rarity?: CardDef['rarity']
    colorless?: boolean
    upgrade?: boolean
    destination?: CardDestination
}
export function generateCard(engine: Engine, options: GenerateCardOptions = {}): CardInstance | undefined {
    const pool = selectCombatCardPool(engine, { source: 'generated', type: options.type, rarity: options.rarity, ...(options.colorless ? { colors: ['colorless'] } : {}) })
    if (!pool.length) return
    const card = createCombatCard(engine, pool[engine.rng.int(0, pool.length - 1)], options.upgrade ? 1 : 0)
    if (options.zeroCost === 'turn') card.costForTurn = 0
    if (options.zeroCost === 'combat') card.costForCombat = 0
    engine.insertCard(card, options.destination ?? 'hand')
    return card
}

export function offerCards(engine: Engine, cards: CardInstance[], source: string, onSelect: (card: CardInstance) => void, canSkip = true): void {
    if (!cards.length) return
    engine.beginChoice({ zone: 'offer', cards, prompt: 'Choose a card', sourceCardInstanceId: source, eligibleInstanceIds: cards.map(c => c.instanceId),
        minSelections: 1, maxSelections: 1, canSkip, onSubmit: ids => { const card = cards.find(c => c.instanceId === ids[0]); if (card) onSelect(card) } })
}

export function discoverCards(engine: Engine, source: string, options: { type?: CardType; colorless?: boolean; copies?: number } = {}): void {
    const pool = selectCombatCardPool(engine, { source: 'generated', type: options.type, ...(options.colorless ? { colors: ['colorless'] } : {}) })
    engine.rng.shuffleInPlace(pool)
    offerCards(engine, pool.slice(0, 3).map(id => createCardInstance(id)), source, selected => {
        for (let i = 0; i < (options.copies ?? 1); i++) {
            const card = createCombatCard(engine, selected); card.costForTurn = 0; engine.insertCard(card, 'hand')
        }
    })
}
