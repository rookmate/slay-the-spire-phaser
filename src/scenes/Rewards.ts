import Phaser from 'phaser'
import type { RunState } from '../core/run'

export class RewardsScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Rewards') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, 'Victory! You find 20 gold.', style)
        this.add.text(16, 50, 'Take', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.run.gold += 20
                this.run.floor += 1
                this.scene.start('Map', { run: this.run })
            })
    }
}


