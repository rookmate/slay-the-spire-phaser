import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'

export class CampfireScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Campfire') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, 'Campfire', style)
        this.add.text(16, 50, 'Rest (+20% max HP)', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const heal = Math.round(this.run.player.maxHp * 0.2)
                this.run.player.hp = Math.min(this.run.player.maxHp, this.run.player.hp + heal)
                this.run.floor += 1
                saveRun(this.run)
                this.scene.start('Map', { run: this.run })
            })
    }
}


