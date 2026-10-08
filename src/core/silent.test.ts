import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance } from './cards'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { powerAmount } from './combatMath'
function battle(ids: string[]) {
    const player = createPlayerFromDeck('silent', [], 70, 70); player.character = 'silent'; player.energy = 20
    player.hand = ids.map(id => createCardInstance(id))
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 100
    return new Engine('silent', player, [enemy])
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
describe('Silent cards', () => {
    it('has all 75 colored cards with a playable effect or discard hook', () => {
        const cards = Object.values(CARD_DEFS).filter(c => c.color === 'silent')
        expect(cards).toHaveLength(75)
        expect(cards.every(c => c.onPlay || c.baseDamage || c.baseBlock || c.onDiscard)).toBe(true)
    })
    it('Poison ignores Block, decrements, and kills before the enemy attacks', () => {
        const engine = battle(['DEADLY_POISON']); const enemy = engine.state.enemies[0]; enemy.hp = 5; enemy.block = 99
        play(engine, 'DEADLY_POISON', true); engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.victory).toBe(true); expect(engine.state.player.hp).toBe(70)
    })
    it('Corpse Explosion resolves from Poison and Artifact blocks its two debuffs separately', () => {
        const engine = battle(['CORPSE_EXPLOSION']); const enemy = engine.state.enemies[0]; enemy.hp = 5; enemy.maxHp = 50
        const second = createDummyEnemy('second'); second.hp = second.maxHp = 40; engine.state.enemies.push(second)
        play(engine, 'CORPSE_EXPLOSION', true); engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.victory).toBe(true)
        const blocked = battle(['CORPSE_EXPLOSION']); blocked.state.enemies[0].powers.push({ id: 'ARTIFACT', stacks: 1 })
        play(blocked, 'CORPSE_EXPLOSION', true)
        expect(powerAmount(blocked.state.enemies[0], 'POISON')).toBe(0)
        expect(powerAmount(blocked.state.enemies[0], 'CORPSE_EXPLOSION')).toBe(1)
    })
    it('manual discard triggers Reflex and Tactician while turn-end discard does not', () => {
        const engine = battle(['CALCULATED_GAMBLE', 'REFLEX', 'TACTICIAN'])
        engine.state.player.drawPile = Array.from({ length: 5 }, () => createCardInstance('DEFEND_SILENT'))
        play(engine, 'CALCULATED_GAMBLE')
        expect(engine.state.player.hand).toHaveLength(4); expect(engine.state.player.energy).toBe(21)
        expect(engine.state.discardsThisTurn).toBe(2)
        const end = battle(['REFLEX', 'TACTICIAN']); end.enqueue({ kind: 'DiscardHand' }); end.runUntilIdle()
        expect(end.state.player.hand).toHaveLength(0); expect(end.state.player.energy).toBe(20)
    })
    it('Burst repeats Acrobatics after a separate discard choice, then restores card ownership', () => {
        const engine = battle(['BURST', 'ACROBATICS', 'STRIKE_SILENT', 'STRIKE_SILENT'])
        engine.state.player.drawPile = Array.from({ length: 8 }, () => createCardInstance('DEFEND_SILENT'))
        play(engine, 'BURST'); play(engine, 'ACROBATICS')
        const first = engine.getPendingChoice()!; expect(first).toBeDefined()
        engine.submitPendingChoice([first.eligibleInstanceIds[0]]); engine.runUntilIdle()
        const second = engine.getPendingChoice()!; expect(second.id).not.toBe(first.id)
        engine.submitPendingChoice([second.eligibleInstanceIds[0]]); engine.runUntilIdle()
        expect(engine.state.player.hand).toHaveLength(6)
        expect(engine.state.player.discardPile.filter(c => c.defId === 'ACROBATICS')).toHaveLength(1)
    })
    it('Wraith Form limits damage and HP loss but its Dexterity penalty continues after Intangible', () => {
        const engine = battle(['WRAITH_FORM']); play(engine, 'WRAITH_FORM')
        engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 10 }); engine.runUntilIdle(); expect(engine.state.player.hp).toBe(69)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(68); expect(powerAmount(engine.state.player, 'DEXTERITY')).toBe(-1)
        expect(powerAmount(engine.state.player, 'INTANGIBLE')).toBe(1)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(powerAmount(engine.state.player, 'INTANGIBLE')).toBe(0); expect(powerAmount(engine.state.player, 'DEXTERITY')).toBe(-2)
    })
    it('Well-Laid Plans keeps only chosen cards and resumes the enemy turn after selection', () => {
        const engine = battle(['WELL_LAID_PLANS', 'STRIKE_SILENT', 'DEFEND_SILENT']); play(engine, 'WELL_LAID_PLANS')
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.state.turn).toBe('player'); const selected = engine.state.player.hand[0].instanceId
        engine.submitPendingChoice([selected]); engine.runUntilIdle()
        expect(engine.state.player.hand.some(c => c.instanceId === selected)).toBe(true)
        expect(engine.state.player.hp).toBe(65)
    })
})
