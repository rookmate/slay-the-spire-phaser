import { describe, expect, it } from 'vitest'
import { createCardInstance } from './cards'
import { createNewRun, type RelicId } from './run'
import { Engine, createPlayerFromDeck, createDummyEnemy } from './engine'
import { powerAmount } from './combatMath'
import { drawPotion } from './rewardPools'
import { RNG } from './rng'
function battle(relics: RelicId[], ids: string[] = []) {
    const run = createNewRun({ seed: 'review' }); run.relics = relics
    const player = createPlayerFromDeck(run.seed, [], 40, 80); player.energy = 20; player.hand = ids.map(id => createCardInstance(id))
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 400; enemy.intent = { kind: 'buff' }
    return new Engine(run.seed, player, [enemy], { run })
}
function play(engine: Engine, id: string, target = false) { engine.playCard(engine.state.player.hand.find(c => c.defId === id)!, target ? ['enemy'] : []); engine.runUntilIdle() }
describe('shared content review regressions', () => {
    it.each(['BIASED_COGNITION', 'WRAITH_FORM'])('Pellets clears the debuff applied by triggering %s', id => {
        const engine = battle(['ORANGE_PELLETS'], ['STRIKE', 'DEFEND', id]); play(engine, 'STRIKE', true); play(engine, 'DEFEND'); play(engine, id)
        expect(powerAmount(engine.state.player, id as 'BIASED_COGNITION' | 'WRAITH_FORM')).toBe(0)
        expect(powerAmount(engine.state.player, id === 'BIASED_COGNITION' ? 'FOCUS' : 'INTANGIBLE')).toBeGreaterThan(0)
    })
    it.each([['SLICE', 3, 6], ['BLUDGEON', 0, 64]] as const)('Necronomicon checks autoplay %s cost, not available Energy %i', (id, energy, damage) => {
        const engine = battle(['NECRONOMICON']); engine.state.player.energy = energy; engine.state.player.drawPile = [createCardInstance(id)]
        engine.enqueue({ kind: 'PlayTopCard', exhaust: false }); engine.runUntilIdle(); expect(engine.state.enemies[0].hp).toBe(400 - damage)
    })
    it.each([[0, false, 20], [20, false, 0], [0, true, 0]])('Hand of Greed requires its own fatal attack, Cuts=%i minion=%s', (cuts, minion, gold) => {
        const engine = battle([], ['HAND_OF_GREED']); engine.state.enemies[0].hp = 10; if (minion) engine.state.enemies[0].tags = ['minion']
        engine.setPowerStacks(engine.state.player, 'THOUSAND_CUTS', cuts); const before = engine.run!.gold; play(engine, 'HAND_OF_GREED', true)
        expect(engine.run!.gold - before).toBe(gold)
    })
    it.each(['autoplay', 'REBOOT', 'DEEP_BREATH'])('shuffle hooks fire exactly once for %s', kind => {
        const engine = battle(['THE_ABACUS', 'SUNDIAL'], kind === 'autoplay' ? [] : [kind]); engine.run!.relicState = { SUNDIAL: { counter: 2 } }; engine.state.player.discardPile = [createCardInstance('STRIKE')]
        if (kind === 'autoplay') { engine.enqueue({ kind: 'PlayTopCard', exhaust: false }); engine.runUntilIdle() } else play(engine, kind)
        expect(engine.state.player.block).toBe(6); expect(engine.run!.relicState.SUNDIAL!.counter).toBe(0)
    })
    it('Melange suspends autoplay for a Scry choice after reshuffling', () => {
        const engine = battle(['MELANGE']); engine.state.player.discardPile = ['STRIKE', 'DEFEND', 'BASH'].map(id => createCardInstance(id))
        engine.enqueue({ kind: 'PlayTopCard', exhaust: false }); engine.runUntilIdle(); expect(engine.getPendingChoice()?.sourceCardInstanceId).toBe('melange')
        engine.submitPendingChoice([]); engine.runUntilIdle(); expect(engine.getLimboCard()).toBeUndefined()
    })
    it.each([false, true])('Smoke Bomb resolves Ornithopter before escape with Bloom=%s', bloom => {
        const engine = battle(bloom ? ['TOY_ORNITHOPTER', 'MARK_OF_THE_BLOOM'] : ['TOY_ORNITHOPTER']); engine.run!.potions = ['SMOKE_BOMB']
        engine.usePotionAtIndex(0, []); expect(engine.state.player.hp).toBe(bloom ? 40 : 45); expect(engine.state.victory).toBe(true); expect(engine.state.escaped).toBe(true)
    })
    it('Red Skull clears immediately when Fairy revives above half HP', () => {
        const engine = battle(['RED_SKULL', 'SACRED_BARK'], ['STRIKE']); engine.state.player.hp = 1; engine.run!.potions = ['FAIRY_IN_A_BOTTLE']; engine.initializeCombat()
        engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 100 }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(48); expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(0)
        play(engine, 'STRIKE', true); expect(engine.state.enemies[0].hp).toBe(394)
    })
    it('Wrist Blade distinguishes paid X cards, zero-cost setup, and free repeat plays', () => {
        const paid = battle(['WRIST_BLADE'], ['SKEWER']); paid.state.player.energy = 3; play(paid, 'SKEWER', true); expect(paid.state.enemies[0].hp).toBe(379)
        const setup = battle(['WRIST_BLADE'], ['BASH']); setup.state.player.hand[0].costUntilPlayed = 0; play(setup, 'BASH', true); expect(setup.state.enemies[0].hp).toBe(388)
        const repeat = battle(['WRIST_BLADE', 'NECRONOMICON'], ['BLUDGEON']); play(repeat, 'BLUDGEON', true); expect(repeat.state.enemies[0].hp).toBe(332)
    })
    it('Magic Flower rounds fractional healing up and generated potions exclude Fruit Juice', () => {
        const engine = battle(['MAGIC_FLOWER']); engine.enqueue({ kind: 'Heal', target: 'player', amount: 1 }); engine.runUntilIdle(); expect(engine.state.player.hp).toBe(42)
        const rng = new RNG('generated'); for (let i = 0; i < 1000; i++) expect(drawPotion(rng, 'silent', 'generated')).not.toBe('FRUIT_JUICE')
    })
})
