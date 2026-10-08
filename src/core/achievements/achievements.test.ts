import { describe, expect, it } from 'vitest'
import { createNewRun } from '../run'
import { createCardInstance } from '../cards'
import { createCombatEngine } from '../combat'
import { createDefaultMeta } from '../meta'
import { finishCombat } from '../rooms'
import { recordRunResult } from '../runResults'
import { ACHIEVEMENT_IDS } from './catalog'
import { campaignAchievements, commitAchievements, earnAchievement } from './progress'

function fight(enemies = ['CULTIST'], deck = ['DEFEND']) {
    const run = createNewRun({ seed: 'achievement', mode: 'standard' }); run.floor = 4
    run.eventCombat = { enemies: enemies as NonNullable<typeof run.eventCombat>['enemies'], rewards: { tier: 'hallway', items: [] } }
    run.deck = deck.map(id => createCardInstance(id))
    return { run, engine: createCombatEngine(run, 'monster') }
}

describe('achievement conditions', () => {
    it('has all 46 unique catalog entries and excludes seeded/custom achievement progress', () => {
        expect(ACHIEVEMENT_IDS).toHaveLength(46)
        for (const mode of ['seeded', 'daily', 'custom'] as const) {
            const run = createNewRun({ mode }); earnAchievement(run, 'ADRENALINE'); expect(run.earnedAchievements).toBeUndefined()
            if (mode === 'daily') { earnAchievement(run, 'MY_LUCKY_DAY'); expect(run.earnedAchievements).toEqual(['MY_LUCKY_DAY']) }
        }
    })
    it('captures temporary block, energy, Focus, Strength, and Poison thresholds', () => {
        const { run, engine } = fight()
        for (const [id, stacks] of [['STRENGTH', 50], ['FOCUS', 25]] as const) engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: id, stacks })
        engine.enqueue({ kind: 'GainEnergy', amount: 9 }); engine.enqueue({ kind: 'GainBlock', target: 'player', amount: 999 })
        engine.enqueue({ kind: 'ApplyPower', target: 'e1', powerId: 'POISON', stacks: 99 }); engine.runUntilIdle()
        engine.state.player.block = 0; engine.state.player.energy = 0
        expect(run.earnedAchievements).toEqual(expect.arrayContaining(['ADRENALINE', 'IMPERVIOUS', 'BARRICADED', 'JAXXED', 'FOCUSED', 'CATALYST']))
    })
    it('counts repeated exhaust actions and resets Shiv/Plasma counts between turns', () => {
        const { run, engine } = fight(['GIANT_HEAD'], Array(10).fill('SHIV'))
        for (let i = 0; i < 20; i++) { const card = createCardInstance('WOUND'); engine.state.player.hand.push(card); engine.handleExhaustFromHand(card) }
        expect(run.earnedAchievements).toContain('THE_PACT')
        engine.enqueue({ kind: 'DrawCards', count: 5 }); engine.runUntilIdle()
        for (const card of [...engine.state.player.hand]) { engine.playCard(card, ['e1']); engine.runUntilIdle() }
        expect(run.earnedAchievements).toContain('NINJA')
        engine.state.player.orbSlots = 3
        for (let i = 0; i < 8; i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' })
        engine.runUntilIdle(); expect(run.earnedAchievements).not.toContain('NEON')
        engine.enqueue({ kind: 'StartPlayerTurn' }); engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' }); engine.runUntilIdle()
        expect(engine.state.achievementStats!.shivs).toBe(0); expect(run.earnedAchievements).not.toContain('NEON')
        for (let i = 0; i < 8; i++) engine.enqueue({ kind: 'ChannelOrb', orbType: 'plasma' })
        engine.runUntilIdle(); expect(run.earnedAchievements).toContain('NEON')
    })
    it('counts 25 actual plays and ten distinct buffs, excluding helper counters and debuffs', () => {
        const { run, engine } = fight(['CULTIST'], Array(5).fill('FINESSE'))
        for (let i = 0; i < 25; i++) {
            const card = engine.state.player.hand[0]
            expect(engine.playCard(card, []).some(event => event.kind === 'CardPlayed')).toBe(true)
            engine.runUntilIdle()
        }
        expect(run.earnedAchievements).toContain('INFINITY')
        for (const id of ['STRENGTH', 'DEXTERITY', 'THORNS', 'METALLICIZE', 'BARRICADE', 'FEEL_NO_PAIN', 'JUGGERNAUT', 'DARK_EMBRACE', 'EVOLVE', 'WEAK', 'COMBUST_HP_LOSS'] as const)
            engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: id, stacks: 3 })
        engine.runUntilIdle(); expect(run.earnedAchievements).not.toContain('POWERFUL')
        engine.enqueue({ kind: 'ApplyPower', target: 'player', powerId: 'DEMON_FORM', stacks: 1 }); engine.runUntilIdle()
        expect(run.earnedAchievements).toContain('POWERFUL')
    })
    it('attributes Poison kills without counting corpse explosion or escaped enemies', () => {
        const { run, engine } = fight(['CULTIST', 'CULTIST', 'CULTIST'])
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'ApplyPower', target: enemy.id, powerId: 'POISON', stacks: 100 })
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
        expect(run.earnedAchievements).toContain('PLAGUE')
        const blast = fight(['CULTIST', 'CULTIST', 'CULTIST'])
        blast.engine.enqueue({ kind: 'ApplyPower', target: 'e1', powerId: 'CORPSE_EXPLOSION', stacks: 10 })
        blast.engine.enqueue({ kind: 'ApplyPower', target: 'e1', powerId: 'POISON', stacks: 100 })
        blast.engine.enqueue({ kind: 'EndTurn' }); blast.engine.runUntilIdle()
        expect(blast.run.earnedAchievements).not.toContain('PLAGUE')
    })
    it('only awards the Transient for a real kill and Donu for Feed', () => {
        const faded = fight(['TRANSIENT']); faded.engine.enqueue({ kind: 'EnemyEffect', enemyId: 'e1', effect: { kind: 'escape' } }); faded.engine.runUntilIdle()
        finishCombat(faded.run, faded.engine, 'monster', createDefaultMeta()); expect(faded.run.earnedAchievements ?? []).not.toContain('THE_TRANSIENT')
        expect(faded.run.earnedAchievements ?? []).not.toContain('COME_AT_ME')
        const killed = fight(['TRANSIENT']); killed.engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); killed.engine.runUntilIdle()
        expect(killed.run.earnedAchievements).toContain('THE_TRANSIENT')
        const donut = fight(['DONU', 'DECA'], ['FEED']); donut.engine.state.enemies[0].hp = 1
        donut.engine.playCard(donut.engine.state.player.hand[0], ['e1']); donut.engine.runUntilIdle()
        expect(donut.run.earnedAchievements).toContain('OOH_DONUT')
    })
    it('checks Purity only above floor three and includes all three active piles', () => {
        const run = createNewRun({ seed: 'purity', mode: 'standard' }); run.deck = [createCardInstance('DEFEND')]
        createCombatEngine(run, 'monster'); expect(run.earnedAchievements).toBeUndefined()
        run.floor = 4; createCombatEngine(run, 'monster'); expect(run.earnedAchievements).toContain('PURITY')
        const four = fight(['CULTIST'], Array(4).fill('DEFEND')); expect(four.run.earnedAchievements ?? []).not.toContain('PURITY')
    })
    it('waits for the final boss phase and checks HP before post-combat healing', () => {
        const { run, engine } = fight(['AWAKENED_ONE']); engine.state.player.hp = 1
        engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); engine.runUntilIdle(); expect(engine.state.victory).toBe(false)
        expect(run.earnedAchievements ?? []).not.toContain('THE_CROW')
        engine.state.enemies[0].halfDead = false; engine.enqueue({ kind: 'GainEnergy', amount: 0 }); engine.runUntilIdle()
        finishCombat(run, engine, 'boss', createDefaultMeta())
        expect(run.earnedAchievements).toEqual(expect.arrayContaining(['THE_CROW', 'SHRUG_IT_OFF', 'COME_AT_ME', 'PERFECT', 'YOU_ARE_NOTHING']))
        expect(run.player.hp).toBeGreaterThan(1)
    })
    it('awards turn-one Awakened One phase one, but needs both Donu and Deca on turn one', () => {
        const awakened = fight(['AWAKENED_ONE'])
        awakened.engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); awakened.engine.runUntilIdle()
        expect(awakened.run.earnedAchievements).toContain('YOU_ARE_NOTHING')
        expect(awakened.engine.state.victory).toBe(false)
        awakened.engine.enqueue({ kind: 'EndTurn' }); awakened.engine.runUntilIdle()
        expect(awakened.engine.state.turnNumber).toBeGreaterThan(1)
        awakened.engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); awakened.engine.runUntilIdle()
        finishCombat(awakened.run, awakened.engine, 'boss', createDefaultMeta())
        expect(awakened.run.earnedAchievements).toContain('THE_CROW')
        expect(awakened.run.earnedAchievements!.filter(id => id === 'YOU_ARE_NOTHING')).toHaveLength(1)
        const shapes = fight(['DONU', 'DECA'])
        shapes.engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); shapes.engine.runUntilIdle()
        expect(shapes.run.earnedAchievements ?? []).not.toContain('YOU_ARE_NOTHING')
        shapes.engine.enqueue({ kind: 'SetHp', target: 'e2', hp: 0 }); shapes.engine.runUntilIdle()
        finishCombat(shapes.run, shapes.engine, 'boss', createDefaultMeta())
        expect(shapes.run.earnedAchievements).toContain('YOU_ARE_NOTHING')
        const late = fight(['DONU', 'DECA'])
        late.engine.enqueue({ kind: 'SetHp', target: 'e1', hp: 0 }); late.engine.enqueue({ kind: 'EndTurn' }); late.engine.runUntilIdle()
        late.engine.enqueue({ kind: 'SetHp', target: 'e2', hp: 0 }); late.engine.runUntilIdle()
        finishCombat(late.run, late.engine, 'boss', createDefaultMeta())
        expect(late.run.earnedAchievements ?? []).not.toContain('YOU_ARE_NOTHING')
    })
    it('commits once, aggregates Heart wins, and completes Eternal One last', () => {
        const run = createNewRun(), meta = createDefaultMeta()
        run.earnedAchievements = ['RUBY_PLUS', 'EMERALD_PLUS', 'SAPPHIRE_PLUS']
        expect(commitAchievements(meta, run)).toContain('THE_END')
        const first = meta.notifications!.length; expect(commitAchievements(meta, run)).toEqual([]); expect(meta.notifications).toHaveLength(first)
        run.earnedAchievements = ACHIEVEMENT_IDS.filter(id => id !== 'ETERNAL_ONE')
        expect(commitAchievements(meta, run)).toContain('ETERNAL_ONE')
    })
    it('records Act 3 conditions before an Act 4 loss and does not repeat unlock notices', () => {
        const run = createNewRun({ mode: 'standard', character: 'watcher', ascension: 20 }), meta = createDefaultMeta()
        run.act = 3; run.actsCleared = [1, 2, 3]; run.deck = Array.from({ length: 5 }, () => createCardInstance('STRIKE_WATCHER'))
        campaignAchievements(run); run.act = 4
        recordRunResult(meta, run, 'defeat')
        expect(meta.achievements).toMatchObject({ AMETHYST: expect.any(String), ASCEND_20: expect.any(String), MINIMALIST: expect.any(String), COMMON_SENSE: expect.any(String), WHO_NEEDS_RELICS: expect.any(String) })
        expect(meta.achievements?.AMETHYST_PLUS).toBeUndefined()
        const count = meta.notifications!.length; recordRunResult(meta, run, 'defeat'); expect(meta.notifications).toHaveLength(count)
    })
})
