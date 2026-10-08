import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ENEMIES } from '../core/enemies'
import { ENEMY_ART } from './art/enemies'
import { notesAt, trackForScene } from './music'
import { SoundDirector } from './sound'
import { loadSettings, saveSettings } from '../core/settings'

class Gain {
    gain = { setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
    connect = vi.fn()
    disconnect = vi.fn()
}
class Voice {
    type = 'sine'; frequency = { value: 0 }; onended?: () => void
    connect = vi.fn(); disconnect = vi.fn(); start = vi.fn((_time: number) => {})
    stop = vi.fn((time?: number) => { if (time === undefined) this.onended?.() })
}
class Context {
    static instances: Context[] = []
    currentTime = 0; state = 'running'; destination = {}
    gains: Gain[] = []; voices: Voice[] = []
    constructor() { Context.instances.push(this) }
    createGain() { const gain = new Gain(); this.gains.push(gain); return gain }
    createOscillator() { const voice = new Voice(); this.voices.push(voice); return voice }
    resume = vi.fn(async () => { this.state = 'running' })
    suspend = vi.fn(async () => { this.state = 'suspended' })
    close = vi.fn(async () => { this.state = 'closed' })
}
let sound: SoundDirector
beforeEach(() => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) })
    vi.stubGlobal('AudioContext', Context); vi.stubGlobal('document', { hidden: false }); vi.stubGlobal('window', new EventTarget())
    Context.instances = []; vi.useFakeTimers(); sound = new SoundDirector()
})
afterEach(() => { sound.destroy(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('presentation assets', () => {
    it('provides art for every enemy, with separate boss portraits', () => {
        expect(Object.keys(ENEMY_ART).sort()).toEqual(Object.keys(ENEMIES).sort())
        const bosses = Object.entries(ENEMIES).filter(([, spec]) => spec.tags?.includes('boss')).map(([id]) => ENEMY_ART[id as keyof typeof ENEMY_ART])
        expect(new Set(bosses).size).toBe(bosses.length)
    })
    it('composes stable phrases and changes instrumentation for combat', () => {
        const ambient = trackForScene('Map', 3), combat = trackForScene('Combat', 3)
        expect(notesAt(ambient, 0)).toEqual(notesAt(ambient, 64))
        expect(notesAt(combat, 0).length).toBeGreaterThan(notesAt(ambient, 0).length)
        expect(trackForScene('Combat', 4, true)).toEqual({ theme: 'ending', combat: true, boss: true })
    })
})
describe('sound lifecycle', () => {
    it('waits for a gesture and reuses one context and scheduler', () => {
        vi.advanceTimersByTime(500); expect(Context.instances).toHaveLength(0)
        sound.unlock(); sound.unlock(); sound.cue('card')
        expect(Context.instances).toHaveLength(1); expect(vi.getTimerCount()).toBe(1)
        vi.advanceTimersByTime(100); expect(Context.instances[0].voices.length).toBeGreaterThan(2)
        sound.destroy(); expect(vi.getTimerCount()).toBe(0); expect(Context.instances[0].close).toHaveBeenCalled()
        sound.unlock(); expect(Context.instances).toHaveLength(1)
    })
    it('applies independent music, effects, and master levels immediately', () => {
        sound.unlock(); const context = Context.instances[0]
        saveSettings({ ...loadSettings(), volume: 0.7, musicVolume: 0.2, effectsVolume: 0.4 }); sound.applySettings()
        expect(context.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.7, 0, 0.02)
        expect(context.gains[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.2, 0, 0.02)
        expect(context.gains[2].gain.setTargetAtTime).toHaveBeenLastCalledWith(0.4, 0, 0.02)
        saveSettings({ ...loadSettings(), sound: false }); sound.applySettings()
        vi.advanceTimersByTime(200); sound.cue('damage')
        expect(context.voices).toHaveLength(0)
        expect(context.gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 0, 0.02)
    })
    it('suspends in a hidden tab and resumes without scheduling a backlog', async () => {
        sound.unlock(); const context = Context.instances[0]
        Object.assign(document, { hidden: true }); sound.visibility(); await Promise.resolve()
        vi.advanceTimersByTime(1000); expect(context.voices).toHaveLength(0); expect(context.state).toBe('suspended')
        context.currentTime = 100; Object.assign(document, { hidden: false }); sound.visibility(); await Promise.resolve()
        vi.advanceTimersByTime(100)
        expect(context.state).toBe('running'); expect(context.voices.length).toBeLessThan(8)
        context.voices.forEach(voice => expect(voice.start.mock.calls[0][0]).toBeGreaterThanOrEqual(100))
    })
    it('stops active music when tracks change or music is muted, and stops effects on destroy', () => {
        sound.unlock(); vi.advanceTimersByTime(100)
        const context = Context.instances[0], opening = [...context.voices]
        expect(opening.length).toBeGreaterThan(0)
        sound.setTrack(trackForScene('Combat', 2)); opening.forEach(voice => expect(voice.stop).toHaveBeenLastCalledWith())
        context.currentTime = 1; vi.advanceTimersByTime(100)
        const combat = context.voices.slice(opening.length)
        saveSettings({ ...loadSettings(), music: false }); sound.applySettings()
        combat.forEach(voice => expect(voice.stop).toHaveBeenLastCalledWith())
        sound.cue('damage'); const effects = context.voices.slice(opening.length + combat.length)
        expect(effects).toHaveLength(2); sound.destroy()
        effects.forEach(voice => expect(voice.stop).toHaveBeenLastCalledWith())
    })
    it('migrates old settings and rejects invalid persisted values', () => {
        localStorage.setItem('sts_settings_v1', JSON.stringify({ sound: 'no', volume: 4, reducedMotion: true }))
        expect(loadSettings()).toEqual({ sound: true, volume: 1, reducedMotion: true, music: true, musicVolume: 0.45, effectsVolume: 1 })
    })
})
