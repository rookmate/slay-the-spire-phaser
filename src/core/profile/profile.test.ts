import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createNewRun, saveRun } from '../run'
import { createDefaultMeta, saveMeta } from '../meta'
import { loadSettings } from '../settings'
import { createCardInstance } from '../cards'
import { createCombatEngine } from '../combat'
import { EVENT_DEFS, initializeEvent } from '../events'
import { applyRelicAcquisition, RELIC_DEFS } from '../relics'
import { prepareAcquisition } from '../relics/acquisitions'
import { createProfileRun } from '../modes/setup'
import { MODIFIER_IDS } from '../modes/modifiers'
import { generateShop } from '../shop'
import { generateRewardBundle } from '../rewards'
import { exportProfile, importProfile, parseProfile, backupProfile, recoverProfileImport, PROFILE_KEYS, JOURNAL_KEY, BACKUP_KEY, MAX_PROFILE_BYTES } from './storage'
import type { Profile } from './schema'

class MemoryStorage implements Storage {
    values = new Map<string, string>(); fail?: (key: string, value: string) => boolean
    get length() { return this.values.size }
    clear() { this.values.clear() }
    getItem(key: string) { return this.values.get(key) ?? null }
    key(index: number) { return [...this.values.keys()][index] ?? null }
    removeItem(key: string) { this.values.delete(key) }
    setItem(key: string, value: string) { if (this.fail?.(key, value)) throw new Error('quota'); this.values.set(key, value) }
}
let storage: MemoryStorage
beforeEach(() => { storage = new MemoryStorage(); vi.stubGlobal('localStorage', storage) })
function profile(): Profile { return { format: 'rookmate.spire.profile', version: 1, exportedAt: new Date().toISOString(), meta: createDefaultMeta(), run: createNewRun(), settings: loadSettings() } }
const roundTrip = (value: Profile) => parseProfile(JSON.stringify(value))

describe('profile validation', () => {
    it('round-trips all character starters, event checkpoints, modifiers, acquisitions, shops, and rewards', () => {
        const value = profile()
        for (const character of ['ironclad', 'silent', 'defect', 'watcher'] as const) { value.run = createNewRun({ character }); expect(roundTrip(value).run).toEqual(value.run) }
        for (const id of Object.keys(EVENT_DEFS) as (keyof typeof EVENT_DEFS)[]) {
            value.run = createNewRun(); initializeEvent(value.run, value.meta, id)
            expect(roundTrip(value).run, id).toEqual(value.run)
        }
        for (const modifier of MODIFIER_IDS) {
            value.run = createProfileRun(value.meta, { mode: 'custom', modifiers: [modifier] })
            expect(roundTrip(value).run, modifier).toEqual(value.run)
        }
        for (const relic of Object.keys(RELIC_DEFS) as (keyof typeof RELIC_DEFS)[]) {
            value.run = createNewRun(); applyRelicAcquisition(value.run, relic); prepareAcquisition(value.run, value.meta)
            expect(roundTrip(value).run, relic).toEqual(value.run)
        }
        value.run = createNewRun(); value.run.pendingRoom = { scene: 'Shop', inventory: generateShop(value.run, value.meta) }; expect(roundTrip(value).run).toEqual(value.run)
        value.run.pendingRoom = { scene: 'Rewards', rewards: generateRewardBundle('profile', 'boss', value.run, value.meta) }; expect(roundTrip(value).run).toEqual(value.run)
    })
    it('rejects invalid nested content, duplicate cards, invalid settings, future formats, and unsafe keys without writes', () => {
        const valid = profile(); importProfile(valid); const before = new Map(storage.values)
        const mutations = [
            (p: Profile) => { p.run!.deck[0].defId = 'NOT_A_CARD' },
            (p: Profile) => { p.run!.deck.push({ ...p.run!.deck[0] }) },
            (p: Profile) => { p.run!.pendingRoom = { scene: 'Rewards', rewards: { tier: 'hallway', items: [], claimed: [0] } } },
            (p: Profile) => { p.run!.eventCombat = { enemies: ['INVALID' as never], rewards: { tier: 'hallway', items: [] } } },
            (p: Profile) => { p.meta.characters!.silent.xp = -1 },
            (p: Profile) => { p.settings.volume = 2 },
            (p: Profile) => { p.version = 2 as never },
            (p: Profile) => { p.run!.player.hp = Infinity },
        ]
        for (const mutate of mutations) {
            const changed = roundTrip(valid); mutate(changed)
            expect(() => importProfile(changed)).toThrow(); expect(storage.values).toEqual(before)
        }
        expect(() => parseProfile('{"__proto__":{}}')).toThrow('unsupported key')
        expect(() => parseProfile('x'.repeat(MAX_PROFILE_BYTES + 1))).toThrow('2 MB')
    })
    it('migrates older run and meta defaults and three-field audio settings', () => {
        const value = JSON.parse(JSON.stringify(profile()))
        delete value.run.character; delete value.run.mode; delete value.run.keys; delete value.run.mapRows; delete value.meta.version
        delete value.settings.music; delete value.settings.musicVolume; delete value.settings.effectsVolume
        const migrated = parseProfile(JSON.stringify(value))
        expect(migrated.run!.character).toBe('ironclad'); expect(migrated.run!.mapRows).toBe(15)
        expect(migrated.meta.characters!.ironclad.unlocked).toBe(true); expect(migrated.settings.musicVolume).toBe(0.45)
    })
    it('exports the saved combat entry while live combat mutates relic counters and the deck', () => {
        const run = createNewRun(); run.neowCompleted = true; run.relics.push('NEOWS_LAMENT'); run.relicState!.NEOWS_LAMENT = { charges: 3 }
        run.pendingRoom = { scene: 'Combat', roomKind: 'monster' }; saveRun(run); saveMeta(createDefaultMeta())
        const engine = createCombatEngine(run, 'monster'); expect(engine.run!.relicState!.NEOWS_LAMENT!.charges).toBe(2)
        run.deck.push(createCardInstance('BURN'))
        const exported = parseProfile(exportProfile())
        expect(exported.run!.relicState!.NEOWS_LAMENT!.charges).toBe(3); expect(exported.run!.deck.some(card => card.defId === 'BURN')).toBe(false)
    })
})
describe('profile replacement', () => {
    it('preserves a restorable backup and removes a stale run when the imported profile has none', () => {
        const original = profile(); importProfile(original)
        const next = profile(); next.run = undefined; next.meta.totalRuns = 12; importProfile(next)
        expect(storage.getItem('sts_run_v7')).toBeNull(); expect(backupProfile().run!.runId).toBe(original.run!.runId)
        importProfile(backupProfile()); expect(parseProfile(exportProfile()).run!.runId).toBe(original.run!.runId)
    })
    it('rolls back partial replacement on a write failure', () => {
        const original = profile(); importProfile(original)
        const old = PROFILE_KEYS.map(key => storage.getItem(key)), next = profile(); next.meta.totalRuns = 2
        let failed = false
        storage.fail = key => key === 'sts_run_v7' && !failed && (failed = true)
        expect(() => importProfile(next)).toThrow('previous profile was restored')
        expect(PROFILE_KEYS.map(key => storage.getItem(key))).toEqual(old); expect(storage.getItem(JOURNAL_KEY)).toBeNull()
    })
    it('keeps a recovery journal if rollback fails, then restores all keys on restart', () => {
        const original = profile(); importProfile(original)
        const old = PROFILE_KEYS.map(key => storage.getItem(key))
        storage.fail = key => key === 'sts_run_v7'
        expect(() => importProfile(profile())).toThrow('recovery journal')
        expect(storage.getItem(JOURNAL_KEY)).not.toBeNull()
        storage.fail = undefined; recoverProfileImport()
        expect(PROFILE_KEYS.map(key => storage.getItem(key))).toEqual(old); expect(storage.getItem(JOURNAL_KEY)).toBeNull()
        expect(storage.getItem(BACKUP_KEY)).not.toBeNull()
    })
    it('does not replay notification queues from an imported file', () => {
        const value = profile(); value.meta.notifications = [{ id: 'achievement:ADRENALINE', title: 'Old notice', detail: 'Already seen' }]
        importProfile(value); expect(parseProfile(exportProfile()).meta.notifications).toEqual([])
    })
    it('never touches profile values when backup or journal storage fails', () => {
        importProfile(profile()); const old = PROFILE_KEYS.map(key => storage.getItem(key))
        for (const blocked of [BACKUP_KEY, JOURNAL_KEY]) {
            storage.fail = key => key === blocked
            expect(() => importProfile(profile())).toThrow()
            expect(PROFILE_KEYS.map(key => storage.getItem(key))).toEqual(old)
        }
    })
})
