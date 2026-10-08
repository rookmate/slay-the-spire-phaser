export interface Settings { sound: boolean; volume: number; reducedMotion: boolean }
const key = 'sts_settings_v1'
export function loadSettings(): Settings {
    const defaults = { sound: true, volume: 0.3, reducedMotion: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }
    try { const saved = JSON.parse(localStorage.getItem(key) ?? '{}'); return { sound: saved.sound ?? defaults.sound, volume: Math.max(0, Math.min(1, Number.isFinite(saved.volume) ? saved.volume : defaults.volume)), reducedMotion: saved.reducedMotion ?? defaults.reducedMotion } } catch { return defaults }
}
export function saveSettings(settings: Settings): void { localStorage.setItem(key, JSON.stringify(settings)) }
