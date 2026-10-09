import { describe, expect, it } from 'vitest'
import { PersistenceSession, PROFILE_KEYS, JOURNAL_KEY, BACKUP_KEY, readSnapshot, type ProfilePatch } from './persistence'

class MemoryStorage implements Storage {
    values = new Map<string, string>()
    fail?: (operation: 'set' | 'remove' | 'get', key: string) => void
    get length() { return this.values.size }
    clear() { this.values.clear() }
    key(index: number) { return [...this.values.keys()][index] ?? null }
    getItem(key: string) { this.fail?.('get', key); return this.values.get(key) ?? null }
    setItem(key: string, value: string) { this.fail?.('set', key); this.values.set(key, value) }
    removeItem(key: string) { this.fail?.('remove', key); this.values.delete(key) }
}
function fixture() {
    const storage = new MemoryStorage(), session = new PersistenceSession(storage)
    PROFILE_KEYS.forEach(key => storage.setItem(key, `original:${key}`))
    session.recover()
    return { storage, session, original: readSnapshot(storage) }
}
const replacement: ProfilePatch = { sts_meta_v2: 'new meta', sts_run_v7: null, sts_settings_v1: 'new settings' }

describe('durable profile transactions', () => {
    it.each([
        ['set', BACKUP_KEY], ['set', JOURNAL_KEY], ['set', PROFILE_KEYS[0]],
        ['remove', PROFILE_KEYS[1]], ['set', PROFILE_KEYS[2]], ['remove', JOURNAL_KEY],
    ] as const)('rolls back a failure at %s %s, then retries the exact prepared values', (operation, target) => {
        const { storage, session, original } = fixture()
        let failed = false
        storage.fail = (op, key) => { if (!failed && op === operation && key === target) { failed = true; throw new Error('full') } }
        const patch = { ...replacement }
        expect(() => session.commit(patch, true)).toThrow('previous profile was restored')
        expect(readSnapshot(storage)).toEqual(original)
        expect(storage.getItem(JOURNAL_KEY)).toBeNull()
        patch.sts_meta_v2 = 'mutated later'
        expect(() => session.commit({ sts_meta_v2: 'must stay blocked' })).toThrow()
        session.retry()
        expect(readSnapshot(storage)).toEqual(replacement)
        expect(JSON.parse(storage.getItem(BACKUP_KEY)!)).toEqual(original)
    })
    it('keeps the original journal when restoration fails and recovers it on restart', () => {
        const { storage, session, original } = fixture()
        storage.fail = (op, key) => { if (op === 'set' && key === PROFILE_KEYS[0]) throw new Error('full') }
        expect(() => session.commit(replacement)).toThrow('recovery journal')
        expect(session.error?.kind).toBe('recovery-required')
        expect(session.recoveryDownload()?.json).toBe(JSON.stringify(original))
        storage.fail = undefined
        const restarted = new PersistenceSession(storage); restarted.recover()
        expect(readSnapshot(storage)).toEqual(original); expect(storage.getItem(JOURNAL_KEY)).toBeNull()
    })
    it.each(PROFILE_KEYS)('rejects a foreign %s change before storage events arrive', key => {
        const { storage, session } = fixture()
        storage.setItem(key, 'foreign')
        const newest = readSnapshot(storage)
        expect(() => session.commit({ sts_run_v7: 'old run' })).toThrow('another tab')
        expect(session.error?.kind).toBe('stale'); expect(readSnapshot(storage)).toEqual(newest)
        expect(() => session.retry()).toThrow('another tab')
    })
    it('rejects a retry when another tab replaced the profile after a failed save', () => {
        const { storage, session } = fixture()
        storage.fail = (op, key) => { if (op === 'set' && key === PROFILE_KEYS[1]) throw new Error('full') }
        expect(() => session.commit({ sts_run_v7: 'unsaved' })).toThrow()
        storage.fail = undefined; storage.setItem(PROFILE_KEYS[1], 'newer')
        expect(() => session.retry()).toThrow('another tab')
        expect(storage.getItem(PROFILE_KEYS[1])).toBe('newer')
    })
    it('distinguishes denied storage from an interrupted-save journal', () => {
        const storage = new MemoryStorage(), session = new PersistenceSession(storage)
        storage.fail = () => { throw new Error('denied') }
        expect(() => session.recover()).toThrow('unavailable')
        expect(session.error?.kind).toBe('unavailable'); expect(session.recoveryDownload()).toBeUndefined()
    })
    it('never writes over an unrecovered journal and isolates injected stores', () => {
        const a = fixture(), b = fixture()
        a.storage.setItem(JOURNAL_KEY, JSON.stringify(a.original))
        expect(() => a.session.commit(replacement)).toThrow('recovered or replaced')
        b.session.commit(replacement)
        expect(readSnapshot(a.storage)).toEqual(a.original); expect(readSnapshot(b.storage)).toEqual(replacement)
    })
})
