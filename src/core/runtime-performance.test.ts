/// <reference types="node" />
import { EventEmitter } from 'node:events'
import type Phaser from 'phaser'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { loadSettings, saveSettings, SETTINGS_CHANGED, SETTINGS_KEY } from './settings'
import { createDefaultMeta, loadMeta, saveMeta } from './meta'
import { createNewRun, loadRun, saveRun } from './run'
import { attachRunClock, checkpointRunClock } from './runClock'
import { persistence } from './persistence'
import { importProfile, JOURNAL_KEY, recoverProfileImport } from './profile/storage'
import type { Profile } from './profile/schema'
import { attachStorageSync } from '../ui/storageSync'

class MemoryStorage implements Storage {
    values = new Map<string, string>()
    get length() { return this.values.size }
    getItem = vi.fn((key: string) => this.values.get(key) ?? null)
    setItem = vi.fn((key: string, value: string) => { this.values.set(key, value) })
    removeItem(key: string) { this.values.delete(key) }
    clear() { this.values.clear() }
    key(index: number) { return [...this.values.keys()][index] ?? null }
}
let storage: MemoryStorage
let events: EventEmitter
let scenes: { scene: { key: string }; run?: ReturnType<typeof createNewRun> }[]
let hidden: boolean
let motion: EventTarget & { matches: boolean }
let game: Phaser.Game
beforeEach(() => {
    storage = new MemoryStorage(); vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', new EventTarget()); vi.stubGlobal('document', new EventTarget())
    motion = Object.assign(new EventTarget(), { matches: false }); vi.stubGlobal('matchMedia', () => motion)
    hidden = false; Object.defineProperty(document, 'hidden', { get: () => hidden })
    events = new EventEmitter(); scenes = []
    game = { events, scene: { getScenes: () => scenes } } as unknown as Phaser.Game
    attachStorageSync(game)
})
afterEach(() => { events.emit('destroy'); vi.unstubAllGlobals() })
const foreign = (key: string | null) => window.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: storage }))

it('reads settings once, returns independent copies, and publishes only successful saves', () => {
    const original = loadSettings(), changes = vi.fn()
    window.addEventListener(SETTINGS_CHANGED, changes)
    original.volume = 0
    for (let i = 0; i < 100; i++) expect(loadSettings().volume).toBe(0.3)
    expect(storage.getItem).toHaveBeenCalledTimes(1)
    saveSettings({ ...original, volume: 0.8 }); expect(loadSettings().volume).toBe(0.8)
    storage.setItem.mockImplementationOnce(() => { throw new Error('quota') })
    expect(() => saveSettings({ ...original, volume: 0.1 })).toThrow('quota')
    expect(loadSettings().volume).toBe(0.8); expect(changes).toHaveBeenCalledTimes(1)
    persistence().retry()
    saveMeta(createDefaultMeta()); const meta = loadMeta(); meta.totalWins = 99
    expect(loadMeta().totalWins).toBe(0)
})
it('refreshes settings after foreign writes and clear, withholding partial imports', () => {
    expect(loadSettings().volume).toBe(0.3)
    storage.setItem(SETTINGS_KEY, JSON.stringify({ volume: 0.7 })); foreign(SETTINGS_KEY)
    expect(loadSettings().volume).toBe(0.7)
    storage.setItem(JOURNAL_KEY, '{}'); storage.setItem(SETTINGS_KEY, JSON.stringify({ volume: 0.2 })); foreign(SETTINGS_KEY)
    expect(loadSettings().volume).toBe(0.7)
    storage.removeItem(JOURNAL_KEY); foreign(JOURNAL_KEY); expect(loadSettings().volume).toBe(0.2)
    storage.clear(); foreign(null); expect(loadSettings().volume).toBe(0.3)
})
it('refreshes cached settings after import and recovery, including settled rollback', () => {
    const profile: Profile = { format: 'rookmate.spire.profile', version: 1, exportedAt: new Date().toISOString(), meta: createDefaultMeta(), settings: { ...loadSettings(), volume: 0.6 } }
    importProfile(profile); expect(loadSettings().volume).toBe(0.6)
    const original = storage.setItem.getMockImplementation()!
    let failed = false
    storage.setItem.mockImplementation((key, value) => {
        if (key === SETTINGS_KEY && !failed) { failed = true; throw new Error('quota') }
        original(key, value)
    })
    expect(() => importProfile({ ...profile, settings: { ...profile.settings, volume: 0.9 } })).toThrow('previous profile was restored')
    expect(loadSettings().volume).toBe(0.6)
    storage.setItem.mockImplementation(original)
    storage.setItem(JOURNAL_KEY, JSON.stringify({ sts_meta_v2: null, sts_run_v7: null, sts_settings_v1: JSON.stringify({ volume: 0.4 }) }))
    recoverProfileImport(); expect(loadSettings().volume).toBe(0.4)
})
it('checkpoints every five seconds and flushes hidden/pagehide without replacing room-entry inventory', () => {
    const run = createNewRun(); run.potions = ['BLOCK_POTION']; saveRun(run)
    scenes = [{ scene: { key: 'Combat' }, run }]; attachRunClock(game)
    run.potions = []; storage.getItem.mockClear(); storage.setItem.mockClear()
    for (let i = 0; i < 49; i++) events.emit('poststep', i * 100, 100)
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).not.toHaveBeenCalled()
    events.emit('poststep', 5000, 100)
    expect(storage.setItem).toHaveBeenCalledTimes(1); expect(loadRun()!.potions).toEqual(['BLOCK_POTION'])
    events.emit('poststep', 5100, 100); hidden = true; document.dispatchEvent(new Event('visibilitychange'))
    expect(loadRun()!.elapsedSeconds).toBeCloseTo(5.1)
    events.emit('poststep', 5200, 100); expect(run.elapsedSeconds).toBeCloseTo(5.1)
    hidden = false; events.emit('poststep', 5300, 100); window.dispatchEvent(new Event('pagehide'))
    expect(loadRun()!.elapsedSeconds).toBeCloseTo(5.2)
    expect(events.listenerCount('poststep')).toBe(1); events.emit('destroy'); expect(events.listenerCount('poststep')).toBe(0)
})
it('blocks clock writes during recovery and after a same-ID foreign replacement', () => {
    const run = createNewRun(); saveRun(run); scenes = [{ scene: { key: 'Combat' }, run }]; attachRunClock(game)
    events.emit('poststep', 100, 100)
    storage.setItem(JOURNAL_KEY, '{}'); expect(checkpointRunClock(run)).toBe(false)
    storage.removeItem(JOURNAL_KEY)
    const replacement = { ...run, elapsedSeconds: 123, gold: 999 }; saveRun(replacement); foreign('sts_run_v7')
    for (let i = 0; i < 100; i++) events.emit('poststep', i * 100, 100)
    expect(checkpointRunClock(run)).toBe(false)
    expect(run.elapsedSeconds).toBeCloseTo(10.1)
    window.dispatchEvent(new Event('pagehide')); expect(loadRun()!.elapsedSeconds).toBe(123); expect(loadRun()!.gold).toBe(999)
})

it('follows OS reduced motion changes until an explicit preference is saved', () => {
    expect(loadSettings().reducedMotion).toBe(false)
    motion.matches = true; motion.dispatchEvent(new Event('change'))
    expect(loadSettings().reducedMotion).toBe(true)
    saveSettings({ ...loadSettings(), reducedMotion: false })
    motion.matches = false; motion.dispatchEvent(new Event('change'))
    motion.matches = true; motion.dispatchEvent(new Event('change'))
    expect(loadSettings().reducedMotion).toBe(false)
})
it('stops clock writes and elapsed time after a save failure until the checkpoint is retried', () => {
    const run = createNewRun(); saveRun(run); scenes = [{ scene: { key: 'Combat' }, run }]; attachRunClock(game)
    storage.setItem.mockClear(); storage.setItem.mockImplementation(() => { throw new Error('quota') })
    for (let i = 0; i < 360; i++) events.emit('poststep', i * 1000 / 60, 1000 / 60)
    expect(storage.setItem).toHaveBeenCalledTimes(1)
    const stopped = run.elapsedSeconds
    window.dispatchEvent(new Event('pagehide'))
    for (let i = 0; i < 240; i++) events.emit('poststep', i * 1000 / 60, 1000 / 60)
    expect(storage.setItem).toHaveBeenCalledTimes(1); expect(run.elapsedSeconds).toBe(stopped)
    storage.setItem.mockImplementation((key, value) => { storage.values.set(key, value) })
    persistence().retry(); expect(loadRun()!.elapsedSeconds).toBeCloseTo(stopped!)
})

it('withholds partial import settings when the OS motion preference changes', () => {
    expect(loadSettings().volume).toBe(0.3)
    storage.setItem(JOURNAL_KEY, '{}')
    storage.setItem(SETTINGS_KEY, JSON.stringify({ volume: 0.8 }))
    motion.matches = true; motion.dispatchEvent(new Event('change'))
    expect(loadSettings().volume).toBe(0.3); expect(loadSettings().reducedMotion).toBe(false)
    storage.removeItem(JOURNAL_KEY); foreign(JOURNAL_KEY)
    expect(loadSettings().volume).toBe(0.8); expect(loadSettings().reducedMotion).toBe(true)
})
