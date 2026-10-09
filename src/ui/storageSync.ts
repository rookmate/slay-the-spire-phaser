import type Phaser from 'phaser'
import { META_KEY } from '../core/meta'
import { JOURNAL_KEY } from '../core/profile/storage'
import { invalidateSettings, SETTINGS_CHANGED, SETTINGS_KEY } from '../core/settings'
import { emitStorageChange, META_CHANGED, PROFILE_REPLACED } from '../core/storageEvents'

/** Publish settled foreign writes; an import journal hides partial replacements. */
export function attachStorageSync(game: Phaser.Game): void {
    const changed = (event: StorageEvent) => {
        if (event.storageArea && event.storageArea !== localStorage) return
        const all = event.key === null || event.key === JOURNAL_KEY
        if (all || event.key === 'sts_run_v7') emitStorageChange(PROFILE_REPLACED)
        if (localStorage.getItem(JOURNAL_KEY)) { emitStorageChange(META_CHANGED); return }
        if (all || event.key === SETTINGS_KEY) { invalidateSettings(); emitStorageChange(SETTINGS_CHANGED) }
        if (all || event.key === META_KEY) emitStorageChange(META_CHANGED)
    }
    const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined
    const motionChanged = () => {
        if (localStorage.getItem(JOURNAL_KEY)) return
        invalidateSettings(); emitStorageChange(SETTINGS_CHANGED)
    }
    motion?.addEventListener('change', motionChanged)
    window.addEventListener('storage', changed)
    game.events.once('destroy', () => {
        window.removeEventListener('storage', changed)
        motion?.removeEventListener('change', motionChanged)
    })
}
