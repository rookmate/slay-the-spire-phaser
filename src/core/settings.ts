export interface Settings { sound: boolean; volume: number; music: boolean; musicVolume: number; effectsVolume: number; reducedMotion: boolean }
const key = 'sts_settings_v1'
export const SETTINGS_CHANGED = 'spire-settings-changed'
export function loadSettings(): Settings {
    const defaults: Settings = { sound: true, volume: 0.3, music: true, musicVolume: 0.45, effectsVolume: 1, reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }
    try {
        const saved = JSON.parse(localStorage.getItem(key) ?? '{}')
        const volume = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
        const boolean = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback
        return { sound: boolean(saved.sound, defaults.sound), volume: volume(saved.volume, defaults.volume),
            music: boolean(saved.music, defaults.music), musicVolume: volume(saved.musicVolume, defaults.musicVolume), effectsVolume: volume(saved.effectsVolume, defaults.effectsVolume),
            reducedMotion: boolean(saved.reducedMotion, defaults.reducedMotion) }
    } catch { return defaults }
}
export function saveSettings(settings: Settings): void {
    localStorage.setItem(key, JSON.stringify(settings))
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_CHANGED))
}
