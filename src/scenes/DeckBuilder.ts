import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { RunState } from '../core/run'
// import { saveRun } from '../core/run'
import { Card } from '../ui/Card'

export class DeckBuilderScene extends Phaser.Scene {
    run!: RunState
    private list!: Phaser.GameObjects.Container
    private contentHeight = 0

    constructor() { super('DeckBuilder') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }
        this.add.text(16, 16, 'Card Library', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        })
        const keys = Object.keys(CARD_DEFS)
        keys.sort()

        // Scrollable grid of all cards
        this.list = this.add.container(0, 60)
        const colW = 130
        const rowHCard = 190
        const cols = 5
        keys.forEach((id, i) => {
            const col = i % cols
            const row = Math.floor(i / cols)
            const card = { defId: id, upgraded: false } as any
            const view = new Card(this, card, { x: 16 + col * colW, y: row * rowHCard, scale: 1 })
            this.list.add(view)
        })
        const totalRows = Math.ceil(keys.length / cols)
        this.contentHeight = totalRows * rowHCard

        // Scroll with mouse wheel
        this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
            this.list.y = Phaser.Math.Clamp(this.list.y - dy, 60 - (this.contentHeight - (this.scale.height - 120)), 60)
        })

        // No deck list here; this scene shows the full card library

        this.add.text(16, this.scale.height - 40, 'Back', { ...style, backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
    }

    // No finish method; read-only library
}


