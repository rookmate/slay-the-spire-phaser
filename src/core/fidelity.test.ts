import { describe, expect, it } from 'vitest'
import { CARD_DEFS, createCardInstance } from './cards'
import { Engine, createDummyEnemy, createPlayerFromDeck } from './engine'
import { createNewRun, type RelicId } from './run'
import { createCombatEngine, applyCombatVictory } from './combat'
import { createDefaultMeta } from './meta'
import { createProfileRun } from './modes/setup'
import { transformCard } from './events'
import { claimReward } from './rewardClaims'
import { openChest } from './rooms'

function battle(ids: string[] = [], relics: RelicId[] = []) {
    const run = createNewRun({ seed: 'fidelity' }); run.relics = relics
    const player = createPlayerFromDeck(run.seed, [], 40, 80)
    player.hand = ids.map(id => createCardInstance(id)); player.energy = 30
    const enemy = createDummyEnemy('enemy'); enemy.hp = enemy.maxHp = 400; enemy.intent = { kind: 'buff' }
    return new Engine(run.seed, player, [enemy], { run })
}
function loseHp(engine: Engine) { engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 1 }); engine.runUntilIdle() }
function drawConfused(engine: Engine, id: string) {
    const card = createCardInstance(id)
    engine.state.player.drawPile = [card]
    engine.setPowerStacks(engine.state.player, 'CONFUSION', 1)
    engine.enqueue({ kind: 'DrawCards', count: 1 }); engine.runUntilIdle()
    return card
}
describe('gameplay fidelity', () => {
    it.each([
        [[], 25, 40], [['ECTOPLASM', 'BLOODY_IDOL'], 0, 40], [['BLOODY_IDOL'], 25, 45],
        [['BLOODY_IDOL', 'MAGIC_FLOWER'], 25, 48], [['BLOODY_IDOL', 'MARK_OF_THE_BLOOM'], 25, 40],
    ] as [RelicId[], number, number][])('Wish respects gold and healing rules with %j', (relics, gold, hp) => {
        const engine = battle(['WISH'], relics), before = engine.run!.gold
        engine.playCard(engine.state.player.hand[0], []); engine.runUntilIdle()
        const choice = engine.getPendingChoice()!, fortune = choice.cards!.find(c => c.defId === 'FAME_AND_FORTUNE')!
        engine.submitPendingChoice([fortune.instanceId]); engine.runUntilIdle()
        expect(engine.run!.gold - before).toBe(gold)
        expect(engine.run!.stats?.goldEarned ?? 0).toBe(gold)
        expect(engine.state.player.hp).toBe(hp)
        applyCombatVictory(engine.run!, engine.state.player)
        expect(engine.run!.player.hp).toBe(hp)
    })
    it.each([false, true])('opening Plasma receives start-of-turn passives, cables=%s', cables => {
        const run = createNewRun({ seed: 'plasma', character: 'defect' })
        run.relics = ['NUCLEAR_BATTERY', ...(cables ? ['GOLD_PLATED_CABLES' as const] : [])]
        expect(createCombatEngine(run, 'monster').state.player.energy).toBe(cables ? 5 : 4)
    })
    it('Masterful Stab remembers only losses while that card existed; copies inherit its cost', () => {
        const engine = battle(['MASTERFUL_STAB']), original = engine.state.player.hand[0]
        loseHp(engine); loseHp(engine)
        const [fresh] = engine.createCardsInDestination('MASTERFUL_STAB', 'hand')
        const [copy] = engine.copyCardToHand(original.instanceId)
        expect([original, fresh, copy].map(c => engine.getCardCost(c))).toEqual([2, 0, 2])
        loseHp(engine)
        expect([original, fresh, copy].map(c => engine.getCardCost(c))).toEqual([3, 1, 3])
    })
    it.each([0, 1])('generated Blood for Blood counts earlier combat losses, upgrade %i', upgrade => {
        const engine = battle(); loseHp(engine); loseHp(engine)
        const [card] = engine.createCardsInDestination('BLOOD_FOR_BLOOD', 'hand', 1, upgrade)
        expect(engine.getCardCost(card)).toBe(upgrade ? 1 : 2)
    })
    it('Confusion replaces the current dynamic cost and allows later changes', () => {
        const engine = battle()
        loseHp(engine)
        const stab = drawConfused(engine, 'MASTERFUL_STAB'), initial = engine.getCardCost(stab)
        loseHp(engine); expect(engine.getCardCost(stab)).toBe(initial + 1)
        engine.state.powersPlayed = 5
        const field = drawConfused(engine, 'FORCE_FIELD'), fieldCost = engine.getCardCost(field)
        engine.createCardsInDestination('DEFRAGMENT', 'hand')
        engine.playCard(engine.state.player.hand.find(c => c.defId === 'DEFRAGMENT')!, []); engine.runUntilIdle()
        expect(engine.getCardCost(field)).toBe(Math.max(0, fieldCost - 1))
        const blood = drawConfused(engine, 'BLOOD_FOR_BLOOD'), bloodCost = engine.getCardCost(blood)
        loseHp(engine); expect(engine.getCardCost(blood)).toBe(Math.max(0, bloodCost - 1))
    })
    it('Confusion permits subsequent discard reductions and resets turn-scoped costs', () => {
        const engine = battle(['STRIKE'])
        engine.discardCards([engine.state.player.hand[0].instanceId])
        const card = drawConfused(engine, 'EVISCERATE'), initial = engine.getCardCost(card)
        const [discard] = engine.createCardsInDestination('STRIKE', 'hand')
        engine.discardCards([discard.instanceId]); expect(engine.getCardCost(card)).toBe(Math.max(0, initial - 1))
        engine.state.player.drawPile = Array.from({ length: 6 }, () => createCardInstance('DEFEND'))
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(engine.getCardCost(card)).toBe(initial)
    })
    it('transforms a foreign card within its own color, including explicit color modifiers', () => {
        const run = createNewRun({ seed: 'fidelity-transform', character: 'watcher' })
        const original = createCardInstance('BASH'); run.deck.push(original)
        expect(CARD_DEFS[transformCard(run, createDefaultMeta(), original.instanceId, run.seed)!.defId].color).toBe('ironclad')
        run.modifiers = ['GREEN_CARDS']
        for (let i = 0; i < 20; i++) {
            const card = createCardInstance('BASH'); run.deck.push(card)
            expect(['ironclad', 'silent']).toContain(CARD_DEFS[transformCard(run, createDefaultMeta(), card.instanceId, `color-${i}`)!.defId].color)
        }
    })
    it('Controlled Chaos adds Frozen Eye and Hoarder leaves the four starting forms alone', () => {
        const run = createProfileRun(createDefaultMeta(), { mode: 'custom', character: 'silent', modifiers: ['CONTROLLED_CHAOS', 'HOARDER', 'MY_TRUE_FORM'] })
        expect(run.relics).toEqual(['RING_OF_THE_SNAKE', 'FROZEN_EYE'])
        expect(run.deck.filter(c => c.defId.endsWith('_FORM'))).toHaveLength(4)
        expect(createCombatEngine(run, 'monster').state.player.hand).toHaveLength(7)
    })
    it('saved chest and reward checkpoints cannot duplicate curses, gold, or cards', () => {
        const run = createNewRun(); run.relics.push('CURSED_KEY'); run.pendingRoom = { scene: 'Chest', rewardSeed: 'checkpoint' }
        expect(openChest(run, createDefaultMeta())).toBe(true)
        const count = run.deck.length
        expect(openChest(run, createDefaultMeta())).toBe(false); expect(run.deck).toHaveLength(count)
        run.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', items: [{ kind: 'gold', amount: 20 }, { kind: 'cards', choices: ['ANGER'] }] } }
        const gold = run.gold
        expect(claimReward(run, 0)).toBe(true); expect(claimReward(run, 0)).toBe(false); expect(run.gold).toBe(gold + 20)
        expect(claimReward(run, 1, { cardId: 'WISH' })).toBe(false)
        expect(claimReward(run, 1, { cardId: 'ANGER' })).toBe(true)
        expect(claimReward(run, 1, { cardId: 'ANGER' })).toBe(false)
    })
})
