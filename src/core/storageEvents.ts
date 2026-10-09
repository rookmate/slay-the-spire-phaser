/** Same-tab notifications. Browser storage events cover changes from other tabs. */
export const META_CHANGED = 'spire-meta-changed'
export const PROFILE_REPLACED = 'spire-profile-replaced'
export function emitStorageChange(name: string): void {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(name))
}
