import { describe, expect, it } from 'vitest'
import type { CardInstance, PlayerState } from './state'
import { Engine, createSimplePlayer, createDummyEnemy } from './engine'
import { RNG } from './rng'
import { createEnemyFromSpec } from './enemies'

function createPlayerWithHand(handIds: string[]): PlayerState {
    const player = createSimplePlayer('test-player')
    const hand: CardInstance[] = handIds.map(defId => ({ defId, upgraded: false }))
    player.hand = hand
    player.deck = [...hand]
    player.drawPile = []
    player.discardPile = []
    player.exhaustPile = []
    player.energy = 3
    player.hp = 200
    player.maxHp = 200
    player.powers = []
    return player
}

describe('Engine hard-cutover behavior', () => {
    it('applies enemy debuff intents to the player', () => {
        const player = createPlayerWithHand([])
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'debuff', debuff: 'WEAK', stacks: 2 }

        const engine = new Engine('seed-debuff', player, [enemy])
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        const weak = engine.state.player.powers.find(p => p.id === 'WEAK')
        expect(weak?.stacks).toBe(2)
    })

    it('rerolls intents from enemy specs instead of generic attack/block', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('enemy-seed'), 'GREEN_LOUSE', 'e1')
        const engine = new Engine('seed-intents', player, [enemy])

        for (let i = 0; i < 20; i++) {
            engine.enqueue({ kind: 'EndTurn' })
            engine.runUntilIdle()
            expect(['attack', 'debuff']).toContain(engine.state.enemies[0].intent?.kind)
        }
    })

    it('allows non-target cards to be played without targets', () => {
        const player = createPlayerWithHand(['DOUBLE_TAP'])
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('seed-targetless', player, [enemy])

        const card = engine.state.player.hand[0]
        const events = engine.playCard(card, [])

        expect(events).toHaveLength(1)
        expect(engine.state.player.energy).toBe(2)
        expect(engine.state.player.hand).toHaveLength(0)
        expect(engine.state.player.discardPile.map(c => c.defId)).toContain('DOUBLE_TAP')
    })

    it('rejects all-enemies cards unless all living enemy targets are provided', () => {
        const player = createPlayerWithHand(['CLEAVE'])
        const enemyA = createDummyEnemy('e1')
        const enemyB = createDummyEnemy('e2')
        const engine = new Engine('seed-aoe', player, [enemyA, enemyB])

        const card = engine.state.player.hand[0]
        const failEvents = engine.playCard(card, ['e1'])
        expect(failEvents).toEqual([])
        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.player.hand).toHaveLength(1)

        const okEvents = engine.playCard(card, ['e1', 'e2'])
        expect(okEvents).toHaveLength(1)
        expect(engine.state.player.energy).toBe(2)
        expect(engine.state.player.hand).toHaveLength(0)
    })
})
