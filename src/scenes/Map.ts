import Phaser from 'phaser'
import type { RunState } from '../core/run'

type NodeKind = 'monster' | 'event' | 'shop' | 'rest'

export class MapScene extends Phaser.Scene {
    run!: RunState

    constructor() {
        super('Map')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Floor ${this.run.floor}  HP ${this.run.player.hp}/${this.run.player.maxHp}  Gold ${this.run.gold}`, style)
        this.add.text(16, 44, 'Choose your next node:', style)

        const nodes: NodeKind[] = ['monster', 'event', 'rest']
        nodes.forEach((k, i) => {
            this.add.text(16, 90 + i * 40, `» ${k}`, { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.enterNode(k))
        })
    }

    private enterNode(kind: NodeKind): void {
        if (kind === 'monster') {
            this.scene.start('Combat', { run: this.run })
            return
        }
        if (kind === 'rest') {
            this.scene.start('Campfire', { run: this.run })
            return
        }
        if (kind === 'shop') {
            this.scene.start('Shop', { run: this.run })
            return
        }
        this.scene.start('Event', { run: this.run })
    }
}


