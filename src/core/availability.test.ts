import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CARD_DEFS } from './cards'
import { CHARACTER_IDS } from './characters'
import { createDefaultMeta, getCharacterProgress, getEffectiveUnlockedCardIds, getEffectiveUnlockedRelicIds, loadMeta, saveMeta } from './meta'
import { selectCardPool, selectCombatCardPool } from './contentPools'
import { createNewRun } from './run'
import { createProfileRun } from './modes/setup'
import { createCombatEngine } from './combat'
import { exportProfile, importProfile, parseProfile } from './profile/storage'
import { loadSettings } from './settings'
import { recordRunResult } from './runResults'

beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
})
afterEach(() => vi.unstubAllGlobals())

describe('complete character and card availability', () => {
    it('makes every character and card available on a fresh profile while retaining relic progression', () => {
        const meta = createDefaultMeta(), unlocked = getEffectiveUnlockedCardIds(meta)
        for (const character of CHARACTER_IDS) {
            expect(getCharacterProgress(meta, character)).toMatchObject({ unlocked: true, ascension: 0, xp: 0, unlockTier: 0, act3Cleared: false })
            const run = createProfileRun(meta, { character })
            for (const card of Object.values(CARD_DEFS).filter(card => card.color === character)) {
                expect(unlocked.has(card.id), card.id).toBe(true)
                expect(run.unlockedCardIds).toContain(card.id)
            }
        }
        expect(getEffectiveUnlockedRelicIds(meta).has('OMAMORI')).toBe(false)
        expect(meta.totalRuns).toBe(0); expect(meta.achievements).toBeUndefined()
    })
    it('normalizes legacy and explicitly locked profiles without losing earned progress', () => {
        const legacy = { ...createDefaultMeta(), bestAscensionUnlocked: 7, ironcladUnlockTier: 2, totalWins: 3, totalRuns: 12 }
        saveMeta(legacy)
        let loaded = loadMeta()
        expect(getCharacterProgress(loaded, 'ironclad')).toMatchObject({ ascension: 7, unlockTier: 2, act3Cleared: true })
        for (const id of CHARACTER_IDS) Object.assign(getCharacterProgress(loaded, id), { unlocked: false, xp: 120 })
        Object.assign(loaded.characters!.watcher, { ascension: 4, unlockTier: 3, previousRunReachedBoss: true })
        const prior = structuredClone(loaded)
        saveMeta(loaded); loaded = loadMeta()
        for (const id of CHARACTER_IDS) expect(loaded.characters![id]).toEqual({ ...prior.characters![id], unlocked: true })
        expect(loaded.totalWins).toBe(3); expect(loaded.totalRuns).toBe(12)
    })
    it('imports locked profiles and restricted run snapshots without altering the saved room or settings', () => {
        const meta = createDefaultMeta(), run = createNewRun({ character: 'defect' })
        for (const id of CHARACTER_IDS) getCharacterProgress(meta, id).unlocked = false
        Object.assign(meta.characters!.defect, { ascension: 8, unlockTier: 2, xp: 150 })
        run.unlockedCardIds = ['STRIKE_DEFECT', 'ZAP']; run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }
        const settings = { ...loadSettings(), reducedMotion: true, music: false }
        const profile = { format: 'rookmate.spire.profile' as const, version: 1 as const, exportedAt: new Date().toISOString(), meta, run, settings }
        importProfile(profile)
        const restored = parseProfile(exportProfile())
        expect(restored.run).toEqual(run); expect(restored.settings).toEqual(settings)
        expect(restored.meta.characters!.defect).toMatchObject({ unlocked: true, ascension: 8, unlockTier: 2, xp: 150 })
        for (const id of CHARACTER_IDS) expect(restored.meta.characters![id].unlocked).toBe(true)
        expect(selectCombatCardPool(createCombatEngine(restored.run!, 'monster'), { source: 'generated' })).toContain('ECHO_FORM')
    })
    it.each(CHARACTER_IDS)('opens the whole %s card pool in new and old runs while retaining source eligibility', character => {
        const eligible = Object.values(CARD_DEFS).filter(card => card.color === character && card.poolEnabled && card.rarity !== 'basic' && card.type !== 'curse' && card.type !== 'status').map(card => card.id)
        for (const source of ['reward', 'shop', 'transform'] as const) {
            expect(selectCardPool({ character, source, meta: createDefaultMeta(), unlockedIds: [] }).sort()).toEqual(eligible.sort())
        }
        const generated = selectCardPool({ character, source: 'generated', unlockedIds: [] })
        for (const id of ['FEED', 'REAPER', 'SELF_REPAIR', 'LESSON_LEARNED', 'ALCHEMIZE', 'WISH']) expect(generated).not.toContain(id)
        expect(generated.every(id => eligible.includes(id))).toBe(true)
    })
    it('removes obsolete character and card notices and preserves relic and achievement notices', () => {
        const meta = createDefaultMeta()
        meta.notifications = [
            { id: 'character:silent', title: 'Silent unlocked', detail: '' },
            { id: 'bundle:ironclad:1', title: 'Ironclad: new cards and relics', detail: 'Card unlock 1' },
            { id: 'bundle:ironclad:2', title: 'Ironclad: new cards and relics', detail: 'Relic unlock 2' },
            { id: 'achievement:ADRENALINE', title: 'Achievement: Adrenaline', detail: 'Have 9 Energy' },
        ]
        saveMeta(meta)
        const loaded = loadMeta()
        expect(loaded.notifications?.map(notice => notice.id)).toEqual(['bundle:ironclad:2', 'achievement:ADRENALINE'])
        expect(loaded.notifications![0].title).toBe('Ironclad: new relics')
        saveMeta(loaded); expect(loadMeta().notifications).toEqual(loaded.notifications)
    })
    it('does not announce already available characters or cards when XP tiers advance', () => {
        const meta = createDefaultMeta()
        for (let i = 0; i < 2; i++) {
            const run = createNewRun({ seed: `availability-xp-${i}` }); run.neowCompleted = true; run.floor = 51; run.actsCleared = [1, 2, 3]; run.stats = { bosses: 3 }
            recordRunResult(meta, run, 'victory')
        }
        expect(meta.notifications?.filter(notice => notice.id.startsWith('character:'))).toEqual([])
        expect(meta.notifications?.filter(notice => notice.id.startsWith('bundle:'))).toEqual([
            { id: 'bundle:ironclad:2', title: 'Ironclad: new relics', detail: 'Relic unlock 2' },
        ])
    })
})
