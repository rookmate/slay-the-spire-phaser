import { z } from 'zod'

export const META_KEY = 'sts_meta_v2', RUN_KEY = 'sts_run_v7', SETTINGS_KEY = 'sts_settings_v1'
export const PROFILE_KEYS = [META_KEY, RUN_KEY, SETTINGS_KEY] as const
export const BACKUP_KEY = 'sts_profile_backup_v1', JOURNAL_KEY = 'sts_profile_import_v1'
const snapshotSchema = z.strictObject({ sts_meta_v2: z.string().nullable(), sts_run_v7: z.string().nullable(), sts_settings_v1: z.string().nullable() })
export type Snapshot = z.infer<typeof snapshotSchema>
export type ProfilePatch = Partial<Snapshot>
export type PersistenceFailure = 'unavailable' | 'busy' | 'stale' | 'write-failed' | 'recovery-required'

export class PersistenceError extends Error {
    readonly kind: PersistenceFailure
    constructor(kind: PersistenceFailure, message: string, cause?: unknown) {
        super(message, { cause }); this.name = 'PersistenceError'; this.kind = kind
    }
}
export function readSnapshot(storage: Storage): Snapshot {
    return Object.fromEntries(PROFILE_KEYS.map(key => [key, storage.getItem(key)])) as Snapshot
}
export function parseSnapshot(raw: string): Snapshot { return snapshotSchema.parse(JSON.parse(raw)) }
function restore(storage: Storage, saved: Snapshot): void {
    for (const key of PROFILE_KEYS) storage.removeItem(key)
    for (const key of PROFILE_KEYS) if (saved[key] !== null) storage.setItem(key, saved[key])
}

/** A tab's last committed values, and at most one immutable failed checkpoint. */
export class PersistenceSession {
    private expected?: Snapshot
    private pending?: { patch: ProfilePatch; backup: boolean }
    private journal?: string
    private listeners = new Set<(error: PersistenceError) => void>()
    private release?: () => void
    error?: PersistenceError
    readonly storage: Storage
    constructor(storage: Storage) { this.storage = storage }

    subscribe(listener: (error: PersistenceError) => void): () => void {
        this.listeners.add(listener)
        if (this.error) listener(this.error)
        return () => this.listeners.delete(listener)
    }
    private fail(kind: PersistenceFailure, message: string, cause?: unknown): never {
        const error = this.error = new PersistenceError(kind, message, cause)
        for (const listener of this.listeners) listener(error)
        throw error
    }
    /** Web Locks serialize writable tabs on HTTPS/localhost. LAN HTTP uses value guards. */
    async acquire(locks?: LockManager): Promise<void> {
        if (!locks) return
        await new Promise<void>((resolve, reject) => {
            void locks.request('spire-profile-writer', { ifAvailable: true }, async lock => {
                if (!lock) { this.error = new PersistenceError('busy', 'Another game tab is using this profile. Close it, then retry.'); reject(this.error); return }
                await new Promise<void>(release => { this.release = release; resolve() })
            }).catch(reject)
        })
    }
    close(): void { this.release?.(); this.release = undefined }

    recover(): void {
        let raw: string | null
        try { raw = this.storage.getItem(JOURNAL_KEY) }
        catch (cause) { this.fail('unavailable', 'Browser storage is unavailable.', cause) }
        if (raw) {
            this.journal = raw
            try { restore(this.storage, parseSnapshot(raw)); this.storage.removeItem(JOURNAL_KEY) }
            catch (cause) { this.fail('recovery-required', 'The saved checkpoint could not be restored. The recovery journal has been kept.', cause) }
        }
        this.journal = undefined; this.error = undefined; this.pending = undefined
        try { this.expected = readSnapshot(this.storage) }
        catch (cause) { this.fail('unavailable', 'Browser storage is unavailable.', cause) }
    }
    private check(): void {
        let current: Snapshot
        try {
            if (this.storage.getItem(JOURNAL_KEY)) this.fail('stale', 'A save is being recovered or replaced. Reload this tab.')
            current = readSnapshot(this.storage)
        } catch (cause) {
            if (cause instanceof PersistenceError) throw cause
            this.fail('unavailable', 'Browser storage is unavailable.', cause)
        }
        this.expected ??= current
        if (PROFILE_KEYS.some(key => current[key] !== this.expected![key])) this.fail('stale', 'Your profile changed in another tab. Reload to use the latest save.')
    }
    checkForForeignChanges(): void {
        if (this.error || !this.expected) return
        try { this.check() } catch { /* The shared recovery UI receives the failure. */ }
    }
    read(key: typeof PROFILE_KEYS[number]): string | null {
        try { return this.storage.getItem(key) }
        catch (cause) { this.fail('unavailable', 'Browser storage is unavailable.', cause) }
    }
    commit(patch: ProfilePatch, backup = false): void {
        if (this.error) throw this.error
        this.check()
        const keys = PROFILE_KEYS.filter(key => Object.hasOwn(patch, key))
        const previous = this.expected!
        const journal = JSON.stringify(previous)
        let journalWritten = false
        // Strings are captured before the first write. Retrying cannot re-run game actions.
        this.pending = { patch: { ...patch }, backup }
        try {
            if (backup) this.storage.setItem(BACKUP_KEY, journal)
            if (keys.length > 1) { this.storage.setItem(JOURNAL_KEY, journal); journalWritten = true; this.journal = journal }
            for (const key of keys) {
                const value = patch[key]!
                if (value === null) this.storage.removeItem(key)
                else this.storage.setItem(key, value)
            }
            if (journalWritten) this.storage.removeItem(JOURNAL_KEY)
        } catch (cause) {
            if (journalWritten) {
                try { restore(this.storage, previous); this.storage.removeItem(JOURNAL_KEY); this.journal = undefined }
                catch { this.fail('recovery-required', 'Save failed. The original profile is in the recovery journal; reload to retry recovery.', cause) }
            }
            const reason = cause instanceof Error ? ` ${cause.message}` : ''
            this.fail('write-failed', `Could not save. Your previous profile was restored.${reason}`, cause)
        }
        this.expected = { ...previous, ...patch }; this.pending = undefined; this.journal = undefined
    }
    retry(): void {
        if (this.error?.kind !== 'write-failed' || !this.pending) throw this.error ?? new Error('No checkpoint to retry.')
        const { patch, backup } = this.pending
        this.error = undefined
        this.commit(patch, backup)
    }
    /** Read from captured values even if access to browser storage has been revoked. */
    recoveryDownload(): { filename: string; json: string } | undefined {
        if (this.journal) return { filename: 'spire-recovery-journal.json', json: this.journal }
        if (!this.expected) return undefined
        const saved = this.pending && this.error?.kind === 'write-failed' ? { ...this.expected, ...this.pending.patch } : this.expected
        return { filename: this.pending && this.error?.kind === 'write-failed' ? 'spire-unsaved-checkpoint.json' : 'spire-last-checkpoint.json', json: JSON.stringify(saved, null, 2) }
    }
}

const sessions = new WeakMap<Storage, PersistenceSession>()
export function persistence(storage?: Storage): PersistenceSession {
    if (!storage) {
        try { storage = localStorage }
        catch (cause) { throw new PersistenceError('unavailable', 'Browser storage is unavailable.', cause) }
    }
    let session = sessions.get(storage)
    if (!session) { session = new PersistenceSession(storage); sessions.set(storage, session) }
    return session
}
