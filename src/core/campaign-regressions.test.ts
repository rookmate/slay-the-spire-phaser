import { prepareAcquisition, chooseAcquisition } from './relics/acquisitions'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCardInstance, resolveCard } from './cards'
import { Engine, createDummyEnemy, createSimplePlayer } from './engine'
import { createEnemyState, rollEngineIntentForEnemy } from './enemies'
import { EVENT_DEFS, resolveEventChoice } from './events'
import { loadMeta } from './meta'
import { rollNeowOptions } from './neow'
import { createNewRun, loadRun, saveRun } from './run'
import { advanceRunClock, checkpointRunClock } from './runClock'
import { recordRunResult } from './runResults'
import { generateShop, purchaseShopItem } from './shop'
import { RNG } from './rng'

beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
})
afterEach(() => vi.unstubAllGlobals())

describe('campaign review regressions', () => {
    it('finishes lethal end-turn effects without starting another turn', () => {
        const player = createSimplePlayer('combust'); player.hp = 2
        player.powers = [{ id: 'COMBUST', stacks: 5 }, { id: 'BRUTALITY', stacks: 2 }]
        const enemy = createDummyEnemy('enemy'); enemy.hp = 5
        const engine = new Engine('combust', player, [enemy])
        engine.enqueue({ kind: 'EndTurn' })
        const events = engine.runUntilIdle()
        expect(engine.state.victory).toBe(true); expect(engine.state.defeat).toBe(false)
        expect(player.hp).toBe(1)
        expect(events.filter(event => event.kind === 'TurnChanged')).toEqual([])
    })
    it('normalizes omitted targeting for every caller', () => {
        for (const id of ['INFLAME', 'HAVOC', 'RUPTURE', 'FINESSE', 'APOTHEOSIS']) expect(resolveCard(createCardInstance(id)).targeting).toEqual({ type: 'none' })
    })
    it('cannot lose more energy than available when drawing multiple Voids', () => {
        const player = createSimplePlayer('void'); player.energy = 1
        player.drawPile = [createCardInstance('VOID'), createCardInstance('VOID')]
        player.hand = [createCardInstance('ANGER')]
        const engine = new Engine('void', player, [createDummyEnemy('enemy')])
        engine.enqueue({ kind: 'DrawCards', count: 2 }); engine.runUntilIdle()
        expect(player.energy).toBe(0)
        expect(engine.playCard(player.hand[0], ['enemy']).some(event => event.kind === 'CardPlayed')).toBe(true)
    })
    it.each([false, true])('applies Dexterity and Frail=%s to Finesse', frail => {
        const player = createSimplePlayer('finesse'); player.hand = [createCardInstance('FINESSE')]
        player.powers = [{ id: 'DEXTERITY', stacks: 2 }]
        if (frail) player.powers.push({ id: 'FRAIL', stacks: 1 })
        const engine = new Engine('finesse', player, [createDummyEnemy('enemy')])
        engine.playCard(player.hand[0], []); engine.runUntilIdle()
        expect(player.block).toBe(frail ? 3 : 4)
    })
    it('applies Busted Crown to all five Orrery choices', () => {
        const run = createNewRun({ seed: 'crown' }); run.gold = 1000; run.relics.push('BUSTED_CROWN')
        const meta = loadMeta(); const shop = generateShop(run, meta)
        shop.relics = ['ORRERY']; shop.relicPrices = [150]
        purchaseShopItem(run, meta, shop, 'relics', 0)
        expect(run.pendingAcquisitions).toHaveLength(5)
        for (let i = 0; i < 5; i++) {
            const step = prepareAcquisition(run, meta)
            expect(step?.kind === 'cards' && step.choices).toHaveLength(1)
            chooseAcquisition(run, meta)
        }
        expect(run.pendingAcquisitions).toHaveLength(0)
    })
    it('records an Act 4 defeat once and unlocks the next Ascension', () => {
        const run = createNewRun({ seed: 'act4', mode: 'standard' }); run.act = 4; run.actsCleared = [1, 2, 3]
        const meta = loadMeta()
        expect(recordRunResult(meta, run, 'defeat').unlockedNext).toBe(true)
        expect(meta).toMatchObject({ totalRuns: 1, totalWins: 0, bestAscensionUnlocked: 1, previousRunReachedBoss: true })
        recordRunResult(meta, run, 'defeat')
        expect(meta.totalRuns).toBe(1)
        const next = createNewRun({ seed: undefined, ascension: 0, previousRunReachedBoss: meta.previousRunReachedBoss })
        expect(rollNeowOptions(next.neowSeed, next.neowFull)).toHaveLength(4)
    })
    it('keeps short Neow after an early defeat', () => {
        const run = createNewRun({ seed: 'early' }); const meta = loadMeta()
        recordRunResult(meta, run, 'defeat')
        const next = createNewRun({ seed: undefined, ascension: 0, previousRunReachedBoss: meta.previousRunReachedBoss })
        expect(rollNeowOptions(next.neowSeed, next.neowFull)).toHaveLength(2)
    })
    it('persists active play time and enables Secret Portal at 800 seconds', () => {
        const run = createNewRun({ seed: 'clock' }); run.act = 3
        advanceRunClock(run, 799_000)
        expect(EVENT_DEFS.SECRET_PORTAL.eligible!(run)).toBe(false)
        saveRun(run)
        const resumed = loadRun()!
        expect(resumed.elapsedSeconds).toBe(799)
        advanceRunClock(resumed, 1000)
        expect(EVENT_DEFS.SECRET_PORTAL.eligible!(resumed)).toBe(true)
    })
    it('saves elapsed time without replacing the combat-entry inventory', () => {
        const run = createNewRun({ seed: 'clock-checkpoint' }); run.potions = ['BLOCK_POTION']
        run.relicState = { NEOWS_LAMENT: { charges: 3 } }
        saveRun(run)
        run.potions = []; run.relicState.NEOWS_LAMENT!.charges = 2
        advanceRunClock(run, 1500); checkpointRunClock(run)
        expect(loadRun()).toMatchObject({ elapsedSeconds: 1.5, potions: ['BLOCK_POTION'], relicState: { NEOWS_LAMENT: { charges: 3 } } })
    })
    it('resolves all hits of Twin Strike before Curl Up grants Block', () => {
        const player = createSimplePlayer('curl'); player.hand = [createCardInstance('TWIN_STRIKE')]
        const enemy = createEnemyState('RED_LOUSE', 'louse'); enemy.hp = enemy.maxHp = 30
        enemy.powers = [{ id: 'CURL_UP', stacks: 7 }]
        const engine = new Engine('curl', player, [enemy])
        engine.playCard(player.hand[0], ['louse']); engine.runUntilIdle()
        expect(enemy.hp).toBe(20); expect(enemy.block).toBe(7)
    })
    it('upgrades basic cards without upgrading cards merely named Strike', () => {
        const run = createNewRun({ seed: 'writing' }); run.act = 2
        run.deck = ['STRIKE', 'DEFEND', 'POMMEL_STRIKE', 'WILD_STRIKE'].map(id => createCardInstance(id))
        run.eventState = { id: 'ANCIENT_WRITING' }
        resolveEventChoice(run, loadMeta(), 'ANCIENT_WRITING', 'WRITING_UPGRADE', 'writing')
        expect(run.deck.map(card => card.upgradeLevel)).toEqual([1, 1, 0, 0])
    })
    it('never opens Nemesis with Scythe', () => {
        for (let i = 0; i < 100; i++) {
            const enemy = createEnemyState('NEMESIS', 'nemesis')
            const engine = new Engine(String(i), createSimplePlayer(String(i)), [enemy])
            expect(rollEngineIntentForEnemy(new RNG(String(i)), enemy, engine.state)?.move).not.toBe('scythe')
        }
    })
})
