import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { BLIGHTS, takeBlight } from '../core/modes/endless'
import { advanceAct } from '../core/campaign'
import { saveRun, type RunState } from '../core/run'
import { getRunDestination } from '../core/progression'
import { menuButton, menuText } from '../ui/menu'
export class BlightChestScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('BlightChest') }
    create(data: { run: RunState }): void {
        roomBackdrop(this)
        this.run = data.run
        this.add.text(24, 24, 'Choose a blight', { ...menuText, fontSize: '26px' })
        ;(this.run.pendingBlights ?? []).forEach((id, i) => {
            const def = BLIGHTS[id], x = 24 + 380 * i
            menuButton(this, x, 120, def.name, () => {
                if (!takeBlight(this.run, id)) return
                advanceAct(this.run); saveRun(this.run)
                const next = getRunDestination(this.run); this.scene.start(next.scene, next.data)
            })
            this.add.text(x, 175, def.description, { ...menuText, wordWrap: { width: 340 } })
        })
    }
}
