import { describe, expect, it } from 'vitest'
import { resolveCard } from './cards'
import type { CardInstance, PlayerState } from './state'
import { Engine, createSimplePlayer, createDummyEnemy } from './engine'
import { RNG } from './rng'
import { createEnemyFromSpec } from './enemies'
import { getCombatRelicBonuses } from './relics'
import { generateRewardBundle } from './rewards'

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

describe('Act 1 MVP engine behavior', () => {
    it('resolves upgraded card stats', () => {
        const strike = resolveCard({ defId: 'STRIKE', upgraded: true })
        const bodySlam = resolveCard({ defId: 'BODY_SLAM', upgraded: true })

        expect(strike.baseDamage).toBe(9)
        expect(strike.name).toBe('Strike+')
        expect(bodySlam.cost).toBe(0)
    })

    it('allows targetless cards to play and emits energy plus card-play events', () => {
        const player = createPlayerWithHand(['DOUBLE_TAP'])
        const engine = new Engine('seed-targetless', player, [createDummyEnemy('e1')])
        const events = engine.playCard(engine.state.player.hand[0], [])

        expect(events.map(event => event.kind)).toEqual(['EnergyChanged', 'CardPlayed'])
        expect(engine.state.player.energy).toBe(2)
    })

    it('rejects all-enemy attacks unless every living target is supplied', () => {
        const player = createPlayerWithHand(['CLEAVE'])
        const engine = new Engine('seed-aoe', player, [createDummyEnemy('e1'), createDummyEnemy('e2')])

        expect(engine.playCard(engine.state.player.hand[0], ['e1'])).toEqual([])
        expect(engine.playCard(engine.state.player.hand[0], ['e1', 'e2']).map(event => event.kind)).toEqual(['EnergyChanged', 'CardPlayed'])
    })

    it('seeing red exhausts and grants energy', () => {
        const player = createPlayerWithHand(['SEEING_RED'])
        const engine = new Engine('seed-seeing-red', player, [createDummyEnemy('e1')])

        engine.playCard(engine.state.player.hand[0], [])
        engine.runUntilIdle()

        expect(engine.state.player.energy).toBe(5)
        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('SEEING_RED')
    })

    it('double tap duplicates the next attack', () => {
        const player = createPlayerWithHand(['DOUBLE_TAP', 'STRIKE'])
        const enemy = createDummyEnemy('e1')
        const engine = new Engine('seed-double-tap', player, [enemy])

        engine.playCard(engine.state.player.hand[0], [])
        engine.playCard(engine.state.player.hand[0], ['e1'])
        engine.runUntilIdle()

        expect(engine.state.enemies[0].hp).toBe(28)
    })

    it('flame barrier deals retaliatory damage on attack', () => {
        const player = createPlayerWithHand(['FLAME_BARRIER'])
        const enemy = createDummyEnemy('e1')
        enemy.intent = { kind: 'attack', amount: 5 }
        const engine = new Engine('seed-flame-barrier', player, [enemy])

        engine.playCard(engine.state.player.hand[0], [])
        engine.runUntilIdle()
        engine.enqueue({ kind: 'EndTurn' })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].hp).toBe(36)
        expect(engine.state.player.hp).toBe(200)
    })

    it('reaper heals only for actual unblocked damage', () => {
        const player = createPlayerWithHand(['REAPER'])
        player.hp = 10
        player.maxHp = 80
        const enemy = createDummyEnemy('e1')
        enemy.block = 3
        const engine = new Engine('seed-reaper', player, [enemy])

        engine.playCard(engine.state.player.hand[0], ['e1'])
        engine.runUntilIdle()

        expect(engine.state.player.hp).toBe(11)
    })

    it('dropkick refunds energy when the target is vulnerable', () => {
        const player = createPlayerWithHand(['DROPKICK'])
        player.drawPile = [{ defId: 'STRIKE', upgraded: false }]
        const enemy = createDummyEnemy('e1')
        enemy.powers.push({ id: 'VULNERABLE', stacks: 1 })
        const engine = new Engine('seed-dropkick', player, [enemy])

        engine.playCard(engine.state.player.hand[0], ['e1'])
        engine.runUntilIdle()

        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.player.hand.map(card => card.defId)).toContain('STRIKE')
    })

    it('corruption makes skills free and exhausts them', () => {
        const player = createPlayerWithHand(['DEFEND'])
        player.powers.push({ id: 'CORRUPTION', stacks: 1 })
        const engine = new Engine('seed-corruption', player, [createDummyEnemy('e1')])

        engine.playCard(engine.state.player.hand[0], [])
        engine.runUntilIdle()

        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.player.exhaustPile.map(card => card.defId)).toContain('DEFEND')
    })

    it('gremlin nob gains strength when the player plays a skill', () => {
        const player = createPlayerWithHand(['DEFEND'])
        const enemy = createEnemyFromSpec(new RNG('nob-seed'), 'GREMLIN_NOB', 'e1')
        const engine = new Engine('seed-nob', player, [enemy])

        engine.playCard(engine.state.player.hand[0], [])

        expect(engine.state.enemies[0].powers.find(power => power.id === 'STRENGTH')?.stacks).toBe(2)
    })

    it('lagavulin wakes after taking damage', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('laga-seed'), 'LAGAVULIN', 'e1')
        const engine = new Engine('seed-laga', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 10 })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.asleep).toBe(false)
    })

    it('the guardian enters defense mode after enough damage', () => {
        const player = createPlayerWithHand([])
        const enemy = createEnemyFromSpec(new RNG('guardian-seed'), 'THE_GUARDIAN', 'e1')
        const engine = new Engine('seed-guardian', player, [enemy])

        engine.enqueue({ kind: 'DealDamage', source: player.id, target: enemy.id, amount: 35 })
        engine.runUntilIdle()

        expect(engine.state.enemies[0].aiState?.mode).toBe('defense')
        expect(engine.state.enemies[0].block).toBeGreaterThanOrEqual(20)
    })

    it('computes combat relic bonuses and reward bundles', () => {
        const bonuses = getCombatRelicBonuses(['BURNING_BLOOD', 'ANCHOR', 'LANTERN', 'BRONZE_SCALES', 'PRESERVED_INSECT'], 'elite')
        const rewards = generateRewardBundle('reward-seed', 'elite', ['BURNING_BLOOD'])

        expect(bonuses.startingBlock).toBe(10)
        expect(bonuses.energyBonus).toBe(1)
        expect(bonuses.startingThorns).toBe(3)
        expect(bonuses.eliteHpMultiplier).toBe(0.75)
        expect(rewards.items.some(item => item.kind === 'relic')).toBe(true)
        expect(rewards.items.some(item => item.kind === 'cards')).toBe(true)
    })
})
