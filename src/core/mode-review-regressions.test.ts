import { describe, it, expect } from 'vitest'
import { createNewRun } from './run'
import { createDefaultMeta } from './meta'
import { createCombatEngine, applyCombatVictory } from './combat'
import { powerAmount } from './combatMath'
import { createEnemyState } from './enemies'
import { Engine, createPlayerFromDeck } from './engine'
import { initializeEvent, resolveEventChoice, getEventChoices, eventSeed } from './events'
import { generateRewardBundle } from './rewards'
import { getRunMap, updateUnknownWeights, defaultUnknownWeights, resolveUnknown } from './map'
import { RNG } from './rng'

describe('mode and event review regressions', () => {
    it('expires Hauntings while preserving Nemesis alternating Intangible', () => {
        for (const stacks of [1, 2]) {
            const run = createNewRun(); run.blights = { HAUNTINGS: stacks }
            const engine = createCombatEngine(run, 'monster')
            engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle()
            expect(powerAmount(engine.state.enemies[0], 'INTANGIBLE')).toBe(stacks - 1)
        }
        const enemy = createEnemyState('NEMESIS', 'nemesis', 0, new RNG('nemesis'))
        const engine = new Engine('nemesis', createPlayerFromDeck('player', [], 999, 999), [enemy])
        engine.enqueue({ kind: 'StartPlayerTurn' }); engine.runUntilIdle()
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); expect(powerAmount(enemy, 'INTANGIBLE')).toBe(1)
        engine.enqueue({ kind: 'EndTurn' }); engine.runUntilIdle(); expect(powerAmount(enemy, 'INTANGIBLE')).toBe(0)
    })
    it('cannot persist Fruit Juice max HP through Muzzle', () => {
        const run = createNewRun(); run.endlessLoop = 3; run.potions = ['FRUIT_JUICE']
        const engine = createCombatEngine(run, 'monster')
        engine.usePotionAtIndex(0, [engine.state.player.id]); applyCombatVictory(run, engine.state.player)
        expect(run.player.maxHp).toBe(80)
    })
    it('keeps We Meet Again bound to the requested potion after discard and reload', () => {
        const run = createNewRun(), meta = createDefaultMeta(); run.potions = ['FIRE_POTION', 'BLOOD_POTION']
        initializeEvent(run, meta, 'WE_MEET_AGAIN'); run.eventState!.potionId = 'FIRE_POTION'
        run.potions.shift(); const resumed = JSON.parse(JSON.stringify(run))
        const choice = getEventChoices(resumed).find(c => c.id === 'MEET_POTION')!
        expect(choice.description).toContain('Fire Potion'); expect(choice.disabled!(resumed)).toBe(true)
        resolveEventChoice(resumed, meta, 'WE_MEET_AGAIN', 'MEET_POTION', eventSeed(resumed))
        expect(resumed.potions).toEqual(['BLOOD_POTION']); expect(resumed.relics).toHaveLength(1)
    })
    it('does not consume relics omitted from endless elite or event rewards', () => {
        const run = createNewRun(), meta = createDefaultMeta(); run.endlessLoop = 1
        generateRewardBundle('elite', 'elite', run, meta); expect(run.seenRelics ?? []).toEqual([])
        run.endlessLoop = 0; initializeEvent(run, meta, 'COLOSSEUM'); run.eventState!.step = 'second'
        resolveEventChoice(run, meta, 'COLOSSEUM', 'COLOSSEUM_SECOND', eventSeed(run))
        const relics = run.eventCombat!.rewards.items.filter(i => i.kind === 'relic').map(i => i.relicId)
        expect(run.seenRelics).toEqual(relics)
    })
    it('uses the current cycle when taking Secret Portal', () => {
        for (const loop of [0, 2]) {
            const run = createNewRun(), meta = createDefaultMeta(); run.act = 3; run.endlessLoop = loop
            const map = getRunMap(run), node = map.nodes.find(n => n.kind === 'unknown')!
            run.floor = 50 + 51 * loop - node.row; run.mapProgress = { currentNodeId: node.id }
            initializeEvent(run, meta, 'SECRET_PORTAL')
            const resumed = JSON.parse(JSON.stringify(run)); resolveEventChoice(resumed, meta, 'SECRET_PORTAL', 'PORTAL_ENTER', eventSeed(resumed))
            expect(resumed.floor).toBe(50 + 51 * loop); expect(resumed.pendingRoom).toEqual({ scene: 'Combat', roomKind: 'boss' })
        }
    })
    it('requires two distinct original cards for Augmenter after reload', () => {
        const run = createNewRun(), meta = createDefaultMeta(); initializeEvent(run, meta, 'AUGMENTER')
        const original = run.deck.map(c => c.instanceId)
        resolveEventChoice(run, meta, 'AUGMENTER', 'AUGMENT_TRANSFORM', eventSeed(run), { cardInstanceId: original[0] })
        const resumed = JSON.parse(JSON.stringify(run)), replacement = run.deck.find(c => !original.includes(c.instanceId))!
        resolveEventChoice(resumed, meta, 'AUGMENTER', 'AUGMENT_TRANSFORM', eventSeed(resumed), { cardInstanceId: replacement.instanceId })
        expect(resumed.eventState.resolved).toBe(false)
        resolveEventChoice(resumed, meta, 'AUGMENTER', 'AUGMENT_TRANSFORM', eventSeed(resumed), { cardInstanceId: original[1] })
        expect(resumed.eventState.resolved).toBe(true)
    })
    it('tracks an independent elite chance and faster chest ramp for Deadly Events', () => {
        const weights = updateUnknownWeights(defaultUnknownWeights(), 'event', true)
        expect(weights.chest).toBeCloseTo(0.06); expect(weights.elite).toBeCloseTo(0.4)
        expect(resolveUnknown({ random: () => 0.05 } as RNG, weights)).toBe('monster')
        expect(resolveUnknown({ random: () => 0.5 } as RNG, weights)).toBe('elite')
    })
})
