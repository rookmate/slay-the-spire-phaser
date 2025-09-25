import Phaser from 'phaser'
import type { RunState } from '../core/run'

export class ShopScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Shop') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Shop (gold ${this.run.gold})`, style)
        this.add.text(16, 50, 'Leave', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('Map', { run: this.run }))
    }
}


