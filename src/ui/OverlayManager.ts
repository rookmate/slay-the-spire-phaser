import { combatLayout } from './layout'
import type Phaser from 'phaser'
import type { Engine } from '../core/engine'
import { resolveCard } from '../core/cards'
import { CardGrid } from './CardGrid'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

type Pile = 'drawPile' | 'discardPile' | 'exhaustPile'
const titles: Record<Pile, string> = {
    drawPile: 'Draw Pile, shown in alphabetical order',
    discardPile: 'Discard Pile',
    exhaustPile: 'Exhaust Pile',
}

export class OverlayManager {
    private overlay?: Phaser.GameObjects.Container
    private pile?: Pile
    private buttons: Phaser.GameObjects.Text[] = []
    private readonly resizeHandler = () => {
        const { piles } = combatLayout(this.scene.scale.width, this.scene.scale.height)
        this.buttons.forEach((button, index) => button.setPosition(piles[index].x, piles[index].y))
        if (this.pile) this.showPile(this.pile)
    }

    private scene: Phaser.Scene
    private engine: Engine
    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        for (const [label, pile] of [['Discard', 'discardPile'], ['Exhaust', 'exhaustPile']] as const) {
            const button = scene.add.text(0, 0, label, {
                fontFamily: 'monospace', fontSize: '11px', color: '#fff', backgroundColor: '#333', padding: { x: 5, y: 1 },
            }).setOrigin(1, 0).setDepth(COMBAT_UI_CONFIG.depths.ui).setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.togglePile(pile))
            this.buttons.push(button)
        }
        this.resizeHandler()
        scene.scale.on('resize', this.resizeHandler)
    }

    openDiscardOverlay(): void { this.togglePile('discardPile') }
    openDeckOverlay(): void { this.togglePile('drawPile') }

    private togglePile(pile: Pile): void {
        if (this.pile === pile) this.close()
        else this.showPile(pile)
    }

    private showPile(pile: Pile): void {
        this.close()
        this.pile = pile
        const { width, height } = this.scene.scale
        const overlay = this.scene.add.container(0, 0).setDepth(COMBAT_UI_CONFIG.depths.overlay)
        this.overlay = overlay
        overlay.add(this.scene.add.rectangle(0, 0, width, height, 0x111111, 0.98).setOrigin(0).setInteractive())
        overlay.add(this.scene.add.text(20, 20, titles[pile], { fontFamily: 'monospace', fontSize: '16px', color: '#fff' }))
        overlay.add(this.scene.add.text(width - 20, 16, 'Close', {
            fontFamily: 'monospace', fontSize: '16px', color: '#fff', backgroundColor: '#444', padding: { x: 8, y: 6 },
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close()))
        const cards = [...this.engine.state.player[pile]]
        if (pile === 'drawPile') cards.sort((a, b) => resolveCard(a).name.localeCompare(resolveCard(b).name))
        new CardGrid(this.scene, overlay, cards, 64, () => {})
    }

    refreshOverlays(): void { if (this.pile) this.showPile(this.pile) }
    private close(): void {
        this.overlay?.destroy(true)
        this.overlay = undefined
        this.pile = undefined
    }
    destroy(): void {
        this.close()
        this.buttons.forEach(button => button.destroy())
        this.scene.scale.off('resize', this.resizeHandler)
    }
}
