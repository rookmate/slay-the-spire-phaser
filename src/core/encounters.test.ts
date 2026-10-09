import { afterEach, describe, expect, it, vi } from 'vitest'
import { advanceAct } from './campaign'
import { createCombatEngine } from './combat'
import { powerAmount } from './combatMath'
import { prepareEncounter } from './encounterState'
import { ENCOUNTERS, selectEncounter, type EncounterHistory, type EncounterId } from './encounters'
import { getRunMap } from './map'
import { createDefaultMeta } from './meta'
import { enterRoom, finishCombat } from './rooms'
import { RNG } from './rng'
import { createNewRun, loadRun, saveRun } from './run'

afterEach(() => vi.restoreAllMocks())

describe('encounter families', () => {
    it.each([1, 2, 3] as const)('excludes the previous two hallway families and previous elite in act %i', act => {
        const history: EncounterHistory = { hallway: [] }
        for (let i = 0; i < 120; i++) {
            const fight = selectEncounter(new RNG(`families-${i}`), act, 'hallway', i, history)
            expect(history.hallway).not.toContain(fight.id)
            history.hallway = [...history.hallway, fight.id].slice(-2)
            const elite = selectEncounter(new RNG(`elites-${i}`), act, 'elite', i, history)
            expect(elite.id).not.toBe(history.elite)
            history.elite = elite.id
        }
    })
    it('applies the Act 1 first-hard exclusions and the shared Darkling family', () => {
        const pairs: [EncounterId, EncounterId[]][] = [
            ['TWO_LOUSE', ['THREE_LOUSE']], ['SMALL_SLIMES', ['LARGE_SLIME', 'SWARM_SLIMES']],
            ['LOOTER', ['EXOR_THUGS']], ['BLUE_SLAVER', ['RED_SLAVER', 'EXOR_THUGS']],
        ]
        for (const [previous, forbidden] of pairs) for (let i = 0; i < 100; i++) {
            expect(forbidden).not.toContain(selectEncounter(new RNG(`transition-${i}`), 1, 'hallway', 3, { hallway: [previous] }).id)
        }
        for (let i = 0; i < 100; i++) expect(selectEncounter(new RNG(`darklings-${i}`), 3, 'hallway', 2, { hallway: ['THREE_DARKLINGS'] }).id).not.toBe('THREE_DARKLINGS')
    })
    it('uses the Act 2 hard-pool weights across the whole random range', () => {
        const expected: [EncounterId, number][] = [
            ['CHOSEN_BYRD', 2], ['CHOSEN_CULTIST', 3], ['SENTRY_GUARDIAN', 2], ['SNAKE_PLANT', 6],
            ['SNECKO', 4], ['CENTURION_MYSTIC', 6], ['THREE_CULTISTS', 3], ['PARASITE_FUNGI', 3],
        ]
        const rng = new RNG('weights'), random = vi.spyOn(rng, 'random')
        let lower = 0
        for (const [id, weight] of expected) {
            for (const roll of [lower + 0.000001, lower + weight - 0.000001]) {
                random.mockReturnValue(roll / 29)
                expect(selectEncounter(rng, 2, 'hallway', 2).id).toBe(id)
            }
            lower += weight
        }
    })
    it('varies shapes with at most two copies per species, and rolls guardian escorts independently', () => {
        const variants = new Set<string>(), escorts = new Set<string>()
        for (let i = 0; i < 200; i++) {
            for (const id of ['THREE_SHAPES', 'FOUR_SHAPES'] as const) {
                const enemies = ENCOUNTERS[id].enemies(new RNG(`${id}-${i}`))
                expect(enemies).toHaveLength(id === 'THREE_SHAPES' ? 3 : 4)
                for (const key of new Set(enemies)) expect(enemies.filter(enemy => enemy === key).length).toBeLessThanOrEqual(2)
                variants.add(enemies.join(','))
            }
            const enemies = ENCOUNTERS.GUARDIAN_SHAPES.enemies(new RNG(`escort-${i}`))
            expect(enemies[2]).toBe('SPHERIC_GUARDIAN')
            escorts.add(enemies.slice(0, 2).join(','))
        }
        expect(variants.size).toBeGreaterThan(10)
        expect(escorts.size).toBe(9)
        const hardPool = new Set(Array.from({ length: 200 }, (_, i) => selectEncounter(new RNG(`hard-${i}`), 3, 'hallway', 2).id))
        expect(hardPool.size).toBe(8); expect(hardPool).toContain('GUARDIAN_SHAPES')
    })
    it.each([[0, 3, 6], [1, 3, 6], [2, 4, 6], [16, 4, 6], [17, 5, 9], [20, 5, 9]])('starts the Jaw Worm horde at A%i with %i strength and %i block', (ascension, strength, block) => {
        const run = createNewRun({ seed: 'horde', ascension }); run.act = 3
        run.pendingRoom = { scene: 'Combat', roomKind: 'monster', encounter: { id: 'JAW_WORM_HORDE', enemies: ['JAW_WORM', 'JAW_WORM', 'JAW_WORM'] } }
        const engine = createCombatEngine(run, 'monster')
        for (const enemy of engine.state.enemies) { expect(powerAmount(enemy, 'STRENGTH')).toBe(strength); expect(enemy.block).toBe(block) }
    })
})

describe('encounter checkpoints', () => {
    it('caches a room before saving and does not advance history when creating or reloading combat', () => {
        const run = createNewRun({ seed: 'encounter-entry' })
        const map = getRunMap(run)
        expect(enterRoom(run, map.byId[map.startIds[0]])).toBe(true)
        expect(run.pendingRoom).toMatchObject({ scene: 'Combat', encounter: { enemies: expect.any(Array) } })
        const checkpoint = JSON.stringify(run)
        const first = createCombatEngine(run, 'monster'), second = createCombatEngine(JSON.parse(checkpoint), 'monster')
        expect(first.state.enemies).toEqual(second.state.enemies)
        expect(run.encounterHistory).toEqual({ hallway: [] })
        createCombatEngine(run, 'monster')
        expect(run.encounterHistory).toEqual({ hallway: [] })
    })
    it.each(['monster', 'elite'] as const)('records an escaped %s once and keeps event fights out of the history', roomKind => {
        const run = createNewRun({ seed: 'escape-history' })
        run.pendingRoom = { scene: 'Combat', roomKind }; run.potions = ['SMOKE_BOMB']
        const encounter = prepareEncounter(run, roomKind), engine = createCombatEngine(run, roomKind)
        engine.usePotionAtIndex(0, [])
        expect(engine.state.escaped).toBe(true)
        finishCombat(run, engine, roomKind, createDefaultMeta())
        expect(run.encounterHistory).toEqual(roomKind === 'monster' ? { hallway: [encounter.id] } : { hallway: [], elite: encounter.id })
        expect(run.hallwayCount).toBe(roomKind === 'monster' ? 1 : 0)
        expect(run.combatCount).toBe(1); expect(run.pendingRoom).toBeUndefined()
        const history = structuredClone(run.encounterHistory)
        run.pendingRoom = { scene: 'Combat', roomKind: 'elite' }
        run.eventCombat = { enemies: ['LAGAVULIN'], awakeLagavulin: true, rewards: { tier: 'elite', items: [] } }
        run.potions = ['SMOKE_BOMB']
        const event = createCombatEngine(run, 'elite')
        expect(event.state.enemies[0].specId).toBe('LAGAVULIN')
        event.usePotionAtIndex(0, []); finishCombat(run, event, 'elite', createDefaultMeta())
        expect(run.encounterHistory).toEqual(history)
    })
    it('records wins before replacing the checkpoint with rewards and bounds the history', () => {
        const run = createNewRun({ seed: 'win-history' })
        run.encounterHistory = { hallway: ['CULTIST', 'JAW_WORM'], elite: 'GREMLIN_NOB' }
        run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
        const encounter = prepareEncounter(run, 'monster'), engine = createCombatEngine(run, 'monster')
        for (const enemy of engine.state.enemies) engine.enqueue({ kind: 'DealDamage', source: 'player', target: enemy.id, amount: 1000 })
        engine.runUntilIdle(); finishCombat(run, engine, 'monster', createDefaultMeta())
        expect(run.encounterHistory).toEqual({ hallway: ['JAW_WORM', encounter.id], elite: 'GREMLIN_NOB' })
        expect(run.pendingRoom?.scene).toBe('Rewards')
    })
    it.each([false, true])('clears encounter history at an act transition, including Endless=%s', endless => {
        const run = createNewRun(); run.act = 3
        run.encounterHistory = { hallway: ['THREE_SHAPES', 'THREE_DARKLINGS'], elite: 'NEMESIS' }
        if (endless) run.modifiers = ['ENDLESS']
        advanceAct(run)
        expect(run.act).toBe(endless ? 1 : 4)
        expect(run.encounterHistory).toEqual({ hallway: [] }); expect(run.hallwayCount).toBe(0)
    })
    it('keeps a loaded lineup even when encounter selection would choose a different fight', () => {
        const run = createNewRun({ seed: 'cached' }); run.act = 3; run.hallwayCount = 5
        run.pendingRoom = { scene: 'Combat', roomKind: 'monster', encounter: { id: 'FOUR_SHAPES', enemies: ['SPIKER', 'SPIKER', 'REPULSOR', 'EXPLODER'] } }
        let stored = ''
        vi.stubGlobal('localStorage', { setItem: (_key: string, value: string) => { stored = value }, getItem: () => stored })
        try {
            saveRun(run)
            const loaded = loadRun()!
            expect(createCombatEngine(loaded, 'monster').state.enemies.map(enemy => enemy.specId)).toEqual(['SPIKER', 'SPIKER', 'REPULSOR', 'EXPLODER'])
            expect(loaded.encounterHistory).toEqual({ hallway: [] })
        } finally { vi.unstubAllGlobals() }
    })
})
