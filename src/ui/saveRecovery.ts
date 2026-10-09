import type Phaser from 'phaser'
import { persistence, PersistenceError, PROFILE_KEYS, JOURNAL_KEY, type PersistenceSession } from '../core/persistence'
import { exportSnapshot } from '../core/profile/storage'

/** A save error stops the action. Recovery reloads a checkpoint, never replays it. */
export async function openProfile(game: Phaser.Game): Promise<boolean> {
    const dialog = document.createElement('dialog')
    dialog.className = 'save-recovery'; dialog.setAttribute('aria-labelledby', 'save-recovery-title')
    dialog.setAttribute('aria-describedby', 'save-recovery-detail')
    dialog.addEventListener('cancel', event => event.preventDefault())
    dialog.addEventListener('keydown', event => event.stopPropagation())
    document.body.append(dialog)
    let session: PersistenceSession | undefined, unsubscribe: (() => void) | undefined, disposed = false
    const show = (error: PersistenceError) => {
        game.pause(); game.input.enabled = false
        if (game.input.keyboard) game.input.keyboard.enabled = false
        dialog.replaceChildren()
        const title = document.createElement('h1'); title.id = 'save-recovery-title'
        const detail = document.createElement('p'); detail.id = 'save-recovery-detail'
        const messages = {
            busy: ['Profile open in another tab', 'Close the other game tab, then retry. This tab has not changed your save.'],
            stale: ['Your save changed in another tab', 'Play has stopped to protect the newer save. Reload to continue with it. Unsaved changes in this tab will be discarded.'],
            unavailable: ['Browser storage is unavailable', 'Play has stopped because this browser cannot access your saves. Allow storage for this site, then reload. Reloading discards unsaved changes.'],
            'write-failed': ['Your last action could not be saved', 'Play has stopped. Free browser storage, then retry this checkpoint. The action will not be repeated. Reloading without retrying discards the unsaved action.'],
            'recovery-required': ['Profile recovery required', 'The interrupted save could not be rolled back. Download the recovery journal before changing browser storage. Free space if needed, then retry recovery.'],
        } as const
        ;[title.textContent, detail.textContent] = messages[error.kind]
        dialog.append(title, detail)
        const actions = document.createElement('div'); actions.className = 'save-recovery-actions'; dialog.append(actions)
        const button = (label: string, action: () => void) => {
            const element = document.createElement('button'); element.textContent = label; element.onclick = action; actions.append(element)
        }
        if (error.kind === 'write-failed') button('Retry save', () => {
            try { session!.retry(); location.reload() } catch (next) { if (next instanceof PersistenceError) show(next); else throw next }
        })
        button(error.kind === 'busy' ? 'Retry opening profile' : error.kind === 'recovery-required' ? 'Retry recovery' : error.kind === 'write-failed' ? 'Reload previous checkpoint' : 'Reload', () => location.reload())
        const backup = session?.recoveryDownload()
        if (backup) button(error.kind === 'recovery-required' ? 'Download recovery journal' : error.kind === 'write-failed' ? 'Download unsaved checkpoint' : 'Download last checkpoint', () => {
            let json = backup.json, filename = backup.filename
            if (error.kind !== 'recovery-required') {
                try { json = exportSnapshot(json) } catch { filename = 'spire-recovery-values.json' }
            }
            const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        })
        if (!dialog.open) dialog.showModal()
        actions.querySelector('button')?.focus()
    }
    // Only already displayed persistence failures are handled here. Other errors surface.
    const failed = (event: ErrorEvent) => { if (event.error instanceof PersistenceError) { event.preventDefault(); show(event.error) } }
    const rejected = (event: PromiseRejectionEvent) => { if (event.reason instanceof PersistenceError) { event.preventDefault(); show(event.reason) } }
    const foreign = (event: StorageEvent) => {
        if (event.storageArea && event.storageArea !== session?.storage) return
        if (event.key === null || event.key === JOURNAL_KEY || PROFILE_KEYS.some(key => key === event.key)) session?.checkForForeignChanges()
    }
    const visible = () => { if (!document.hidden) session?.checkForForeignChanges() }
    const leave = () => session?.close()
    const restored = (event: PageTransitionEvent) => { if (event.persisted) location.reload() }
    window.addEventListener('error', failed); window.addEventListener('unhandledrejection', rejected)
    window.addEventListener('storage', foreign); document.addEventListener('visibilitychange', visible)
    window.addEventListener('pagehide', leave); window.addEventListener('pageshow', restored)
    game.events.once('destroy', () => {
        disposed = true
        unsubscribe?.(); session?.close(); dialog.remove()
        window.removeEventListener('error', failed); window.removeEventListener('unhandledrejection', rejected)
        window.removeEventListener('storage', foreign); document.removeEventListener('visibilitychange', visible)
        window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', restored)
    })
    try {
        session = persistence(); unsubscribe = session.subscribe(show)
        await session.acquire(navigator.locks)
        if (disposed) { session.close(); return false }
        session.recover()
        return true
    } catch (error) {
        show(error instanceof PersistenceError ? error : new PersistenceError('unavailable', 'Browser storage is unavailable.', error))
        return false
    }
}
