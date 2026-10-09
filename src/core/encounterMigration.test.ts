import { afterEach, expect, it, vi } from 'vitest'
import { getEncounterActSeed } from './acts'
import { createCombatEngine } from './combat'
import { generateLegacyEncounter } from './legacyEncounters'
import { createDefaultMeta } from './meta'
import { parseProfile } from './profile/storage'
import { loadSettings } from './settings'
import { RNG } from './rng'
import { createNewRun, loadRun, type RunState } from './run'

afterEach(() => vi.unstubAllGlobals())
function importRun(run: RunState): RunState {
    return parseProfile(JSON.stringify({ format: 'rookmate.spire.profile', version: 1, exportedAt: '2026-10-09T00:00:00.000Z',
        run, meta: createDefaultMeta(), settings: loadSettings() })).run!
}
function restoreRun(run: RunState): RunState {
    vi.stubGlobal('localStorage', { getItem: (key: string) => key === 'sts_run_v7' ? JSON.stringify(run) : null })
    return loadRun()!
}

it('preserves the pre-audit encounter sequence for migration across all acts and ordinary tiers', async () => {
    const corpus = []
    for (const act of [1, 2, 3, 4] as const) for (const tier of ['hallway', 'elite'] as const) for (let i = 0; i < 200; i++) {
        const seed = getEncounterActSeed(`legacy-${i}`, act, tier, i)
        corpus.push(generateLegacyEncounter(new RNG(seed), act, tier, i).enemies)
    }
    // Captured from the selector at e5936b0 before this audit, not from the replacement.
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(corpus)))
    const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
    expect(hash).toBe('bef372895184ca8db410994e55ac1efcdd3e37ac92aab7990a6063f1098ebf06')
})
it.each([
    [1, ['LOOTER']], [2, ['SHELLED_PARASITE', 'FUNGI_BEAST']], [3, ['MAW']],
] as const)('migrates Act %i combat on load and profile import without rerolling', (act, enemies) => {
    const old = createNewRun({ seed: 'legacy-7' }); old.act = act; old.combatCount = 7
    delete old.hallwayCount; delete old.encounterHistory
    old.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
    for (const run of [restoreRun(old), importRun(old)]) {
        expect(run.hallwayCount).toBe(7)
        expect(run.encounterHistory).toEqual({ hallway: [] })
        expect(run.pendingRoom).toMatchObject({ encounter: { enemies } })
        expect(createCombatEngine(run, 'monster').state.enemies.map(enemy => enemy.specId)).toEqual(enemies)
        expect(importRun(run)).toEqual(run)
        expect(restoreRun(run)).toEqual(run)
    }
})
it('leaves event and boss checkpoints on their explicit encounter paths', () => {
    const run = createNewRun({ seed: 'legacy-event' }); delete run.encounterHistory
    run.pendingRoom = { scene: 'Combat', roomKind: 'elite' }
    run.eventCombat = { enemies: ['LAGAVULIN'], awakeLagavulin: true, rewards: { tier: 'elite', items: [] } }
    let restored = importRun(run)
    expect(restored.pendingRoom).toEqual(run.pendingRoom)
    expect(createCombatEngine(restored, 'elite').state.enemies[0].specId).toBe('LAGAVULIN')
    delete run.eventCombat; run.pendingRoom = { scene: 'Combat', roomKind: 'boss' }
    restored = importRun(run)
    expect(restored.pendingRoom).toEqual(run.pendingRoom)
    expect(createCombatEngine(restored, 'boss').state.enemies).toEqual(createCombatEngine(run, 'boss').state.enemies)
})
it('rejects invalid encounter IDs, tiers, acts, histories and enemy arrays in imported profiles', () => {
    const valid = createNewRun()
    valid.pendingRoom = { scene: 'Combat', roomKind: 'elite', encounter: { id: 'THREE_SENTRIES', enemies: ['SENTRY', 'SENTRY', 'SENTRY'] } }
    expect(importRun(valid)).toEqual(valid)
    const mutations: ((run: RunState) => void)[] = [
        run => { run.encounterHistory = { hallway: ['UNKNOWN' as never] } },
        run => { run.encounterHistory = { hallway: ['CULTIST', 'JAW_WORM', 'TWO_LOUSE'] } },
        run => { run.encounterHistory = { hallway: ['NEMESIS'] } },
        run => { run.encounterHistory = { hallway: ['ORB_WALKER'] } },
        run => { run.encounterHistory = { hallway: [], elite: 'CULTIST' } },
        run => { if (run.pendingRoom?.scene === 'Combat') run.pendingRoom.encounter!.id = 'CULTIST' },
        run => { if (run.pendingRoom?.scene === 'Combat') run.pendingRoom.encounter!.id = 'NEMESIS' },
        run => { if (run.pendingRoom?.scene === 'Combat') run.pendingRoom.encounter!.enemies = [] },
        run => { if (run.pendingRoom?.scene === 'Combat') run.pendingRoom.encounter!.enemies = ['UNKNOWN' as never] },
    ]
    for (const mutate of mutations) { const run = structuredClone(valid); mutate(run); expect(() => importRun(run)).toThrow('Invalid profile') }
})
