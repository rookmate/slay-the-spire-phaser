import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { JOURNAL_KEY } from '../core/profile/storage'
import { menuButton, menuText } from '../ui/menu'

/** Start here only if restoring an interrupted import failed. No game saves load. */
export class ProfileRecoveryScene extends Phaser.Scene {
    constructor() { super('ProfileRecovery') }
    create(): void {
        roomBackdrop(this)
        this.add.text(24, 35, 'Profile recovery required', { ...menuText, fontSize: '24px' })
        this.add.text(24, 110, 'The interrupted import could not be rolled back.\nThe recovery journal has been kept. Download it before\nchanging browser storage. Free space if needed, then retry.\nGameplay will resume after recovery succeeds.', { ...menuText, lineSpacing: 12 })
        menuButton(this, 24, 270, 'Retry recovery', () => location.reload())
        menuButton(this, 260, 270, 'Download recovery journal', () => {
            const raw = localStorage.getItem(JOURNAL_KEY)
            if (!raw) return
            const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
            const link = document.createElement('a'); link.href = url; link.download = 'spire-recovery-journal.json'; link.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
        })
    }
}
