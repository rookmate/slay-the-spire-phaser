import { describe, expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { createNewRun, type RelicId } from './run'
import { Engine, createPlayerFromDeck, createDummyEnemy } from './engine'
import { powerAmount } from './combatMath'
import { createCombatEngine } from './combat'
function battle(relics: RelicId[], ids: string[] = []) {
    const run = createNewRun({ seed: 'relics' }); run.relics = relics
    const player = createPlayerFromDeck(run.seed, [], 80, 80); player.energy = 20; player.hand = ids.map(id => createCardInstance(id))
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 400; enemy.intent = { kind: 'buff' }
    return new Engine(run.seed, player, [enemy], { run })
}
function play(engine: Engine, id: string, target = true) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
function turn(engine: Engine) { engine.state.enemies[0].intent = { kind: 'buff' }; engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle() }
describe('combat relic interactions', () => {
    it('persistent turn counters survive new combats', () => {
        const run = createNewRun({ seed: 'incense' }); run.relics = ['INCENSE_BURNER', 'HAPPY_FLOWER']; run.relicState = { INCENSE_BURNER: { counter: 5 }, HAPPY_FLOWER: { counter: 2 } }
        const engine = createCombatEngine(run, 'monster')
        expect(powerAmount(engine.state.player, 'INTANGIBLE')).toBe(1); expect(engine.state.player.energy).toBe(4)
        expect(run.relicState.INCENSE_BURNER!.counter).toBe(0)
    })
    it('Pen Nib and Akabeko apply to the correct play when Double Tap repeats a multi-hit card', () => {
        const engine = battle(['PEN_NIB', 'AKABEKO'], ['TWIN_STRIKE']); engine.run!.relicState = { PEN_NIB: { counter: 9 } }; engine.setDoubleTapCharges(1)
        play(engine, 'TWIN_STRIKE'); expect(engine.state.enemies[0].hp).toBe(338)
        expect(engine.run!.relicState.PEN_NIB!.counter).toBe(1)
    })
    it('Kunai, Shuriken, and Fan trigger on the third attack and reset with each turn', () => {
        const engine = battle(['KUNAI', 'SHURIKEN', 'ORNAMENTAL_FAN'], ['STRIKE', 'STRIKE', 'STRIKE']); play(engine, 'STRIKE'); play(engine, 'STRIKE'); play(engine, 'STRIKE')
        expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(1); expect(powerAmount(engine.state.player, 'DEXTERITY')).toBe(1); expect(engine.state.player.block).toBe(4)
        turn(engine); play(engine, 'STRIKE'); expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(1)
    })
    it('manual discards trigger Kite and Bandages once per card; end-turn discards do not', () => {
        const engine = battle(['HOVERING_KITE', 'TOUGH_BANDAGES'], ['STRIKE', 'DEFEND', 'BASH']); engine.state.player.energy = 0
        engine.discardCards(engine.state.player.hand.slice(0, 2).map(c => c.instanceId)); engine.runUntilIdle()
        expect(engine.state.player.energy).toBe(1); expect(engine.state.player.block).toBe(6)
        engine.discardCards(engine.state.player.hand.map(c => c.instanceId), 'end_turn'); engine.runUntilIdle(); expect(engine.state.player.block).toBe(6)
    })
    it('Torii and Tungsten combine after Buffer without triggering HP-loss relics', () => {
        const engine = battle(['TORII', 'TUNGSTEN_ROD', 'RUNIC_CUBE']); engine.state.player.drawPile = [createCardInstance('STRIKE')]
        engine.setPowerStacks(engine.state.player, 'BUFFER', 1)
        engine.enqueue({ kind: 'DealMultiDamage', source: 'enemy', target: 'player', amount: 5, hits: 2 }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(80); expect(engine.state.player.hand).toHaveLength(0); expect(powerAmount(engine.state.player, 'BUFFER')).toBe(0)
    })
    it('The Boot raises attacks against Intangible but not potion damage', () => {
        const engine = battle(['THE_BOOT'], ['STRIKE']); engine.setPowerStacks(engine.state.enemies[0], 'INTANGIBLE', 1)
        play(engine, 'STRIKE'); engine.usePotion('FIRE_POTION', ['enemy']); expect(engine.state.enemies[0].hp).toBe(394)
    })
    it('Orange Pellets removes temporary Dexterity loss and retains the gain', () => {
        const engine = battle(['ORANGE_PELLETS', 'DUALITY'], ['STRIKE', 'DEFEND', 'INFLAME'])
        play(engine, 'STRIKE'); play(engine, 'DEFEND', false); play(engine, 'INFLAME', false); turn(engine)
        expect(powerAmount(engine.state.player, 'DEXTERITY')).toBe(1); expect(powerAmount(engine.state.player, 'DEXTERITY_DOWN')).toBe(0)
    })
    it('Chemical X improves an X card without spending extra Energy', () => {
        const engine = battle(['CHEMICAL_X'], ['WHIRLWIND']); engine.state.player.energy = 1; play(engine, 'WHIRLWIND')
        expect(engine.state.enemies[0].hp).toBe(385); expect(engine.state.player.energy).toBe(0)
    })
    it('Calipers, Ice Cream, and Runic Pyramid conserve their respective resources', () => {
        const engine = battle(['CALIPERS', 'ICE_CREAM', 'RUNIC_PYRAMID'], ['STRIKE']); engine.state.player.block = 25; engine.state.player.energy = 2
        turn(engine); expect(engine.state.player.block).toBe(10); expect(engine.state.player.energy).toBe(5); expect(engine.state.player.hand.map(c => c.defId)).toEqual(['STRIKE'])
    })
    it('Red Skull updates Strength when damage and healing cross half HP', () => {
        const engine = battle(['RED_SKULL']); engine.initializeCombat(); engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 40 }); engine.runUntilIdle()
        expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(3)
        engine.enqueue({ kind: 'Heal', target: 'player', amount: 1 }); engine.runUntilIdle(); expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(0)
    })
    it('Necronomicon doubles only the first expensive Attack each turn', () => {
        const engine = battle(['NECRONOMICON'], ['BLUDGEON', 'BLUDGEON']); play(engine, 'BLUDGEON'); play(engine, 'BLUDGEON'); expect(engine.state.enemies[0].hp).toBe(304)
    })
    it('Velvet Choker stops additional plays and duplicates after card six', () => {
        const engine = battle(['VELVET_CHOKER'], ['STRIKE', 'STRIKE']); engine.state.cardsPlayed = 5; engine.setDoubleTapCharges(1)
        play(engine, 'STRIKE'); play(engine, 'STRIKE'); expect(engine.state.enemies[0].hp).toBe(394); expect(engine.state.player.hand).toHaveLength(1)
    })
})
