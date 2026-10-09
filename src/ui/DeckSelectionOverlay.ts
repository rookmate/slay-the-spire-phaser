import { access, bindAction } from './accessibility'
import { UI_FONT } from './theme'
import Phaser from 'phaser'
import type { CardInstance } from '../core/state'
import { CardGrid } from './CardGrid'

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
        access(this.scene).modal(overlay, () => this.close())

        const bg = this.scene.add.rectangle(0, 0, this.scene.scale.width, this.scene.scale.height, 0x000000, 0.8)
            .setOrigin(0, 0)
            .setInteractive()
        bg.on('pointerdown', () => this.close())
        overlay.add(bg)

        overlay.add(this.scene.add.text(24, 20, opts.title, {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '20px',
            color: '#ffffff',
        }))

        const close = this.scene.add.text(this.scene.scale.width - 24, 20, 'Close', {
            resolution: 2, fontFamily: UI_FONT,
            fontSize: '16px',
            color: '#ffffff',
            backgroundColor: '#493c29',
            padding: { x: 8, y: 6 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true })
        close.on('pointerdown', () => this.close())
        overlay.add(close)
        bindAction(close, () => this.close(), { label: 'Close card selection' })

        new CardGrid(this.scene, overlay, cards, 70, card => {
            const originalIndex = opts.cards.findIndex(candidate => candidate === card)
            this.close()
            opts.onSelect(card, originalIndex)
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
