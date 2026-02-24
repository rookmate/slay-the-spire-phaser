import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance } from '../core/state'
import { Card } from './Card'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

type WheelHandler = (_p: unknown, _go: unknown, _dx: number, dy: number) => void

export class OverlayManager {
    private scene: Phaser.Scene
    private engine: Engine
    private discardOverlay?: Phaser.GameObjects.Container
    private discardList?: Phaser.GameObjects.Container
    private discardContentHeight = 0
    private discardWheelHandler?: WheelHandler
    private deckOverlay?: Phaser.GameObjects.Container
    private deckList?: Phaser.GameObjects.Container
    private deckContentHeight = 0
    private deckWheelHandler?: WheelHandler
    private discardIcon?: Phaser.GameObjects.Text
    private resizeHandler?: (gameSize: Phaser.Structs.Size) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.createDiscardIcon()
    }

    private createDiscardIcon(): void {
        const { width, height } = this.scene.scale
        const style = {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.iconFontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            padding: { x: 6, y: 2 },
            backgroundColor: COMBAT_UI_CONFIG.colors.discardBg
        }

        this.discardIcon = this.scene.add.text(width - 16, height - 16, '🂠', style)
            .setOrigin(1, 1)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.openDiscardOverlay())
            .setDepth(COMBAT_UI_CONFIG.depths.ui)

        // Handle resize
        this.resizeHandler = (gameSize: Phaser.Structs.Size) => {
            this.discardIcon?.setPosition(gameSize.width - 16, gameSize.height - 16)
        }
        this.scene.scale.on('resize', this.resizeHandler)
    }

    openDiscardOverlay(): void {
        if (this.discardOverlay) {
            this.closeDiscardOverlay()
            return
        }
        this.closeDeckOverlay()

        const { overlay, list, wheelHandler } = this.createOverlay('discard', 'Discard Pile', this.engine.state.player.discardPile)
        this.discardOverlay = overlay
        this.discardList = list
        this.discardWheelHandler = wheelHandler
    }

    openDeckOverlay(): void {
        if (this.deckOverlay) {
            this.closeDeckOverlay()
            return
        }
        this.closeDiscardOverlay()

        const { overlay, list, wheelHandler } = this.createOverlay('deck', 'Draw Pile', this.engine.state.player.drawPile)
        this.deckOverlay = overlay
        this.deckList = list
        this.deckWheelHandler = wheelHandler
    }

    private createOverlay(
        kind: 'discard' | 'deck',
        title: string,
        cards: CardInstance[]
    ): {
        overlay: Phaser.GameObjects.Container
        list: Phaser.GameObjects.Container
        wheelHandler: WheelHandler
    } {
        const { width, height } = this.scene.scale
        const overlay = this.scene.add.container(0, 0)
        overlay.setDepth(COMBAT_UI_CONFIG.depths.overlay)

        // Background
        const bg = this.scene.add.rectangle(0, 0, width, height,
            COMBAT_UI_CONFIG.colors.overlay,
            COMBAT_UI_CONFIG.colors.overlayAlpha
        ).setOrigin(0, 0)
        bg.setInteractive()
        bg.on('pointerdown', () => this.closeAllOverlays())
        overlay.add(bg)

        // Title
        const titleText = this.scene.add.text(COMBAT_UI_CONFIG.overlay.padding, COMBAT_UI_CONFIG.overlay.padding, title, {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: '18px',
            color: COMBAT_UI_CONFIG.styles.color
        })
        overlay.add(titleText)

        // Close button
        const closeButton = this.scene.add.text(width - COMBAT_UI_CONFIG.overlay.padding, COMBAT_UI_CONFIG.overlay.padding, 'Close', {
            fontFamily: COMBAT_UI_CONFIG.styles.fontFamily,
            fontSize: COMBAT_UI_CONFIG.styles.fontSize,
            color: COMBAT_UI_CONFIG.styles.color,
            backgroundColor: '#444',
            padding: { x: 8, y: 6 }
        })
            .setOrigin(1, 0)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.closeAllOverlays())
        overlay.add(closeButton)

        // Card list container
        const list = this.scene.add.container(0, COMBAT_UI_CONFIG.overlay.titleHeight)
        overlay.add(list)

        // Populate cards
        const contentHeight = this.populateCardList(list, cards)
        if (kind === 'discard') this.discardContentHeight = contentHeight
        else this.deckContentHeight = contentHeight

        // Set up scrolling
        const wheelHandler = this.setupScrolling(kind, list)

        return { overlay, list, wheelHandler }
    }

    private populateCardList(list: Phaser.GameObjects.Container, cards: CardInstance[]): number {
        const { cardWidth, cardHeight, columns } = COMBAT_UI_CONFIG.overlay

        cards.forEach((card, i) => {
            const col = i % columns
            const row = Math.floor(i / columns)
            const view = new Card(this.scene, card, {
                x: COMBAT_UI_CONFIG.overlay.padding + col * cardWidth,
                y: row * cardHeight,
                scale: COMBAT_UI_CONFIG.overlay.cardScale
            })
            list.add(view)
        })

        const totalRows = Math.ceil(cards.length / columns)
        return totalRows * cardHeight
    }

    private setupScrolling(kind: 'discard' | 'deck', list: Phaser.GameObjects.Container): WheelHandler {
        const onWheel = (_p: any, _go: any, _dx: number, dy: number) => {
            const viewportHeight = this.scene.scale.height - 120
            const contentHeight = kind === 'discard' ? this.discardContentHeight : this.deckContentHeight
            const minY = COMBAT_UI_CONFIG.overlay.titleHeight - Math.max(0, contentHeight - viewportHeight)
            const maxY = COMBAT_UI_CONFIG.overlay.titleHeight
            list.y = Phaser.Math.Clamp(list.y - dy, minY, maxY)
        }

        this.scene.input.on('wheel', onWheel)
        return onWheel
    }

    private clampListY(list: Phaser.GameObjects.Container, contentHeight: number): void {
        const viewportHeight = this.scene.scale.height - 120
        const minY = COMBAT_UI_CONFIG.overlay.titleHeight - Math.max(0, contentHeight - viewportHeight)
        const maxY = COMBAT_UI_CONFIG.overlay.titleHeight
        list.y = Phaser.Math.Clamp(list.y, minY, maxY)
    }

    private closeAllOverlays(): void {
        this.closeDiscardOverlay()
        this.closeDeckOverlay()
    }

    private closeDiscardOverlay(): void {
        if (!this.discardOverlay) return

        if (this.discardWheelHandler) {
            this.scene.input.off('wheel', this.discardWheelHandler)
            this.discardWheelHandler = undefined
        }

        this.discardOverlay.destroy(true)
        this.discardOverlay = undefined
        this.discardList = undefined
        this.discardContentHeight = 0
    }

    private closeDeckOverlay(): void {
        if (!this.deckOverlay) return

        if (this.deckWheelHandler) {
            this.scene.input.off('wheel', this.deckWheelHandler)
            this.deckWheelHandler = undefined
        }

        this.deckOverlay.destroy(true)
        this.deckOverlay = undefined
        this.deckList = undefined
        this.deckContentHeight = 0
    }

    refreshOverlays(): void {
        this.refreshDiscardOverlay()
        this.refreshDeckOverlay()
    }

    private refreshDiscardOverlay(): void {
        if (!this.discardOverlay || !this.discardList) return

        this.discardList.removeAll(true)
        this.discardContentHeight = this.populateCardList(this.discardList, this.engine.state.player.discardPile)
        this.clampListY(this.discardList, this.discardContentHeight)
    }

    private refreshDeckOverlay(): void {
        if (!this.deckOverlay || !this.deckList) return

        this.deckList.removeAll(true)
        this.deckContentHeight = this.populateCardList(this.deckList, this.engine.state.player.drawPile)
        this.clampListY(this.deckList, this.deckContentHeight)
    }

    destroy(): void {
        this.closeAllOverlays()
        if (this.resizeHandler) this.scene.scale.off('resize', this.resizeHandler)
        this.discardIcon?.destroy()
    }
}
