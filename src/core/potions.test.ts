import { describe, expect, it } from 'vitest'
import { createNewRun } from './run'
import { createDummyEnemy, createPlayerFromDeck, Engine } from './engine'
import { createCardInstance, resolveCard } from './cards'
import { POTION_DEFS, usePotionOutsideCombat } from './potions'
import { powerAmount } from './combatMath'
import { applyCombatEscape } from './combat'
import { drawPotion } from './rewardPools'
import { RNG } from './rng'
import type { CharacterId } from './characters'
function battle(character: CharacterId = 'ironclad') {
    const run = createNewRun({ seed: 'potions', character })
    const player = createPlayerFromDeck(run.seed, [], 10, 80); player.character = character
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 200
    return new Engine(run.seed, player, [enemy], { run })
}
describe('original potions', () => {
    it('defines all 42 potions and filters character-exclusive drops', () => {
        expect(Object.keys(POTION_DEFS)).toHaveLength(42)
        for (const character of ['ironclad', 'silent', 'defect', 'watcher'] as const) {
            const rng = new RNG(character)
            for (let i = 0; i < 300; i++) expect([undefined, character]).toContain(POTION_DEFS[drawPotion(rng, character)].character)
        }
    })
    it('consumes only valid uses and fills the slot freed by Entropic Brew', () => {
        const engine = battle(); engine.run!.potions = ['FIRE_POTION', 'ENTROPIC_BREW']
        engine.usePotionAtIndex(0, ['missing']); expect(engine.run!.potions).toHaveLength(2)
        engine.usePotionAtIndex(0, ['enemy']); expect(engine.state.enemies[0].hp).toBe(180)
        engine.usePotionAtIndex(0, []); expect(engine.run!.potions).toHaveLength(3)
    })
    it('Sacred Bark doubles choices into distinct copies with zero costs', () => {
        const engine = battle('silent'); engine.run!.relics.push('SACRED_BARK'); engine.run!.potions = ['ATTACK_POTION']
        engine.usePotionAtIndex(0, []); const choice = engine.getPendingChoice()!
        expect(choice.cards).toHaveLength(3); expect(choice.cards!.every(c => resolveCard(c).type === 'attack')).toBe(true)
        engine.submitPendingChoice([choice.eligibleInstanceIds[0]]); engine.runUntilIdle()
        expect(engine.state.player.hand).toHaveLength(2)
        expect(new Set(engine.state.player.hand.map(c => c.instanceId)).size).toBe(2)
        expect(engine.state.player.hand.every(c => engine.getCardCost(c) === 0)).toBe(true)
    })
    it('revives between hits, uses Fairy before Lizard Tail, and obeys Mark of the Bloom', () => {
        const engine = battle(); engine.run!.potions = ['FAIRY_IN_A_BOTTLE']; engine.run!.relics.push('LIZARD_TAIL')
        engine.enqueue({ kind: 'DealMultiDamage', source: 'enemy', target: 'player', amount: 30, hits: 3 }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(10); expect(engine.state.defeat).toBe(false)
        expect(engine.run!.potions).toEqual([]); expect(engine.run!.relicState!.LIZARD_TAIL!.charges).toBe(0)
        const blocked = battle(); blocked.run!.potions = ['FAIRY_IN_A_BOTTLE']; blocked.run!.relics.push('MARK_OF_THE_BLOOM')
        blocked.enqueue({ kind: 'LoseHp', target: 'player', amount: 100 }); blocked.runUntilIdle()
        expect(blocked.state.defeat).toBe(true); expect(blocked.run!.potions).toHaveLength(1)
    })
    it('scales Fairy revival with Sacred Bark and Magic Flower', () => {
        const engine = battle(); engine.run!.potions = ['FAIRY_IN_A_BOTTLE']; engine.run!.relics.push('SACRED_BARK', 'MAGIC_FLOWER')
        engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 100 }); engine.runUntilIdle()
        expect(engine.state.player.hp).toBe(72)
    })
    it('cannot manually drink Fairy or use Smoke Bomb against a boss', () => {
        const engine = battle(); engine.run!.potions = ['FAIRY_IN_A_BOTTLE', 'SMOKE_BOMB']; engine.state.enemies[0].tags = ['boss']
        engine.usePotionAtIndex(0, []); engine.usePotionAtIndex(1, []); expect(engine.run!.potions).toHaveLength(2)
    })
    it('escape completes the room without healing, a key, or rewards', () => {
        const engine = battle(); const run = engine.run!; run.pendingRoom = { scene: 'Combat', roomKind: 'elite' }; run.burningEliteActive = true
        engine.usePotion('SMOKE_BOMB', []); expect(engine.state.escaped).toBe(true)
        applyCombatEscape(run, engine.state.player, 'elite')
        expect(run.player.hp).toBe(10); expect(run.keys.emerald).toBe(false); expect(run.pendingRoom).toBeUndefined(); expect(run.floor).toBe(2)
    })
    it('Liquid Memories returns the chosen cards and Stance Potion offers valid cards', () => {
        const engine = battle('watcher'); engine.run!.relics.push('SACRED_BARK')
        engine.state.player.discardPile = ['PROTECT', 'RAGNAROK'].map(id => createCardInstance(id))
        engine.usePotion('LIQUID_MEMORIES', []); engine.submitPendingChoice(engine.getPendingChoice()!.eligibleInstanceIds); engine.runUntilIdle()
        expect(engine.state.player.hand).toHaveLength(2); expect(engine.state.player.hand.every(c => engine.getCardCost(c) === 0)).toBe(true)
        engine.usePotion('STANCE_POTION', []); const choice = engine.getPendingChoice()!
        const wrath = choice.cards!.find(c => resolveCard(c).name === 'Wrath')!
        engine.submitPendingChoice([wrath.instanceId]); engine.runUntilIdle(); expect(engine.state.player.stance).toBe('wrath')
    })
    it('Cultist Potion repeats at turn end and unused Duplication expires', () => {
        const engine = battle(); engine.state.enemies[0].intent = { kind: 'buff' }
        engine.usePotion('CULTIST_POTION', ['player']); engine.usePotion('DUPLICATION_POTION', ['player'])
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(1); expect(powerAmount(engine.state.player, 'DUPLICATION')).toBe(0)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(2)
    })
    it('uses out-of-combat healing and max HP without combat-only potions', () => {
        const run = createNewRun({ seed: 'outside' }); run.player.hp = 20; run.potions = ['FRUIT_JUICE', 'BLOOD_POTION', 'FIRE_POTION']; run.relics.push('SACRED_BARK', 'TOY_ORNITHOPTER')
        expect(usePotionOutsideCombat(run, 0)).toBe(true); expect(run.player).toEqual({ hp: 35, maxHp: 90 })
        usePotionOutsideCombat(run, 0); expect(run.player.hp).toBe(76)
        expect(usePotionOutsideCombat(run, 0)).toBe(false); expect(run.potions).toEqual(['FIRE_POTION'])
    })
})
