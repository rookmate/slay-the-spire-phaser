import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance, createCardCopy } from './cards'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { createNewRun, removeCardByInstanceId } from './run'
function battle(ids: string[]) {
    const run = createNewRun({ seed: 'shared' }); run.relics = []
    const player = createPlayerFromDeck(run.seed, [], 80, 80); player.energy = 20; player.hand = ids.map(id => createCardInstance(id))
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 200; enemy.intent = { kind: 'buff' }
    return new Engine(run.seed, player, [enemy], { run })
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
function turn(engine: Engine) { engine.state.enemies[0].intent = { kind: 'buff' }; engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle() }
describe('shared and event cards', () => {
    it('has 35 collectible colorless cards and keeps event cards out of random rewards', () => {
        expect(Object.values(CARD_DEFS).filter(c => c.color === 'colorless' && c.poolEnabled)).toHaveLength(35)
        for (const id of ['BITE', 'JAX', 'APPARITION', 'RITUAL_DAGGER']) expect(CARD_DEFS[id].poolEnabled).toBe(false)
    })
    it('Discovery suspends resolution for a real choice and grants a zero-cost card', () => {
        const engine = battle(['DISCOVERY']); play(engine, 'DISCOVERY'); const choice = engine.getPendingChoice()!
        expect(choice.cards).toHaveLength(3); engine.submitPendingChoice([choice.eligibleInstanceIds[1]]); engine.runUntilIdle()
        expect(engine.getCardCost(engine.state.player.hand[0])).toBe(0); expect(engine.state.player.exhaustPile[0].defId).toBe('DISCOVERY')
    })
    it('Forethought preserves zero cost across a turn until the selected card is played', () => {
        const engine = battle(['FORETHOUGHT', 'BLUDGEON']); const bludgeon = engine.state.player.hand[1]
        play(engine, 'FORETHOUGHT'); engine.submitPendingChoice([bludgeon.instanceId]); engine.runUntilIdle(); turn(engine)
        expect(engine.getCardCost(bludgeon)).toBe(0); play(engine, 'BLUDGEON', true); expect(engine.getCardCost(bludgeon)).toBe(3)
    })
    it('separately counts Bomb timers and allows simultaneous detonations', () => {
        const engine = battle(['THE_BOMB', 'THE_BOMB']); play(engine, 'THE_BOMB'); play(engine, 'THE_BOMB'); turn(engine); turn(engine)
        expect(engine.state.enemies[0].hp).toBe(200); turn(engine); expect(engine.state.enemies[0].hp).toBe(120)
    })
    it('Panic Button prevents card Block while allowing relic Block', () => {
        const engine = battle(['PANIC_BUTTON', 'DEFEND']); play(engine, 'PANIC_BUTTON'); play(engine, 'DEFEND')
        expect(engine.state.player.block).toBe(30); engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 6 }); engine.runUntilIdle(); expect(engine.state.player.block).toBe(36)
    })
    it('Sadistic Nature requires an applied debuff and Artifact stops it', () => {
        const engine = battle(['SADISTIC_NATURE', 'BLIND', 'TRIP']); play(engine, 'SADISTIC_NATURE')
        engine.setPowerStacks(engine.state.enemies[0], 'ARTIFACT', 1); play(engine, 'BLIND', true); expect(engine.state.enemies[0].hp).toBe(200)
        play(engine, 'TRIP', true); expect(engine.state.enemies[0].hp).toBe(195)
    })
    it('Ritual Dagger permanently grows on a fatal hit and copied cards retain growth', () => {
        const engine = battle(['RITUAL_DAGGER']); const dagger = engine.state.player.hand[0]
        engine.run!.deck = [{ ...dagger }]; engine.state.enemies[0].hp = 10; play(engine, 'RITUAL_DAGGER', true)
        expect(dagger.permanentDamage).toBe(18); expect(engine.run!.deck[0].permanentDamage).toBe(18); expect(createCardCopy(dagger).permanentDamage).toBe(18)
    })
    it('Blue Candle exhausts Necronomicurse, which returns, and fixed curses cannot be removed', () => {
        const engine = battle(['NECRONOMICURSE']); engine.run!.relics.push('BLUE_CANDLE'); engine.run!.deck = [...engine.state.player.hand]
        expect(removeCardByInstanceId(engine.run!, engine.run!.deck[0].instanceId)).toBeUndefined()
        play(engine, 'NECRONOMICURSE'); expect(engine.state.player.hp).toBe(79); expect(engine.state.player.hand.map(c => c.defId)).toEqual(['NECRONOMICURSE'])
    })
})
