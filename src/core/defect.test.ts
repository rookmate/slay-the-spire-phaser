import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance } from './cards'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { powerAmount } from './combatMath'
import { createNewRun } from './run'
function battle(ids: string[]) {
    const run = createNewRun({ character: 'defect', seed: 'defect' }); run.deck = ids.map(id => createCardInstance(id))
    const player = createPlayerFromDeck('defect', run.deck, 60, 75); player.character = 'defect'; player.energy = 20; player.orbSlots = 3; player.hand = player.drawPile.splice(0)
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 500
    return new Engine('defect', player, [enemy], { run })
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
describe('Defect cards', () => {
    it('has all 75 colored cards', () => expect(Object.values(CARD_DEFS).filter(c => c.color === 'defect')).toHaveLength(75))
    it('Consume removes the newest occupied slot without evoking it', () => {
        const engine = battle(['CONSUME'])
        for (let i = 0; i < 3; i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'lightning' }); engine.runUntilIdle()
        play(engine, 'CONSUME'); expect(engine.state.enemies[0].hp).toBe(500); expect(engine.state.player.orbs).toHaveLength(2); expect(powerAmount(engine.state.player, 'FOCUS')).toBe(2)
    })
    it('Recursion keeps a Dark orb\'s stored damage and counts the new channel', () => {
        const engine = battle(['RECURSION']); engine.state.player.orbs = [{ type: 'dark', storedDamage: 30 }]
        play(engine, 'RECURSION'); expect(engine.state.enemies[0].hp).toBe(470); expect(engine.state.player.orbs[0].storedDamage).toBe(30); expect(engine.state.orbsChanneled.dark).toBe(1)
    })
    it('Claw increases existing copies; new generated cards start at base damage', () => {
        const engine = battle(['CLAW', 'CLAW']); play(engine, 'CLAW', true); play(engine, 'CLAW', true)
        expect(engine.state.enemies[0].hp).toBe(492)
        engine.createCardsInDestination('CLAW', 'hand'); play(engine, 'CLAW', true); expect(engine.state.enemies[0].hp).toBe(489)
    })
    it('Echo Form doubles Genetic Algorithm and persists both increases to the run', () => {
        const engine = battle(['GENETIC_ALGORITHM']); engine.setPowerStacks(engine.state.player, 'ECHO_FORM', 1)
        play(engine, 'GENETIC_ALGORITHM'); expect(engine.state.player.block).toBe(4); expect(engine.run!.deck[0].permanentBlock).toBe(5); expect(engine.state.player.exhaustPile).toHaveLength(1)
    })
    it('Amplify and Echo Form add repeats and count every Power play', () => {
        const engine = battle(['DEFRAGMENT']); engine.setPowerStacks(engine.state.player, 'ECHO_FORM', 1); engine.setPowerStacks(engine.state.player, 'AMPLIFY', 1)
        play(engine, 'DEFRAGMENT'); expect(powerAmount(engine.state.player, 'FOCUS')).toBe(3); expect(engine.state.powersPlayed).toBe(3); expect(engine.state.cardsPlayed).toBe(3)
    })
    it('Core Surge protects against Biased Cognition\'s ongoing Focus loss', () => {
        const engine = battle(['CORE_SURGE', 'BIASED_COGNITION']); play(engine, 'CORE_SURGE', true); play(engine, 'BIASED_COGNITION')
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); expect(powerAmount(engine.state.player, 'FOCUS')).toBe(4); expect(powerAmount(engine.state.player, 'BIASED_COGNITION')).toBe(0)
    })
    it('Self Repair heals once when combat ends and Buffer prevents only positive HP loss', () => {
        const engine = battle(['SELF_REPAIR', 'BUFFER']); play(engine, 'SELF_REPAIR'); play(engine, 'BUFFER')
        engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 0 }); engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 3 }); engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 2 }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(58); engine.enqueue({ kind: 'LoseHp', target: 'enemy', amount: 500 }); engine.runUntilIdle()
        expect(engine.state.victory).toBe(true); expect(engine.state.player.hp).toBe(65)
    })
    it('Seek moves chosen cards without triggering draw effects', () => {
        const engine = battle(['SEEK']); const voidCard = createCardInstance('VOID'); engine.state.player.drawPile = [voidCard]
        play(engine, 'SEEK'); engine.submitPendingChoice([voidCard.instanceId]); engine.runUntilIdle()
        expect(engine.state.player.energy).toBe(20); expect(engine.state.player.hand[0].defId).toBe('VOID')
    })
})
