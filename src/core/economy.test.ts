import { prepareAcquisition, chooseAcquisition } from './relics/acquisitions'
import { getRunDestination } from './progression'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { advanceAct } from './campaign'
import { CARD_DEFS, createCardInstance } from './cards'
import { createCombatEngine } from './combat'
import { Engine, createDummyEnemy, createSimplePlayer } from './engine'
import { createEnemyState } from './enemies'
import { eventSeed, getEventChoices, getEventPool, initializeEvent, resolveEventChoice, transformCard } from './events'
import { healRun } from './health'
import { loadMeta } from './meta'
import { applyNeowOption, rollNeowOptions } from './neow'
import { applyRelicAcquisition, RELIC_DEFS } from './relics'
import { rollCardRarity } from './rewardPools'
import { generateRewardBundle } from './rewards'
import { RNG } from './rng'
import { createNewRun, loadRun, saveRun } from './run'
import { generateShop, purchaseRemoval, purchaseShopItem, removalPrice, shopPrice } from './shop'

beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())

describe('merchant transactions', () => {
    it('stocks the original categories, a sale, and no duplicate relics', () => {
        const run = createNewRun({ seed: 'shop' })
        const initial = structuredClone(run)
        const stock = generateShop(run, loadMeta())
        expect(stock.cards.slice(0, 5).map(id => CARD_DEFS[id].type)).toEqual(['attack', 'attack', 'skill', 'skill', 'power'])
        expect(stock.cards.slice(5).map(id => [CARD_DEFS[id].color, CARD_DEFS[id].rarity])).toEqual([['colorless', 'uncommon'], ['colorless', 'rare']])
        expect(stock.relics).toHaveLength(3); expect(new Set(stock.relics).size).toBe(3)
        expect(RELIC_DEFS[stock.relics![2]].rarity).toBe('shop')
        expect(stock.potions).toHaveLength(3)
        expect(stock.saleIndex).toBeLessThan(5)
        expect(generateShop(initial, loadMeta())).toEqual(stock)
        run.act = 2; expect(generateShop(run, loadMeta())).not.toEqual(stock)
    })
    it('charges only successful removals and persists the one-removal limit', () => {
        const run = createNewRun({ seed: 'purge', ascension: 10 }); run.gold = 1000
        const stock = generateShop(run, loadMeta())
        run.pendingRoom = { scene: 'Shop', inventory: stock }
        expect(purchaseRemoval(run, stock, run.deck.find(c => c.defId === 'ASCENDERS_BANE')!.instanceId)).toBe(false)
        expect(run.gold).toBe(1000)
        expect(purchaseRemoval(run, stock, run.deck[0].instanceId)).toBe(true)
        saveRun(run); const resumed = loadRun()!
        expect(resumed.pendingRoom?.scene === 'Shop' && resumed.pendingRoom.inventory?.removalUsed).toBe(true)
        expect(purchaseRemoval(run, stock, run.deck[0].instanceId)).toBe(false)
        expect(run.gold).toBe(925); expect(run.merchantRemoveCost).toBe(100)
    })
    it('removes sold relics and restocks only with Courier', () => {
        const run = createNewRun({ seed: 'stock' }); run.gold = 10000
        const stock = generateShop(run, loadMeta())
        const index = stock.relics!.findIndex(id => id !== 'COURIER')
        const relic = stock.relics![index]
        expect(purchaseShopItem(run, loadMeta(), stock, 'relics', index)).toBe(true)
        expect(run.relics).toContain(relic); expect(stock.relics).toHaveLength(2)
        applyRelicAcquisition(run, 'COURIER')
        const count = stock.cards.length
        purchaseShopItem(run, loadMeta(), stock, 'cards', 0)
        expect(stock.cards).toHaveLength(count)
    })
    it('combines discounts and preserves Smiling Mask’s fixed removal cost', () => {
        const run = createNewRun({ seed: 'discount', ascension: 16 }); run.relics.push('COURIER', 'MEMBERSHIP_CARD')
        expect(shopPrice(run, 100)).toBe(44)
        expect(removalPrice(run)).toBe(33)
        run.relics.push('SMILING_MASK'); expect(removalPrice(run)).toBe(50)
    })
    it('returns to the same shop after all five Orrery rewards', () => {
        const run = createNewRun({ seed: 'orrery' }); run.gold = 1000; run.neowCompleted = true
        const stock = generateShop(run, loadMeta()); stock.relics = ['ORRERY']; stock.relicPrices = [150]
        run.pendingRoom = { scene: 'Shop', inventory: stock }
        purchaseShopItem(run, loadMeta(), stock, 'relics', 0)
        expect(run.pendingAcquisitions).toHaveLength(5)
        for (let i = 0; i < 5; i++) { prepareAcquisition(run, loadMeta()); chooseAcquisition(run, loadMeta()) }
        expect(getRunDestination(run).scene).toBe('Shop'); expect(run.floor).toBe(1)
        expect(run.pendingRoom?.scene === 'Shop' && run.pendingRoom.inventory?.relics).toEqual([])
    })
})

describe('reward probabilities', () => {
    it('starts with no rare chance, advances on commons, and resets on a rare', () => {
        const run = createNewRun({ seed: 'rarity' }); const rng = new RNG('roll')
        vi.spyOn(rng, 'random').mockReturnValue(0)
        expect(rollCardRarity(rng, run, 'hallway')).toBe('uncommon')
        expect(run.rareCardOffset).toBeUndefined()
        vi.spyOn(rng, 'random').mockReturnValue(0.99)
        for (let i = 0; i < 3; i++) expect(rollCardRarity(rng, run, 'hallway')).toBe('common')
        expect(run.rareCardOffset).toBe(-2)
        vi.spyOn(rng, 'random').mockReturnValue(0)
        expect(rollCardRarity(rng, run, 'hallway')).toBe('rare'); expect(run.rareCardOffset).toBe(-5)
    })
    it('keeps shop rolls from changing rarity and tracks potion misses/drops', () => {
        const run = createNewRun({ seed: 'potion' }); run.rareCardOffset = 7
        generateShop(run, loadMeta()); expect(run.rareCardOffset).toBe(7)
        run.potionChance = 0
        expect(generateRewardBundle('miss', 'elite', run, loadMeta()).items.some(i => i.kind === 'potion')).toBe(false)
        expect(run.potionChance).toBeCloseTo(0.1)
        run.potionChance = 1
        expect(generateRewardBundle('hit', 'hallway', run, loadMeta()).items.some(i => i.kind === 'potion')).toBe(true)
        expect(run.potionChance).toBeCloseTo(0.9)
        advanceAct(run); expect(run.potionChance).toBe(0.4)
    })
})

describe('event consequences and checkpoints', () => {
    it('persists the Golden Idol trap, forbids leaving, and applies it once', () => {
        const run = createNewRun({ seed: 'idol' }); initializeEvent(run, loadMeta(), 'GOLDEN_IDOL')
        resolveEventChoice(run, loadMeta(), 'GOLDEN_IDOL', 'GOLDEN_IDOL_TAKE', eventSeed(run))
        saveRun(run); const loaded = loadRun()!
        expect(getEventChoices(loaded).map(c => c.id)).toEqual(['IDOL_INJURY', 'IDOL_DAMAGE', 'IDOL_MAX_HP'])
        resolveEventChoice(loaded, loadMeta(), 'GOLDEN_IDOL', 'LEAVE', eventSeed(loaded))
        expect(loaded.eventState?.resolved).toBe(false)
        resolveEventChoice(loaded, loadMeta(), 'GOLDEN_IDOL', 'IDOL_DAMAGE', eventSeed(loaded))
        expect(loaded.player.hp).toBe(60)
        resolveEventChoice(loaded, loadMeta(), 'GOLDEN_IDOL', 'IDOL_DAMAGE', eventSeed(loaded))
        expect(loaded.player.hp).toBe(60)
    })
    it('uses distinct act pools and Ascension 15 event costs', () => {
        expect(getEventPool(1)).not.toContain('THE_JOUST'); expect(getEventPool(3)).toContain('MIND_BLOOM')
        const run = createNewRun({ seed: 'cleric', ascension: 15 }); const id = run.deck[0].instanceId
        resolveEventChoice(run, loadMeta(), 'CLERIC', 'CLERIC_PURGE', 'cost', { cardInstanceId: id })
        expect(run.gold).toBe(24); expect(run.deck.some(c => c.instanceId === id)).toBe(false)
    })
    it('can die to event damage and cannot use invalid selections to evade costs', () => {
        const run = createNewRun({ seed: 'goop' }); run.player.hp = 5
        const result = resolveEventChoice(run, loadMeta(), 'WORLD_OF_GOOP', 'WORLD_OF_GOOP_REACH', 'goop')
        expect(result.nextScene).toBe('RunSummary'); expect(run.player.hp).toBe(0)
        const other = createNewRun({ seed: 'remove' }); initializeEvent(other, loadMeta(), 'BEGGAR')
        resolveEventChoice(other, loadMeta(), 'BEGGAR', 'BEGGAR_GIVE', 'beggar', { cardInstanceId: 'absent' })
        expect(other.gold).toBe(99); expect(other.eventState?.resolved).toBeUndefined()
    })
    it('keeps curse transformations cursed and charges Parasite max HP', () => {
        const run = createNewRun({ seed: 'transform', ascension: 10 }); const parasite = createCardInstance('PARASITE'); run.deck.push(parasite)
        const transformed = transformCard(run, loadMeta(), parasite.instanceId, 'curse')!
        expect(CARD_DEFS[transformed.defId].type).toBe('curse'); expect(transformed.defId).not.toBe('PARASITE')
        expect(run.player.maxHp).toBe(77)
        expect(transformCard(run, loadMeta(), run.deck.find(c => c.defId === 'ASCENDERS_BANE')!.instanceId, 'bane')).toBeUndefined()
    })
    it('blocks healing after Mind Bloom, including act transitions and max-HP gains', () => {
        const run = createNewRun({ seed: 'bloom' }); run.act = 3; run.player.hp = 20
        resolveEventChoice(run, loadMeta(), 'MIND_BLOOM', 'BLOOM_AWAKE', 'bloom')
        expect(healRun(run, 100)).toBe(0)
        applyRelicAcquisition(run, 'MANGO'); expect(run.player.maxHp).toBe(94); expect(run.player.hp).toBe(20)
        advanceAct(run); expect(run.player.hp).toBe(20)
    })
    it('starts event battles with their specified enemies and rewards', () => {
        const run = createNewRun({ seed: 'sphere' }); run.act = 3
        resolveEventChoice(run, loadMeta(), 'MYSTERIOUS_SPHERE', 'SPHERE_FIGHT', 'sphere')
        expect(createCombatEngine(run, 'monster').state.enemies.map(e => e.specId)).toEqual(['ORB_WALKER', 'ORB_WALKER'])
        expect(run.eventCombat?.rewards.items.some(i => i.kind === 'relic' && RELIC_DEFS[i.relicId].rarity === 'rare')).toBe(true)
    })
})

describe('Neow and campaign combat effects', () => {
    it('offers the short blessing after an unsuccessful unseeded run', () => {
        const run = createNewRun(); const options = rollNeowOptions(run.neowSeed, false)
        expect(options.map(o => o.id)).toEqual(['MAX_HP', 'LAMENT'])
        expect(applyNeowOption(run, loadMeta(), options[0])).toBe(true)
        expect(run.player.maxHp).toBe(88); expect(run.player.hp).toBe(88)
    })
    it('limits Lament to three combats and saves charges with the run', () => {
        const run = createNewRun(); applyNeowOption(run, loadMeta(), rollNeowOptions(run.neowSeed, false)[1])
        for (let i = 0; i < 3; i++) expect(createCombatEngine(run, 'monster').state.enemies.every(e => e.hp === 1)).toBe(true)
        expect(createCombatEngine(run, 'monster').state.enemies.some(e => e.hp > 1)).toBe(true)
    })
    it('applies player Plated Armor at turn end and loses one per unblocked attack', () => {
        const player = createSimplePlayer('armor'); player.powers = [{ id: 'PLATED_ARMOR', stacks: 4 }]
        const enemy = createDummyEnemy('enemy'); enemy.intent = { kind: 'multi_attack', amount: 5, hits: 2 }
        const engine = new Engine('armor', player, [enemy]); engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(player.hp).toBe(74); expect(player.powers.find(p => p.id === 'PLATED_ARMOR')?.stacks).toBe(2)
    })
    it('resolves Beat of Death even on the killing card', () => {
        const player = createSimplePlayer('heart'); player.hp = 1; player.hand = [createCardInstance('STRIKE')]
        const heart = createEnemyState('CORRUPT_HEART', 'heart'); heart.hp = 1
        const engine = new Engine('heart', player, [heart]); engine.playCard(player.hand[0], ['heart']); engine.runUntilIdle()
        expect(engine.state.defeat).toBe(true); expect(engine.state.victory).toBe(false)
    })
    it('limits Normality while it remains in hand', () => {
        const player = createSimplePlayer('normality'); player.hand = [createCardInstance('NORMALITY'), ...Array.from({ length: 4 }, () => createCardInstance('ANGER'))]
        const engine = new Engine('normality', player, [createDummyEnemy('enemy')]); engine.state.enemies[0].hp = 100
        for (let i = 0; i < 3; i++) { engine.playCard(player.hand[1], ['enemy']); engine.runUntilIdle() }
        expect(engine.playCard(player.hand[1], ['enemy'])).toEqual([]); expect(player.hand).toHaveLength(2)
    })
})
