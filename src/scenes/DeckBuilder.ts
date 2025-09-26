import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'

export class DeckBuilderScene extends Phaser.Scene {
    run!: RunState
    private counts: Record<string, number> = {}
    private countLabels: Record<string, Phaser.GameObjects.Text> = {}
    private list!: Phaser.GameObjects.Container
    private contentHeight = 0

    constructor() { super('DeckBuilder') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' }
        this.add.text(16, 16, 'Deck Builder (max 2 copies each, min 10 cards)', {
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
            const countText = this.add.text(260, y, '0', style)
            this.countLabels[id] = countText
            this.list.add(countText)
            this.list.add(this.add.text(200, y, '+', { ...style, backgroundColor: '#333', padding: { x: 6, y: 2 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.counts[id] < 2) {
                        this.counts[id] += 1
                        this.countLabels[id].setText(String(this.counts[id]))
                    }
                }))
            this.list.add(this.add.text(280, y, '-', { ...style, backgroundColor: '#333', padding: { x: 6, y: 2 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.counts[id] > 0) {
                        this.counts[id] -= 1
                        this.countLabels[id].setText(String(this.counts[id]))
                    }
                }))
        })
        this.contentHeight = keys.length * rowH

        // Scroll with mouse wheel
        this.input.on('wheel', (_p: any, _go: any, _dx: number, dy: number) => {
            this.list.y = Phaser.Math.Clamp(this.list.y - dy, 60 - (this.contentHeight - (this.scale.height - 120)), 60)
        })

        // Prefill default: 5 Strike + 5 Defend unless deck already exists
        if (!this.run.deck || this.run.deck.length === 0) {
            this.counts['STRIKE'] = Math.min(5, 2)
            this.counts['DEFEND'] = Math.min(5, 2)
            // If limited to 2 per card, fill to 10 with more basics
            let needed = 10 - (this.counts['STRIKE'] + this.counts['DEFEND'])
            while (needed > 0) {
                if (this.counts['STRIKE'] < 2) { this.counts['STRIKE']++; needed--; continue }
                if (this.counts['DEFEND'] < 2) { this.counts['DEFEND']++; needed--; continue }
                break
            }
            if (this.countLabels['STRIKE']) this.countLabels['STRIKE'].setText(String(this.counts['STRIKE']))
            if (this.countLabels['DEFEND']) this.countLabels['DEFEND'].setText(String(this.counts['DEFEND']))
        }

        this.add.text(16, this.scale.height - 40, 'Finish', { ...style, backgroundColor: '#444', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.finish())
    }

    private finish(): void {
        const deck = [] as RunState['deck']
        for (const [id, count] of Object.entries(this.counts)) {
            for (let i = 0; i < count; i++) deck.push({ defId: id, upgraded: false })
        }
        if (deck.length < 10) {
            // Fill to minimum with basics
            while (deck.length < 10) {
                const strikeCount = deck.filter(c => c.defId === 'STRIKE').length
                const defendCount = deck.filter(c => c.defId === 'DEFEND').length
                if (strikeCount < 2) deck.push({ defId: 'STRIKE', upgraded: false })
                else if (defendCount < 2) deck.push({ defId: 'DEFEND', upgraded: false })
                else deck.push({ defId: strikeCount <= defendCount ? 'STRIKE' : 'DEFEND', upgraded: false })
            }
        }
        this.run.deck = deck
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}


