import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'

export class DeckBuilderScene extends Phaser.Scene {
    run!: RunState
    private counts: Record<string, number> = {}

    constructor() { super('DeckBuilder') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }
        this.add.text(16, 16, 'Deck Builder (max 2 copies each, min 10 cards)', {
            fontFamily: 'monospace', fontSize: '18px', color: '#ffffff',
        })
        const keys = Object.keys(CARD_DEFS)
        keys.sort()
        const startY = 60
        keys.forEach((id, i) => {
            this.counts[id] = 0
            const def = CARD_DEFS[id]
            const y = startY + i * 24
            this.add.text(16, y, def.name, style)
            const countText = this.add.text(260, y, '0', style)
            this.add.text(200, y, '+', { ...style, backgroundColor: '#333', padding: { x: 6, y: 2 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.counts[id] < 2) {
                        this.counts[id] += 1
                        countText.setText(String(this.counts[id]))
                    }
                })
            this.add.text(280, y, '-', { ...style, backgroundColor: '#333', padding: { x: 6, y: 2 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.counts[id] > 0) {
                        this.counts[id] -= 1
                        countText.setText(String(this.counts[id]))
                    }
                })
        })

        this.add.text(16, this.scale.height - 40, 'Finish', { ...style, backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.finish())
    }

    private finish(): void {
        const deck = [] as RunState['deck']
        for (const [id, count] of Object.entries(this.counts)) {
            for (let i = 0; i < count; i++) deck.push({ defId: id, upgraded: false })
        }
        if (deck.length < 10) return
        this.run.deck = deck
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}


