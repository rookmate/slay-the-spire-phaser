import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance } from './cards'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { powerAmount } from './combatMath'
import { createNewRun } from './run'
import { createEnemyState } from './enemies'
function battle(ids: string[]) {
    const run = createNewRun({ character: 'watcher', seed: 'watcher' }); run.deck = ids.map(id => createCardInstance(id))
    const player = createPlayerFromDeck('watcher', run.deck, 72, 72); player.character = 'watcher'; player.energy = 20; player.hand = player.drawPile.splice(0)
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 500
    return new Engine('watcher', player, [enemy], { run })
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
describe('Watcher cards', () => {
    it('has all 75 colored cards', () => expect(Object.values(CARD_DEFS).filter(c => c.color === 'watcher')).toHaveLength(75))
    it('Scry exposes only the top cards, returns Weave, and draws after the choice', () => {
        const engine = battle(['CUT_THROUGH_FATE']); const cards = ['WEAVE', 'REFLEX', 'DEFEND_WATCHER'].map(id => createCardInstance(id)); engine.state.player.drawPile = cards
        play(engine, 'CUT_THROUGH_FATE', true)
        const choice = engine.getPendingChoice()!; expect(choice.cards).toHaveLength(2)
        engine.submitPendingChoice(choice.eligibleInstanceIds); engine.runUntilIdle()
        expect(engine.state.player.hand.map(c => c.defId)).toEqual(['WEAVE', 'DEFEND_WATCHER'])
        expect(engine.state.discardsThisTurn).toBe(0); expect(engine.state.player.discardPile.some(c => c.defId === 'REFLEX')).toBe(true)
    })
    it('Mantra enters Divinity, tracks combat total, and grants Calm exit energy', () => {
        const engine = battle(['WORSHIP', 'WORSHIP']); engine.state.player.stance = 'calm'
        play(engine, 'WORSHIP'); play(engine, 'WORSHIP')
        expect(engine.state.player.stance).toBe('divinity'); expect(engine.state.player.energy).toBe(21)
        expect(powerAmount(engine.state.player, 'MANTRA')).toBe(0); expect(engine.state.mantraGained).toBe(10)
    })
    it('Vault skips enemies without expiring Intangible, Vulnerable or Heart Invincible', () => {
        const engine = battle(['VAULT']); const heart = createEnemyState('CORRUPT_HEART', 'heart'); heart.aiState!.damageThisTurn = 250; heart.block = 12; engine.state.enemies = [heart]
        engine.setPowerStacks(engine.state.player, 'INTANGIBLE', 2); engine.setPowerStacks(engine.state.player, 'VULNERABLE', 2)
        play(engine, 'VAULT')
        expect(engine.state.player.hp).toBe(71) // Beat of Death still applies to Vault itself.
        expect(engine.state.turn).toBe('player'); expect(engine.state.player.energy).toBe(3)
        expect(powerAmount(engine.state.player, 'INTANGIBLE')).toBe(2); expect(powerAmount(engine.state.player, 'VULNERABLE')).toBe(2)
        expect(heart.block).toBe(12); expect(heart.aiState!.damageThisTurn).toBe(250)
    })
    it('Omniscience suspends its parent for nested choices and exhausts each card once', () => {
        const engine = battle(['OMNISCIENCE']); const nested = createCardInstance('OMNISCIENCE'), worship = createCardInstance('WORSHIP'), protect = createCardInstance('PROTECT')
        engine.state.player.drawPile = [nested, worship, protect]
        play(engine, 'OMNISCIENCE'); engine.submitPendingChoice([nested.instanceId]); engine.runUntilIdle()
        expect(engine.getPendingChoice()).toBeDefined()
        engine.submitPendingChoice([worship.instanceId]); engine.runUntilIdle()
        expect(engine.getPendingChoice()).toBeDefined()
        engine.submitPendingChoice([protect.instanceId]); engine.runUntilIdle()
        expect(engine.getPendingChoice()).toBeUndefined(); expect(engine.state.player.exhaustPile).toHaveLength(4)
        expect(new Set(engine.state.player.exhaustPile.map(c => c.instanceId)).size).toBe(4)
        expect(engine.state.player.stance).toBe('divinity'); expect(engine.state.player.block).toBe(24)
    })
    it('Pressure Points stacks Mark and bypasses Block while respecting Artifact', () => {
        const engine = battle(['PRESSURE_POINTS', 'PRESSURE_POINTS']); const enemy = engine.state.enemies[0]; enemy.block = 100; enemy.powers = [{ id: 'ARTIFACT', stacks: 1 }]
        play(engine, 'PRESSURE_POINTS', true); expect(enemy.hp).toBe(500)
        play(engine, 'PRESSURE_POINTS', true); expect(enemy.hp).toBe(492); expect(enemy.block).toBe(100)
    })
    it('retained cards grow and Establishment discounts them', () => {
        const engine = battle(['ESTABLISHMENT', 'WINDMILL_STRIKE', 'PERSEVERANCE', 'SANDS_OF_TIME']); play(engine, 'ESTABLISHMENT')
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        const windmill = engine.state.player.hand.find(c => c.defId === 'WINDMILL_STRIKE')!, sands = engine.state.player.hand.find(c => c.defId === 'SANDS_OF_TIME')!
        expect(engine.getCardCost(windmill)).toBe(1); expect(engine.getCardCost(sands)).toBe(2)
        expect(engine.getCardCombatBonusDamage(windmill.instanceId)).toBe(4)
        play(engine, 'PERSEVERANCE'); expect(engine.state.player.block).toBe(7)
    })
    it('Master Reality upgrades generated cards and Conjure Blade preserves its hit count', () => {
        const engine = battle(['MASTER_REALITY', 'CONJURE_BLADE']); play(engine, 'MASTER_REALITY'); engine.state.player.energy = 2; play(engine, 'CONJURE_BLADE')
        const expunger = engine.state.player.drawPile[0]; expect(expunger.upgradeLevel).toBe(1); expect(expunger.storedHits).toBe(2)
        engine.moveCardToDestination(expunger.instanceId, 'draw', 'hand'); engine.state.player.energy = 1; play(engine, 'EXPUNGER', true); expect(engine.state.enemies[0].hp).toBe(470)
    })
    it('Blasphemy cannot be blocked by Artifact but Buffer prevents the lethal HP loss', () => {
        const engine = battle(['BLASPHEMY']); engine.setPowerStacks(engine.state.player, 'ARTIFACT', 1); engine.setPowerStacks(engine.state.player, 'BUFFER', 1)
        engine.state.enemies[0].intent = { kind: 'buff' }; play(engine, 'BLASPHEMY'); engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.defeat).toBe(false); expect(powerAmount(engine.state.player, 'ARTIFACT')).toBe(1); expect(powerAmount(engine.state.player, 'BUFFER')).toBe(0)
    })
    it('Wish chooses an effect without playing an extra card or putting an option in the deck', () => {
        const engine = battle(['WISH']); play(engine, 'WISH'); const offer = engine.getPendingChoice()!.cards!.find(c => c.defId === 'FAME_AND_FORTUNE')!
        engine.submitPendingChoice([offer.instanceId]); engine.runUntilIdle(); expect(engine.run!.gold).toBe(124); expect(engine.state.cardsPlayed).toBe(1)
    })
})
