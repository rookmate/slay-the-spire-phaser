import Phaser from 'phaser'
import type { CardInstance } from '../core/state'
import { Card } from './Card'

export class DeckSelectionOverlay {
    private scene: Phaser.Scene
    private overlay?: Phaser.GameObjects.Container

    constructor(scene: Phaser.Scene) {
        this.scene = scene
    }

    open(opts: {
        title: string
        cards: CardInstance[]
        filter?: (card: CardInstance) => boolean
        onSelect: (card: CardInstance, index: number) => void
    }): void {
        this.close()
        const cards = opts.cards.filter(card => (opts.filter ? opts.filter(card) : true))
        const overlay = this.scene.add.container(0, 0).setDepth(5000)
        this.overlay = overlay

        const bg = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.8)
            .setOrigin(0, 0)
            .setInteractive()
        bg.on('pointerdown', () => this.close())
        overlay.add(bg)

        overlay.add(this.scene.add.text(24, 20, opts.title, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
        }))

        const close = this.scene.add.text(this.scene.scale.width - 24, 20, 'Close', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#444',
            padding: { x: 8, y: 6 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
        close.on('pointerdown', () => this.close())
        overlay.add(close)

        const cols = 5
        const spacingX = 130
        const spacingY = 195
        const startX = 20
        const startY = 70

        cards.forEach((card, index) => {
            const col = index % cols
            const row = Math.floor(index / cols)
            const view = new Card(this.scene, card, {
                x: startX + col * spacingX,
                y: startY + row * spacingY,
                interactive: true,
            })
            view.on('pointerdown', () => {
                const originalIndex = opts.cards.findIndex(candidate => candidate === card)
                opts.onSelect(card, originalIndex)
                this.close()
            })
            overlay.add(view)
        })
    }

    close(): void {
        this.overlay?.destroy(true)
        this.overlay = undefined
    }

    destroy(): void {
        this.close()
    }
}
