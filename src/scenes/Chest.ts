import Phaser from 'phaser'
import { loadMeta } from '../core/meta'
import { generateRewardBundle } from '../core/rewards'
import { completeRoom } from '../core/progression'
import { saveRun, type RunState } from '../core/run'
import { menuButton, menuText } from '../ui/menu'
import { addRunMenu } from '../ui/runMenu'
export class ChestScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Chest') }
    create(data: { run: RunState }): void {
        this.run = data.run
        this.add.text(24, 24, 'Treasure', { ...menuText, fontSize: '26px' })
        this.add.text(24, 120, this.run.relics.includes('CURSED_KEY') ? 'Cursed Key: opening this chest also gives you a Curse.' : 'A sealed chest waits in the room.', menuText)
        menuButton(this, 24, 200, 'Open chest', () => {
            const room = this.run.pendingRoom
            if (room?.scene !== 'Chest') return
            const rewards = generateRewardBundle(room.rewardSeed, 'chest', this.run, loadMeta())
            this.run.pendingRoom = { scene: 'Rewards', rewards }; saveRun(this.run)
            this.scene.start('Rewards', { run: this.run, rewards })
        })
        menuButton(this, 24, 260, 'Leave it closed', () => { completeRoom(this.run); saveRun(this.run); this.scene.start('Map', { run: this.run }) })
        addRunMenu(this, this.run)
    }
}
