import { JOURNAL_KEY } from '../core/profile/storage'
import type Phaser from 'phaser'
import { loadMeta, saveMeta } from '../core/meta'
import { META_CHANGED } from '../core/storageEvents'
import { persistence } from '../core/persistence'

/** A non-interactive live region wakes only when its queue or visibility changes. */
export function attachNotifications(game: Phaser.Game): void {
    const notice = document.createElement('div')
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite')
    notice.style.cssText = 'display:none;position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(620px,90vw);box-sizing:border-box;padding:10px 16px;background:#24231e;color:#f1e8d7;border:1px solid #9b7b48;font:15px/1.4 Barlow,sans-serif;z-index:10;pointer-events:none;white-space:pre-line;'
    document.body.append(notice)
    let timer: ReturnType<typeof setTimeout> | undefined
    let consuming = false
    const update = () => {
        if (consuming || persistence().error) return
        if (localStorage.getItem(JOURNAL_KEY)) {
            clearTimeout(timer); timer = undefined; notice.style.display = 'none'; return
        }
        if (document.hidden || timer) return
        notice.style.display = 'none'
        const meta = loadMeta(), next = meta.notifications?.[0]
        if (!next) return
        consuming = true
        try { meta.notifications!.shift(); saveMeta(meta) }
        catch { return }
        finally { consuming = false }
        notice.textContent = `${next.title}\n${next.detail}`
        notice.style.display = 'block'
        timer = setTimeout(() => { timer = undefined; update() }, 4500)
    }
    window.addEventListener(META_CHANGED, update)
    document.addEventListener('visibilitychange', update)
    game.events.once('destroy', () => {
        clearTimeout(timer); window.removeEventListener(META_CHANGED, update)
        document.removeEventListener('visibilitychange', update); notice.remove()
    })
    update()
}
