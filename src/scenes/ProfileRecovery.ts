import Phaser from 'phaser'
import { openProfile } from '../ui/saveRecovery'
import { attachStorageSync } from '../ui/storageSync'
import { attachSound } from '../ui/sound'
import { attachNotifications } from '../ui/notifications'
import { attachRunClock } from '../core/runClock'

/** Claim the writer and recover interrupted saves before loading any game state. */
export class ProfileRecoveryScene extends Phaser.Scene {
    constructor() { super('ProfileRecovery') }
    create(): void {
        void openProfile(this.game).then(ready => {
            if (!ready) return
            attachStorageSync(this.game); attachSound(this.game)
            attachNotifications(this.game); attachRunClock(this.game)
            this.scene.start('Boot')
        })
    }
}
