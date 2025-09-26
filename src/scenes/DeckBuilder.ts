import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { RunState } from '../core/run'
// import { saveRun } from '../core/run'

export class DeckBuilderScene extends Phaser.Scene {
    run!: RunState
    private counts: Record<string, number> = {}
    // private countLabels: Record<string, Phaser.GameObjects.Text> = {}
    private list!: Phaser.GameObjects.Container
    private contentHeight = 0

    constructor() { super('DeckBuilder') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }
        this.add.text(16, 16, 'Card Library (view only)', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        })
        const keys = Object.keys(CARD_DEFS)
        keys.sort()

        this.list = this.add.container(0, 60)
        const rowH = 24
        keys.forEach((id, i) => {
            this.counts[id] = 0
            const def = CARD_DEFS[id]
            const y = i * rowH
            this.list.add(this.add.text(16, y, def.name, style))
        })
        this.contentHeight = keys.length * rowH

        // Scroll with mouse wheel
        this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
            this.list.y = Phaser.Math.Clamp(this.list.y - dy, 60 - (this.contentHeight - (this.scale.height - 120)), 60)
        })

        this.add.text(16, this.scale.height - 40, 'Back', { ...style, backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
    }

    // No finish method; read-only library
}


