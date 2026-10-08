import { afterEach, describe, expect, it, vi } from 'vitest'
import { advanceAct, finishBossCombat, finishRewards, getRunBoss, hasAllKeys } from './campaign'
import { CARD_DEFS, createCardInstance } from './cards'
import { createCombatEngine } from './combat'
import { createEnemyState, ENEMIES, rollEngineIntentForEnemy } from './enemies'
import { createDummyEnemy, createSimplePlayer, Engine } from './engine'
import { generateEncounter, ACT_BOSSES } from './encounters'
import { generateMap } from './map'
import { getRunDestination } from './progression'
import { RNG } from './rng'
import { createNewRun, loadRun, removeCardByInstanceId } from './run'
import { powerAmount } from './combatMath'

const meta = { bestAscensionUnlocked: 0, totalWins: 0, totalRuns: 0, ironcladUnlockTier: 0, unlockedCardIds: [], unlockedRelicIds: [] }
function battle(ids: string[], hand: string[] = [], asc = 0): Engine {
    const player = createSimplePlayer('campaign-test')
    player.hand = hand.map(id => createCardInstance(id))
    player.drawPile = []; player.discardPile = []; player.hp = player.maxHp = 10000; player.energy = 100
    const enemies = ids.map((id, i) => createEnemyState(id, `e${i}`, asc, new RNG(id)))
    const engine = new Engine('campaign-test', player, enemies)
    for (const enemy of enemies) enemy.intent = rollEngineIntentForEnemy(engine.rng, enemy, engine.state)
    return engine
}
function end(engine: Engine): void { engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle() }
function play(engine: Engine, index = 0, targets: string[] = []): void { engine.playCard(engine.state.player.hand[index], targets); engine.runUntilIdle() }
afterEach(() => vi.unstubAllGlobals())

describe('Ironclad campaign', () => {
    it('contains all 75 Ironclad cards and keeps status cards outside reward pools', () => {
        expect(Object.values(CARD_DEFS).filter(card => card.color === 'ironclad')).toHaveLength(75)
        expect(CARD_DEFS.VOID.poolEnabled).toBe(false)
    })
    it('builds each ascension starting deck at its own threshold', () => {
        expect(createNewRun('s', 5).player).toEqual({ hp: 80, maxHp: 80 })
        expect(createNewRun('s', 6).player).toEqual({ hp: 72, maxHp: 80 })
        expect(createNewRun('s', 10).deck.some(card => card.defId === 'ASCENDERS_BANE')).toBe(true)
        expect(createNewRun('s', 11).maxPotionSlots).toBe(2)
        expect(createNewRun('s', 14).player).toEqual({ hp: 68, maxHp: 75 })
        const run = createNewRun('s', 20)
        const curse = run.deck.find(card => card.defId === 'ASCENDERS_BANE')!
        expect(removeCardByInstanceId(run, curse.instanceId)).toBeUndefined()
        expect(run.deck).toContain(curse)
    })
    it('offers gold and rare cards before the boss relic, then heals into the next act', () => {
        const run = createNewRun('reward-route', 5)
        run.neowCompleted = true; run.player.hp = 20; run.floor = 16
        expect(finishBossCombat(run, meta)).toBe('Rewards')
        expect(getRunDestination(run).scene).toBe('Rewards')
        if (run.pendingRoom?.scene !== 'Rewards') throw new Error('Expected rewards')
        const cards = run.pendingRoom.rewards.items.find(item => item.kind === 'cards')
        expect(cards?.kind === 'cards' && cards.choices.every(id => CARD_DEFS[id].rarity === 'rare')).toBe(true)
        expect(finishRewards(run)).toBe('BossRelic')
        expect(getRunDestination(run).scene).toBe('BossRelic')
        advanceAct(run)
        expect(run.act).toBe(2); expect(run.floor).toBe(18); expect(run.player.hp).toBe(65)
        finishBossCombat(run, meta); finishRewards(run); advanceAct(run)
        expect(run.act).toBe(3)
    })
    it('requires all three keys for Act 4 and heals on entry', () => {
        const run = createNewRun('keys'); run.act = 3; run.player.hp = 23
        expect(hasAllKeys(run)).toBe(false)
        expect(finishBossCombat(run, meta)).toBe('RunSummary')
        run.keys = { ruby: true, sapphire: true, emerald: true }
        expect(finishBossCombat(run, meta)).toBe('Map')
        expect(run.act).toBe(4); expect(run.player.hp).toBe(80)
        expect(generateMap(run.seed, 4).nodes.map(n => n.kind)).toEqual(['rest', 'shop', 'elite', 'boss'])
        expect(finishBossCombat(run, meta)).toBe('RunSummary')
    })
    it('chains two distinct bosses at A20 without healing or rewards between', () => {
        const run = createNewRun('double-boss', 20); run.act = 3; run.player.hp = 19
        const first = getRunBoss(run)
        expect(finishBossCombat(run, meta)).toBe('Combat')
        expect(getRunBoss(run)).not.toBe(first); expect(run.player.hp).toBe(19)
        expect(run.actsCleared).not.toContain(3)
        expect(finishBossCombat(run, meta)).toBe('RunSummary')
        expect(run.actsCleared).toContain(3)
    })
    it('places required map rooms on every path and avoids crossing edges', () => {
        for (let i = 0; i < 100; i++) {
            const map = generateMap(`map-${i}`, 1, 16, 7, i % 21)
            expect(map.startIds.every(id => map.byId[id].kind === 'monster')).toBe(true)
            expect(map.nodes.filter(n => n.row === 7).every(n => n.kind === 'chest')).toBe(true)
            expect(map.nodes.filter(n => n.row === 1).every(n => n.kind === 'rest')).toBe(true)
            expect(map.nodes.filter(n => n.kind === 'boss')).toHaveLength(1)
            expect(map.nodes.filter(n => n.burning)).toHaveLength(1)
            for (const n of map.nodes) for (const edge of n.edgesTo) expect(map.byId[edge].row).toBe(n.row - 1)
        }
    })
    it('has runnable specifications for every generated encounter and boss', () => {
        for (const act of [1, 2, 3, 4] as const) {
            for (const tier of ['hallway', 'elite', 'boss'] as const) {
                for (let i = 0; i < 30; i++) for (const id of generateEncounter(new RNG(`${act}-${tier}-${i}`), act, tier, i)) expect(ENEMIES[id]).toBeDefined()
            }
            for (const id of ACT_BOSSES[act]) {
                const engine = battle([id], [], 20)
                for (let turn = 0; turn < 12 && !engine.state.victory; turn++) end(engine)
                expect(engine.state.defeat).toBe(false)
                expect(engine.state.enemies.every(enemy => Number.isFinite(enemy.hp) && Number.isFinite(enemy.block))).toBe(true)
            }
        }
    })
    it('rejects malformed saved runs and migrates old map/key fields', () => {
        let raw = JSON.stringify({ seed: 'broken' })
        vi.stubGlobal('localStorage', { getItem: () => raw })
        expect(loadRun()).toBeUndefined()
        const legacy = { ...createNewRun('legacy'), keys: undefined, mapRows: undefined }
        raw = JSON.stringify(legacy)
        expect(loadRun()?.keys).toEqual({ ruby: false, sapphire: false, emerald: false })
        expect(loadRun()?.mapRows).toBe(15)
    })
})

describe('new Ironclad cards', () => {
    it('resolves nested Havoc before finalizing its parent and charges no extra energy', () => {
        const engine = battle(['CULTIST'], ['HAVOC'])
        engine.state.player.drawPile = ['HAVOC', 'STRIKE'].map(id => createCardInstance(id))
        const hp = engine.state.enemies[0].hp
        play(engine)
        expect(engine.state.enemies[0].hp).toBe(hp - 6)
        expect(engine.state.player.energy).toBe(99)
        expect(engine.state.player.exhaustPile.map(c => c.defId)).toEqual(['STRIKE', 'HAVOC'])
        expect(engine.state.player.discardPile.map(c => c.defId)).toEqual(['HAVOC'])
        expect(engine.state.limbo).toEqual([])
    })
    it('can pause an autoplayed card for its selection, then finish Havoc', () => {
        const engine = battle(['CULTIST'], ['HAVOC', 'DEFEND'])
        engine.state.player.drawPile = [createCardInstance('ARMAMENTS')]
        play(engine)
        expect(engine.getPendingChoice()).toBeDefined()
        engine.submitPendingChoice([engine.state.player.hand[0].instanceId]); engine.runUntilIdle()
        expect(engine.state.player.hand[0].upgradeLevel).toBe(1)
        expect(engine.state.player.exhaustPile[0].defId).toBe('ARMAMENTS')
        expect(engine.state.limbo).toHaveLength(0)
    })
    it('reduces Blood for Blood after HP loss and applies Rupture only to card HP loss', () => {
        const engine = battle(['CULTIST'], ['BLOOD_FOR_BLOOD'])
        engine.setPowerStacks(engine.state.player, 'RUPTURE', 2)
        engine.enqueue({ kind: 'LoseHp', target: 'player', amount: 3 }); engine.runUntilIdle()
        expect(engine.getCardCost(engine.state.player.hand[0])).toBe(3)
        expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(2)
        engine.enqueue({ kind: 'DealDamage', source: 'e0', target: 'player', amount: 5 }); engine.runUntilIdle()
        expect(engine.getCardCost(engine.state.player.hand[0])).toBe(2)
        expect(powerAmount(engine.state.player, 'STRENGTH')).toBe(2)
    })
    it('uses the generated attack cost only for the current turn', () => {
        const engine = battle(['CULTIST'], ['INFERNAL_BLADE'])
        play(engine)
        const attack = engine.state.player.hand[0]
        expect(engine.getCardCost(attack)).toBe(0)
        end(engine)
        expect(attack.costForTurn).toBeUndefined()
    })
})

describe('boss and elite mechanics', () => {
    it('waits a full turn before Darkling reincarnation and wins when all are down', () => {
        const engine = battle(['DARKLING', 'DARKLING', 'DARKLING'])
        const darkling = engine.state.enemies[0]
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: darkling.id, amount: 999 }); engine.runUntilIdle()
        expect(darkling.intent).toMatchObject({ desc: 'Regrow' }); expect(engine.state.victory).toBe(false)
        end(engine); expect(darkling.hp).toBe(0)
        end(engine); expect(darkling.hp).toBe(Math.floor(darkling.maxHp / 2))
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'DealDamage', source: 'player', target: enemy.id, amount: 999 })
        engine.runUntilIdle(); expect(engine.state.victory).toBe(true)
    })
    it('returns the actual stolen rare card when its Bronze Orb dies', () => {
        const engine = battle(['BRONZE_ORB', 'BRONZE_AUTOMATON'])
        const rare = createCardInstance('DEMON_FORM', 1)
        engine.state.player.drawPile = [createCardInstance('STRIKE'), rare]
        engine.state.enemies[0].intent = { kind: 'buff', desc: 'Stasis', move: 'stasis' }
        end(engine)
        expect(engine.state.enemies[0].stasisCard).toBe(rare)
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: 'e0', amount: 999 }); engine.runUntilIdle()
        expect(engine.state.player.hand).toContain(rare)
    })
    it('finishes the twelfth card then ends the turn against Time Eater', () => {
        const engine = battle(['TIME_EATER'], Array(12).fill('DEFEND'))
        for (let i = 0; i < 12; i++) play(engine)
        expect(powerAmount(engine.state.enemies[0], 'STRENGTH')).toBe(2)
        expect(engine.state.player.energy).toBe(3)
        expect(engine.state.enemies[0].aiState?.cards).toBe(0)
        expect(engine.state.player.discardPile.length + engine.state.player.drawPile.length + engine.state.player.hand.length).toBe(12)
    })
    it('does not end combat on Awakened One phase one and disables Curiosity in phase two', () => {
        const engine = battle(['AWAKENED_ONE'])
        const enemy = engine.state.enemies[0]
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: enemy.id, amount: 999 }); engine.runUntilIdle()
        expect(engine.state.victory).toBe(false); expect(enemy.halfDead).toBe(true)
        end(engine); expect(enemy.hp).toBe(enemy.maxHp); expect(enemy.intent).toMatchObject({ kind: 'attack', amount: 40 })
        engine.state.player.hand = [createCardInstance('INFLAME')]; play(engine)
        expect(powerAmount(enemy, 'STRENGTH')).toBe(0)
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: enemy.id, amount: 999 }); engine.runUntilIdle()
        expect(engine.state.victory).toBe(true)
    })
    it.each([0, 19])('caps Heart damage each turn at ascension %i', asc => {
        const engine = battle(['CORRUPT_HEART'], [], asc)
        const heart = engine.state.enemies[0]
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: heart.id, amount: 999 }); engine.runUntilIdle()
        const cap = asc >= 19 ? 200 : 300
        expect(heart.hp).toBe(heart.maxHp - cap)
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: heart.id, amount: 100 }); engine.runUntilIdle()
        expect(heart.hp).toBe(heart.maxHp - cap)
        end(engine)
        engine.enqueue({ kind: 'DealDamage', source: 'player', target: heart.id, amount: 999 }); engine.runUntilIdle()
        expect(heart.hp).toBe(heart.maxHp - cap * 2)
    })
    it('changes which surrounded enemy has a back attack when targeting a card', () => {
        const run = createNewRun('surrounded'); run.act = 4
        const engine = createCombatEngine(run, 'elite')
        const [shield, spear] = engine.state.enemies
        shield.intent = { kind: 'attack', amount: 10 }; spear.intent = { kind: 'attack', amount: 10 }
        expect(engine.previewEnemyAttack(shield)).toBe(10); expect(engine.previewEnemyAttack(spear)).toBe(15)
        engine.state.player.hand = [createCardInstance('STRIKE')]
        play(engine, 0, [spear.id])
        expect(engine.previewEnemyAttack(shield)).toBe(15); expect(engine.previewEnemyAttack(spear)).toBe(10)
    })
    it('keeps a dummy combat usable without a run or spec', () => {
        const engine = new Engine('dummy', createSimplePlayer('s'), [createDummyEnemy('e')]); end(engine)
        expect(engine.state.player.hp).toBe(75)
    })
})

describe('campaign review regressions', () => {
    it('preserves the real outgoing edge of a pre-campaign save', () => {
        const run = { ...createNewRun('legacy-0'), keys: undefined, mapRows: undefined, mapProgress: { currentNodeId: '1:4' }, neowCompleted: true }
        vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(run) })
        const loaded = loadRun()!
        const map = generateMap(loaded.seed, loaded.act, loaded.mapRows, 7, loaded.asc)
        const current = map.byId[loaded.mapProgress!.currentNodeId!]
        expect(current.kind).toBe('rest')
        expect(current.edgesTo.length).toBeGreaterThan(0)
        expect(current.edgesTo.every(id => map.byId[id].kind === 'boss')).toBe(true)
    })
    it('keeps block given to enemies who act later in the turn', () => {
        const engine = battle(['SHIELD_GREMLIN', 'SNEAKY_GREMLIN'])
        end(engine)
        expect(engine.state.enemies[1].block).toBe(7)
    })
    it('uses Double Tap and Pain for an autoplayed attack', () => {
        const engine = battle(['CULTIST'], ['DOUBLE_TAP', 'HAVOC', 'PAIN'])
        engine.state.player.drawPile = [createCardInstance('STRIKE')]
        const hp = engine.state.enemies[0].hp
        play(engine); play(engine)
        expect(engine.state.enemies[0].hp).toBe(hp - 12)
        expect(engine.state.player.hp).toBe(9996)
        expect(engine.state.player.exhaustPile.map(c => c.defId)).toEqual(['STRIKE'])
    })
    it('does not play Double Tap card thirteen or Havoc card thirteen', () => {
        for (const id of ['STRIKE', 'HAVOC']) {
            const engine = battle(['TIME_EATER'], [id])
            const enemy = engine.state.enemies[0]
            enemy.aiState = { ...enemy.aiState, cards: 11 }
            enemy.intent = { kind: 'buff', desc: 'Wait' }
            engine.state.player.drawPile = [createCardInstance('STRIKE')]
            engine.setDoubleTapCharges(1)
            const hp = enemy.hp
            play(engine, 0, id === 'STRIKE' ? [enemy.id] : [])
            expect(enemy.hp).toBe(hp - (id === 'STRIKE' ? 6 : 0))
            expect(enemy.aiState?.cards).toBe(0)
            expect(engine.state.player.energy).toBe(3)
        }
    })
    it.each([0, 6, 10])('heals Parasite only for HP stolen through %i block', block => {
        const engine = battle(['SHELLED_PARASITE'])
        const enemy = engine.state.enemies[0]; enemy.hp = 50
        enemy.intent = { kind: 'attack', amount: 10, move: 'suck' }
        engine.state.player.block = block
        end(engine)
        expect(enemy.hp).toBe(50 + 10 - block)
    })
    it('depletes Plated Armor on any enemy only for unblocked attacks', () => {
        const engine = battle(['THE_CHAMP'])
        const enemy = engine.state.enemies[0]
        engine.setPowerStacks(enemy, 'PLATED_ARMOR', 5)
        enemy.block = 1
        for (let i = 0; i < 2; i++) engine.enqueue({ kind: 'DealDamage', source: 'player', target: enemy.id, amount: 1 })
        engine.runUntilIdle()
        expect(powerAmount(enemy, 'PLATED_ARMOR')).toBe(4)
    })
    it('resets Feed fatal bookkeeping on autoplay after retrieval', () => {
        const engine = battle(['CULTIST', 'CULTIST'], ['FEED'])
        const feed = engine.state.player.hand[0]
        engine.state.enemies[0].hp = 10
        play(engine, 0, ['e0'])
        expect(engine.state.player.maxHp).toBe(10003)
        engine.state.player.exhaustPile.splice(0)
        engine.state.player.drawPile = [feed]
        engine.state.player.hand = [createCardInstance('HAVOC')]
        engine.state.enemies[1].hp = 10
        play(engine)
        expect(engine.state.player.maxHp).toBe(10006)
    })
    it('applies Defend before Beat of Death, then resolves self-exhaust afterward', () => {
        const engine = battle(['CORRUPT_HEART'], ['DEFEND', 'SEEING_RED'])
        engine.state.player.hp = 10
        play(engine)
        expect(engine.state.player.hp).toBe(10); expect(engine.state.player.block).toBe(4)
        engine.state.player.block = 0; engine.setPowerStacks(engine.state.player, 'FEEL_NO_PAIN', 3)
        play(engine)
        expect(engine.state.player.hp).toBe(9); expect(engine.state.player.block).toBe(3)
    })
})
