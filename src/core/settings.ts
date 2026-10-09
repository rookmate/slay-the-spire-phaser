export interface Settings { sound: boolean; volume: number; music: boolean; musicVolume: number; effectsVolume: number; reducedMotion: boolean }
export const SETTINGS_KEY = 'sts_settings_v1'
let cached: Settings | undefined
let cachedStorage: Storage | undefined
export const SETTINGS_CHANGED = 'spire-settings-changed'
export function invalidateSettings(): void { cached = undefined }
export function loadSettings(): Settings {
    let storage: Storage | undefined
    try { storage = localStorage } catch { return readSettings() }
    if (cached && cachedStorage === storage) return { ...cached }
    const settings = readSettings()
    cachedStorage = storage; cached = settings
    return { ...settings }
}
function readSettings(): Settings {
    const defaults: Settings = { sound: true, volume: 0.3, music: true, musicVolume: 0.45, effectsVolume: 1, reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
        const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
        const boolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
        return { sound: boolean(saved.sound, defaults.sound), volume: volume(saved.volume, defaults.volume),
            music: boolean(saved.music, defaults.music), musicVolume: volume(saved.musicVolume, defaults.musicVolume), effectsVolume: volume(saved.effectsVolume, defaults.effectsVolume),
            reducedMotion: boolean(saved.reducedMotion, defaults.reducedMotion) }
    } catch { return defaults }
}
export function saveSettings(settings: Settings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    invalidateSettings()
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_CHANGED))
}
