import { describe, expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { createEnemyState } from './enemies'
import { powerAmount } from './combatMath'
function battle(ids: string[]) {
    const player = createPlayerFromDeck('regression', [], 72, 72); player.character = 'watcher'; player.energy = 20
    player.hand = ids.map(id => createCardInstance(id))
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 100
    return new Engine('regression', player, [enemy])
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? [engine.state.enemies[0].id] : []); return engine.runUntilIdle() }
describe('character review regressions', () => {
    it('Judgment completes victory and still invokes enemy rebirth hooks', () => {
        const engine = battle(['JUDGMENT']); engine.state.enemies[0].hp = 20
        play(engine, 'JUDGMENT', true); expect(engine.state.victory).toBe(true); expect(engine.canAcceptInput()).toBe(false)
        const rebirth = battle(['JUDGMENT']); const awakened = createEnemyState('AWAKENED_ONE', 'awakened'); awakened.hp = 20; rebirth.state.enemies = [awakened]
        play(rebirth, 'JUDGMENT', true); expect(rebirth.state.victory).toBe(false); expect(awakened.halfDead).toBe(true)
        rebirth.enqueue({ kind: 'EndTurn' }); rebirth.runUntilIdle(); expect(awakened.hp).toBeGreaterThan(0)
    })
    it('winning with Combust during Vault cannot start a lethal extra turn', () => {
        const engine = battle(['VAULT']); engine.state.player.hp = 2; engine.state.enemies[0].hp = 5
        engine.setPowerStacks(engine.state.player, 'COMBUST', 5); engine.setPowerStacks(engine.state.player, 'BRUTALITY', 2)
        play(engine, 'VAULT'); expect(engine.state.victory).toBe(true); expect(engine.state.defeat).toBe(false); expect(engine.state.player.hp).toBe(1)
    })
    it.each([[10, 1], [11, 2]])('Omniscience at counter %i permits %i child plays across Time Warp', (counter, expectedPlays) => {
        const engine = battle(['OMNISCIENCE']); const timeEater = createEnemyState('TIME_EATER', 'time-eater'); timeEater.aiState = { cards: counter }; timeEater.intent = { kind: 'buff' }; engine.state.enemies = [timeEater]
        const protect = createCardInstance('PROTECT'); engine.state.player.drawPile = [protect]
        play(engine, 'OMNISCIENCE'); engine.submitPendingChoice([protect.instanceId]); const events = engine.runUntilIdle()
        expect(events.filter(e => e.kind === 'BlockGained' && e.amount === 12)).toHaveLength(expectedPlays)
        expect(powerAmount(timeEater, 'STRENGTH')).toBe(2)
        expect(engine.state.player.exhaustPile.filter(c => c.defId === 'PROTECT')).toHaveLength(1)
    })
    it('Master Reality upgrades Nightmare copies without changing the original', () => {
        const engine = battle(['NIGHTMARE', 'PROTECT']); engine.setPowerStacks(engine.state.player, 'MASTER_REALITY', 1)
        const original = engine.state.player.hand.find(c => c.defId === 'PROTECT')!
        play(engine, 'NIGHTMARE'); engine.submitPendingChoice([original.instanceId]); engine.runUntilIdle()
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        const copies = engine.state.player.hand.filter(c => c.defId === 'PROTECT' && c.instanceId !== original.instanceId)
        expect(copies).toHaveLength(3); expect(copies.every(c => c.upgradeLevel === 1)).toBe(true); expect(original.upgradeLevel).toBe(0)
    })
    it('Well-Laid Plans preserves the cards Meditate already retained', () => {
        const engine = battle(['MEDITATE', 'STRIKE_WATCHER']); engine.setPowerStacks(engine.state.player, 'WELL_LAID_PLANS', 1)
        const returned = createCardInstance('DEFEND_WATCHER'); engine.state.player.discardPile = [returned]
        engine.state.player.drawPile = Array.from({ length: 5 }, () => createCardInstance('DEFEND_WATCHER'))
        play(engine, 'MEDITATE'); engine.submitPendingChoice([returned.instanceId]); engine.runUntilIdle()
        const choice = engine.getPendingChoice()!; expect(choice.eligibleInstanceIds).not.toContain(returned.instanceId)
        engine.submitPendingChoice([choice.eligibleInstanceIds[0]]); engine.runUntilIdle()
        expect(engine.state.player.hand.some(c => c.instanceId === returned.instanceId)).toBe(true)
        expect(engine.state.player.hand.some(c => c.defId === 'STRIKE_WATCHER')).toBe(true)
    })
})
