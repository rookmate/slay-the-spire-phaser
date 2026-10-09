import { emitStorageChange, META_CHANGED, PROFILE_REPLACED } from '../storageEvents'
import { migrateEncounterState } from '../encounterState'
import { persistence, readSnapshot, parseSnapshot, BACKUP_KEY, type Snapshot } from '../persistence'
export { PROFILE_KEYS, BACKUP_KEY, JOURNAL_KEY } from '../persistence'
import { createDefaultMeta, getCharacterProgress } from '../meta'
import { CHARACTER_IDS } from '../characters'
import { invalidateSettings, defaultSettings, SETTINGS_CHANGED } from '../settings'
import { profileSchema, type Profile } from './schema'

export const MAX_PROFILE_BYTES = 2 * 1024 * 1024

function checkJsonTree(value: unknown, depth = 0): void {
    if (depth > 30) throw new Error('Profile nesting is too deep.')
    if (!value || typeof value !== 'object') return
    for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Profile contains an unsupported key.')
        checkJsonTree(item, depth + 1)
    }
}
export function parseProfile(json: string): Profile {
    if (new TextEncoder().encode(json).length > MAX_PROFILE_BYTES) throw new Error('Profile exceeds the 2 MB limit.')
    let value: unknown
    try { value = JSON.parse(json) } catch { throw new Error('The file is not valid JSON.') }
    checkJsonTree(value)
    const parsed = profileSchema.safeParse(value)
    if (!parsed.success) {
        const issue = parsed.error.issues[0]
        throw new Error(`Invalid profile at ${issue.path.join('.') || 'file'}: ${issue.message}`)
    }
    const profile = parsed.data
    if (profile.run) migrateEncounterState(profile.run)
    for (const character of CHARACTER_IDS) getCharacterProgress(profile.meta, character)
    profile.meta.version = 3
    return profile
}
function fromSnapshot(saved: Snapshot): Profile {
    return parseProfile(JSON.stringify({ format: 'rookmate.spire.profile', version: 1, exportedAt: new Date().toISOString(),
        meta: saved.sts_meta_v2 ? JSON.parse(saved.sts_meta_v2) : createDefaultMeta(),
        run: saved.sts_run_v7 ? JSON.parse(saved.sts_run_v7) : undefined,
        settings: saved.sts_settings_v1 ? JSON.parse(saved.sts_settings_v1) : defaultSettings() }))
}
export function exportSnapshot(raw: string): string { return JSON.stringify(fromSnapshot(parseSnapshot(raw)), null, 2) }
/** Exports persisted room entry, never the mutable inventory of an active fight. */
export function exportProfile(storage: Storage = localStorage): string {
    const json = JSON.stringify(fromSnapshot(readSnapshot(storage)), null, 2)
    parseProfile(json)
    return json
}
export function backupProfile(storage: Storage = localStorage): Profile {
    const raw = storage.getItem(BACKUP_KEY)
    if (!raw) throw new Error('There is no previous profile backup.')
    return fromSnapshot(parseSnapshot(raw))
}
function publishReplacement(): void {
    invalidateSettings()
    emitStorageChange(PROFILE_REPLACED)
    emitStorageChange(SETTINGS_CHANGED)
    emitStorageChange(META_CHANGED)
}
export function recoverProfileImport(storage: Storage = localStorage): void {
    persistence(storage).recover()
    publishReplacement()
}
export function importProfile(profile: Profile, storage: Storage = localStorage): void {
    const validated = parseProfile(JSON.stringify(profile))
    validated.meta.notifications = []
    persistence(storage).commit({
        sts_meta_v2: JSON.stringify(validated.meta),
        sts_run_v7: validated.run ? JSON.stringify(validated.run) : null,
        sts_settings_v1: JSON.stringify(validated.settings),
    }, true)
    publishReplacement()
}
