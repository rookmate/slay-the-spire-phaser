import { triggerRelicDiscard, triggerRelicShuffle } from '../relics'
import { createCombatCard } from './cardCreation'
import type { Engine } from '../engine'
import type { EmittedEvent } from '../actions'
import type { CardInstance, CardDestination, ChoiceZone } from '../state'
import { CARD_DEFS, resolveCard } from '../cards'
import { HAND_LIMIT, powerAmount } from '../combatMath'
import { onCardDrawn } from '../powerHooks'

export function getCardsInZone(engine: Engine, zone: ChoiceZone): CardInstance[] {
        if (zone === 'draw') return engine.state.player.drawPile
        if (zone === 'offer') return engine.getPendingChoice()?.cards ?? []
        if (zone === 'hand') return engine.state.player.hand
        if (zone === 'discard') return engine.state.player.discardPile
        return engine.state.player.exhaustPile
    }

export function discardCards(engine: Engine, instanceIds: string[], reason: 'manual' | 'end_turn' = 'manual'): void {
        for (const id of instanceIds) {
            const index = engine.state.player.hand.findIndex(card => card.instanceId === id)
            if (index < 0) continue
            const [card] = engine.state.player.hand.splice(index, 1)
            engine.state.player.discardPile.push(card)
            if (reason === 'manual') {
                engine.state.discardsThisTurn++
                if (engine.run) triggerRelicDiscard(engine.getRelicContext())
                CARD_DEFS[card.defId].onDiscard?.({ engine, card })
            }
        }
    }

export function moveCardToDestination(engine: Engine, instanceId: string, zone: ChoiceZone, destination: CardDestination): CardInstance | undefined {
        const source = engine.getCardsInZone(zone)
        const index = source.findIndex(card => card.instanceId === instanceId)
        if (index < 0) return undefined
        const [card] = source.splice(index, 1)
        engine.insertCard(card, destination)
        return card
    }

export function createCardsInDestination(engine: Engine, defId: string, destination: Exclude<CardDestination, 'drawPileTop' | 'exhaustPile'>, count = 1, upgradeLevel = 0): CardInstance[] {
        const created: CardInstance[] = []
        for (let i = 0; i < count; i++) {
            const card = createCombatCard(engine, defId, upgradeLevel)
            created.push(card)
            engine.insertCard(card, destination)
        }
        return created
    }

export function copyCardToHand(engine: Engine, instanceId: string, count = 1): CardInstance[] {
        const source = [
            ...engine.state.player.hand,
            ...engine.state.player.discardPile,
            ...engine.state.player.exhaustPile,
            ...(engine.getLimboCard() ? [engine.getLimboCard()!] : []),
        ].find(card => card.instanceId === instanceId)
        if (!source) return []
        const created: CardInstance[] = []
        for (let i = 0; i < count; i++) {
            const copy = createCombatCard(engine, source)
            engine.insertCard(copy, 'hand')
            created.push(copy)
        }
        return created
    }

export function exhaustCardsInHand(engine: Engine, predicate: (card: CardInstance) => boolean): CardInstance[] {
        const exhausted: CardInstance[] = []
        const kept: CardInstance[] = []
        for (const card of engine.state.player.hand) {
            if (predicate(card)) exhausted.push(card)
            else kept.push(card)
        }
        engine.state.player.hand = kept
        for (const card of exhausted) engine.handleExhaust(card)
        return exhausted
    }

export function processEndOfTurnHand(engine: Engine, events: EmittedEvent[]): void {
        const remainingHand = [...engine.state.player.hand]
        const regretCards = remainingHand.filter(card => card.defId === 'REGRET').length
        if (regretCards > 0) {
            engine.enqueue({ kind: 'LoseHp', target: engine.state.player.id, amount: remainingHand.length * regretCards })
        }
        for (const card of remainingHand) {
            const resolved = resolveCard(card)
            if (card.defId === 'PRIDE') engine.insertCard(createCombatCard(engine, card), 'drawPileTop')
            if (card.defId === 'DOUBT' || card.defId === 'SHAME') engine.enqueue({ kind: 'ApplyPower', target: engine.state.player.id, powerId: card.defId === 'DOUBT' ? 'WEAK' : 'FRAIL', stacks: 1 })
            if (card.defId === 'DECAY') engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: engine.state.player.id, amount: 2, damageType: 'effect', fromCard: true })
            if (card.defId === 'BURN') engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: engine.state.player.id, amount: card.upgradeLevel > 0 ? 4 : 2, damageType: 'effect', fromCard: true })
            if (!(resolved.ethereal || card.defId === 'DAZED')) continue
            const index = engine.state.player.hand.findIndex(entry => entry.instanceId === card.instanceId)
            if (index < 0) continue
            const [etherealCard] = engine.state.player.hand.splice(index, 1)
            engine.handleExhaust(etherealCard)
            events.push({ kind: 'CardExhausted', owner: engine.state.player.id, cardId: etherealCard.defId, instanceId: etherealCard.instanceId })
        }
    }

export function drawOne(engine: Engine): boolean {
        const player = engine.state.player
        if (player.hand.length >= HAND_LIMIT || powerAmount(player, 'NO_DRAW') > 0) return false
        if (!ensureDrawPile(engine)) return false
        const card = player.drawPile.shift()
        if (!card) return false
        player.hand.push(card)
        engine.state.lastDrawnCard = card
        if (powerAmount(player, 'CONFUSION') > 0 && !resolveCard(card).unplayable && !resolveCard(card).xCost) card.confusedCost = engine.rng.int(0, 3)
        onCardDrawn(engine, card)
        return true
    }

export function insertCard(engine: Engine, card: CardInstance, destination: CardDestination): void {
        if (destination === 'hand') {
            const pile = engine.state.player.hand.length < HAND_LIMIT ? engine.state.player.hand : engine.state.player.discardPile
            pile.push(card)
            return
        }
        if (destination === 'discardPile') {
            engine.state.player.discardPile.push(card)
            return
        }
        if (destination === 'drawPileBottom') { engine.state.player.drawPile.push(card); return }
        if (destination === 'drawPileTop') {
            engine.state.player.drawPile.unshift(card)
            return
        }
        if (destination === 'drawPile') {
            const index = engine.state.player.drawPile.length === 0 ? 0 : engine.rng.int(0, engine.state.player.drawPile.length)
            engine.state.player.drawPile.splice(index, 0, card)
            return
        }
        engine.state.player.exhaustPile.push(card)
    }
export function shuffleDrawPile(engine: Engine, includeHand = false): void {
    const player = engine.state.player
    player.drawPile.push(...player.discardPile.splice(0))
    if (includeHand) player.drawPile.push(...player.hand.splice(0))
    engine.rng.shuffleInPlace(player.drawPile)
    if (engine.run) triggerRelicShuffle(engine.getRelicContext())
}
export function ensureDrawPile(engine: Engine): boolean {
    const player = engine.state.player
    if (!player.drawPile.length && player.discardPile.length) shuffleDrawPile(engine)
    return player.drawPile.length > 0
}
