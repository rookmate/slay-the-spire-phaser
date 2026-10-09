import { persistence, SETTINGS_KEY, PersistenceError } from './persistence'
export { SETTINGS_KEY } from './persistence'
export interface Settings { sound: boolean; volume: number; music: boolean; musicVolume: number; effectsVolume: number; reducedMotion: boolean }
let cached: Settings | undefined
let cachedStorage: Storage | undefined
export const SETTINGS_CHANGED = 'spire-settings-changed'
export function invalidateSettings(): void { cached = undefined }
export function loadSettings(): Settings {
    let storage: Storage | undefined
    try { storage = localStorage } catch { return defaultSettings() }
    if (cached && cachedStorage === storage) return { ...cached }
    const settings = readSettings()
    cachedStorage = storage; cached = settings
    return { ...settings }
}
export function defaultSettings(): Settings {
    return { sound: true, volume: 0.3, music: true, musicVolume: 0.45, effectsVolume: 1, reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }
}
function readSettings(): Settings {
    const defaults = defaultSettings()
    try {
        const saved = JSON.parse(persistence().read(SETTINGS_KEY) ?? '{}')
        const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
        const boolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
        return { sound: boolean(saved.sound, defaults.sound), volume: volume(saved.volume, defaults.volume),
            music: boolean(saved.music, defaults.music), musicVolume: volume(saved.musicVolume, defaults.musicVolume), effectsVolume: volume(saved.effectsVolume, defaults.effectsVolume),
            reducedMotion: boolean(saved.reducedMotion, defaults.reducedMotion) }
    } catch (error) { if (error instanceof PersistenceError) throw error; return defaults }
}
export function saveSettings(settings: Settings): void {
    persistence().commit({ [SETTINGS_KEY]: JSON.stringify(settings) })
    invalidateSettings()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_CHANGED))
}
