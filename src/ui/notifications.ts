import { JOURNAL_KEY } from '../core/profile/storage'
import type Phaser from 'phaser'
import { loadMeta, saveMeta } from '../core/meta'

/** A non-interactive live region survives scene changes without covering input. */
export function attachNotifications(game: Phaser.Game): void {
    const notice = document.createElement('div')
    notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite')
    notice.style.cssText = 'display:none;position:fixed;top:12px;left:50%;transform:translateX(-50%);width:min(620px,90vw);box-sizing:border-box;padding:10px 16px;background:#24231e;color:#f1e8d7;border:1px solid #9b7b48;font:15px/1.4 Barlow,sans-serif;z-index:10;pointer-events:none;white-space:pre-line;'
    document.body.append(notice)
    let until = 0
    const timer = setInterval(() => {
        if (localStorage.getItem(JOURNAL_KEY)) { notice.style.display = 'none'; return }
        if (document.hidden || Date.now() < until) return
        const meta = loadMeta(), next = meta.notifications?.[0]
        if (!next) { notice.style.display = 'none'; return }
        meta.notifications!.shift()
        try { saveMeta(meta) } catch { return }
        notice.textContent = `${next.title}\n${next.detail}`
        notice.style.display = 'block'; until = Date.now() + 4500
    }, 500)
    game.events.once('destroy', () => { clearInterval(timer); notice.remove() })
}
