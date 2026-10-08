import { describe, expect, it } from 'vitest'
import { createCardInstance, createStarterDeck } from './cards'
import { createCombatEngine } from './combat'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { createNewRun } from './run'
import { powerAmount } from './combatMath'

function battle(character: 'silent' | 'defect' | 'watcher', ids: string[]) {
    const player = createPlayerFromDeck('resources', ids.map(id => createCardInstance(id)), 70, 70)
    player.character = character
    player.orbSlots = character === 'defect' ? 3 : 0
    player.hand = player.drawPile.splice(0)
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 500
    return new Engine('resources', player, [enemy])
}
function play(engine: Engine, id: string, targets: string[] = []) {
    const card = engine.state.player.hand.find(c => c.defId === id)!
    engine.playCard(card, targets); engine.runUntilIdle()
}

describe('character resources', () => {
    it('gives each character its own starter deck, health and opening relic effect', () => {
        expect(createStarterDeck('silent')).toHaveLength(12)
        for (const character of ['ironclad', 'silent', 'defect', 'watcher'] as const) {
            const run = createNewRun({ character, seed: 'opening' })
            const engine = createCombatEngine(run, 'monster')
            expect(engine.state.player.character).toBe(character)
            expect(engine.state.player.hand).toHaveLength(character === 'silent' ? 7 : character === 'watcher' ? 6 : 5)
            expect(engine.state.player.orbs.map(o => o.type)).toEqual(character === 'defect' ? ['lightning'] : [])
            expect(run.deck.every(c => c.defId !== 'STRIKE' || character === 'ironclad')).toBe(true)
        }
    })
    it('Survivor waits for a discard and records only a manual discard', () => {
        const engine = battle('silent', ['SURVIVOR', 'STRIKE_SILENT'])
        play(engine, 'SURVIVOR')
        expect(engine.state.player.block).toBe(8)
        expect(engine.getPendingChoice()?.zone).toBe('hand')
        engine.submitPendingChoice([engine.state.player.hand[0].instanceId]); engine.runUntilIdle()
        expect(engine.state.discardsThisTurn).toBe(1)
        expect(engine.state.player.discardPile.map(c => c.defId)).toEqual(['STRIKE_SILENT', 'SURVIVOR'])
        expect(engine.state.limbo).toEqual([])
    })
    it('channels, overflows and evokes the first orb twice with Focus', () => {
        const engine = battle('defect', ['DUALCAST'])
        engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FOCUS', stacks: 2 })
        for (let i = 0; i < 4; i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' })
        engine.runUntilIdle()
        expect(engine.state.player.orbs).toHaveLength(3)
        expect(engine.state.enemies[0].hp).toBe(490)
        play(engine, 'DUALCAST')
        expect(engine.state.enemies[0].hp).toBe(470)
        expect(engine.state.player.orbs).toHaveLength(2)
        expect(engine.state.orbsChanneled.lightning).toBe(4)
    })
    it('Dark grows after channeling; Plasma ignores Focus', () => {
        const engine = battle('defect', [])
        engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'FOCUS', stacks: -2 })
        engine.enqueue({ kind: 'ChannelOrb', orbType: 'dark' })
        engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' })
        engine.enqueue({ kind: 'OrbPassives', phase: 'end' }); engine.runUntilIdle()
        expect(engine.state.player.orbs[0].storedDamage).toBe(10)
        expect(engine.state.player.energy).toBe(3)
        engine.enqueue({ kind: 'OrbPassives', phase: 'start' }); engine.runUntilIdle()
        expect(engine.state.player.energy).toBe(4)
    })
    it('Eruption damages before Wrath and leaving Calm grants energy once', () => {
        const engine = battle('watcher', ['ERUPTION'])
        engine.enqueue({ kind: 'ChangeStance', stance: 'calm' }); engine.runUntilIdle()
        play(engine, 'ERUPTION', ['enemy'])
        expect(engine.state.enemies[0].hp).toBe(491)
        expect(engine.state.player.stance).toBe('wrath')
        expect(engine.state.player.energy).toBe(3)
        expect(engine.previewDamage('player', 'enemy', 6)).toBe(12)
        expect(engine.previewEnemyAttack(engine.state.enemies[0])).toBe(10)
        engine.enqueue({ kind: 'ChangeStance', stance: 'wrath' }); engine.runUntilIdle()
        expect(engine.state.player.energy).toBe(3)
    })
    it('Divinity expires at the next player turn', () => {
        const engine = battle('watcher', [])
        engine.enqueue({ kind: 'ChangeStance', stance: 'divinity' }); engine.runUntilIdle()
        expect(engine.state.player.energy).toBe(6)
        expect(engine.previewDamage('player', 'enemy', 6)).toBe(18)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.player.stance).toBe('neutral')
        expect(powerAmount(engine.state.player, 'FOCUS')).toBe(0)
    })
})
