import { z } from 'zod'
import { createDefaultMeta, getCharacterProgress } from '../meta'
import { CHARACTER_IDS } from '../characters'
import { loadSettings, SETTINGS_CHANGED } from '../settings'
import { profileSchema, type Profile } from './schema'

export const PROFILE_KEYS = ['sts_meta_v2', 'sts_run_v7', 'sts_settings_v1'] as const
export const BACKUP_KEY = 'sts_profile_backup_v1', JOURNAL_KEY = 'sts_profile_import_v1'
export const MAX_PROFILE_BYTES = 2 * 1024 * 1024
const snapshotSchema = z.strictObject({ sts_meta_v2: z.string().nullable(), sts_run_v7: z.string().nullable(), sts_settings_v1: z.string().nullable() })
type Snapshot = z.infer<typeof snapshotSchema>

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
    for (const character of CHARACTER_IDS) getCharacterProgress(profile.meta, character)
    profile.meta.version = 3
    return profile
}
function snapshot(storage: Storage): Snapshot {
    return Object.fromEntries(PROFILE_KEYS.map(key => [key, storage.getItem(key)])) as Snapshot
}
function fromSnapshot(saved: Snapshot): Profile {
    return parseProfile(JSON.stringify({ format: 'rookmate.spire.profile', version: 1, exportedAt: new Date().toISOString(),
        meta: saved.sts_meta_v2 ? JSON.parse(saved.sts_meta_v2) : createDefaultMeta(),
        run: saved.sts_run_v7 ? JSON.parse(saved.sts_run_v7) : undefined,
        settings: saved.sts_settings_v1 ? JSON.parse(saved.sts_settings_v1) : loadSettings() }))
}
/** Exports persisted room entry, never the mutable inventory of an active fight. */
export function exportProfile(storage: Storage = localStorage): string {
    recoverProfileImport(storage)
    const json = JSON.stringify(fromSnapshot(snapshot(storage)), null, 2)
    parseProfile(json)
    return json
}
export function backupProfile(storage: Storage = localStorage): Profile {
    const raw = storage.getItem(BACKUP_KEY)
    if (!raw) throw new Error('There is no previous profile backup.')
    return fromSnapshot(snapshotSchema.parse(JSON.parse(raw)))
}
function restore(storage: Storage, saved: Snapshot): void {
    // Remove partial replacements first to make space for the original values.
    for (const key of PROFILE_KEYS) storage.removeItem(key)
    for (const key of PROFILE_KEYS) if (saved[key] !== null) storage.setItem(key, saved[key])
}
export function recoverProfileImport(storage: Storage = localStorage): void {
    const raw = storage.getItem(JOURNAL_KEY)
    if (!raw) return
    const saved = snapshotSchema.parse(JSON.parse(raw))
    restore(storage, saved)
    storage.removeItem(JOURNAL_KEY)
}
export function importProfile(profile: Profile, storage: Storage = localStorage): void {
    const validated = parseProfile(JSON.stringify(profile))
    validated.meta.notifications = []
    recoverProfileImport(storage)
    const previous = snapshot(storage), journal = JSON.stringify(previous)
    // Both writes must succeed before touching any profile key.
    try { storage.setItem(BACKUP_KEY, journal); storage.setItem(JOURNAL_KEY, journal) }
    catch { throw new Error('Could not create the import backup. Your current profile is unchanged. Check available browser storage.') }
    try {
        storage.setItem(PROFILE_KEYS[0], JSON.stringify(validated.meta))
        if (validated.run) storage.setItem(PROFILE_KEYS[1], JSON.stringify(validated.run))
        else storage.removeItem(PROFILE_KEYS[1])
        storage.setItem(PROFILE_KEYS[2], JSON.stringify(validated.settings))
        storage.removeItem(JOURNAL_KEY)
    } catch {
        try { restore(storage, previous); storage.removeItem(JOURNAL_KEY) }
        catch { throw new Error('Import failed. The original profile is in the recovery journal; reload to retry recovery.') }
        throw new Error('Import failed. Your previous profile was restored. Check available browser storage.')
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(SETTINGS_CHANGED))
}
