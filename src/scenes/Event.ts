import Phaser from 'phaser'
import type { RunState } from '../core/run'

export class EventScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Event') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, 'A quiet corridor. Nothing happens.', style)
        this.add.text(16, 60, 'Continue', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Map', { run: this.run }))
    }
}


