import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import { Card } from './Card'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class HandManager {
    private scene: Phaser.Scene
    private engine: Engine
    private handCards: Card[] = []
    private handContainer?: Phaser.GameObjects.Container
    private handInputArea?: Phaser.GameObjects.Rectangle
    private currentHoverIndex: number | null = null

    private onCardDrag?: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.setupHandInput()
    }

    setOnCardDrag(callback: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void): void {
        this.onCardDrag = callback
    }

    rebuildHand(): void {
        this.clearHand()
        this.createHandContainer()
        this.createHandCards()
        this.layoutHand()
    }

    private clearHand(): void {
        this.handCards.forEach(card => card.destroy())
        this.handCards = []

        if (this.handContainer) {
            this.handContainer.destroy()
            this.handContainer = undefined
        }
    }

    private createHandContainer(): void {
        this.handContainer = this.scene.add.container(0, 0)
        this.handContainer.setDepth(COMBAT_UI_CONFIG.depths.hand)
    }

    private createHandCards(): void {
        const player = this.engine.state.player
        player.hand.forEach((cardInstance) => {
            const card = new Card(this.scene, cardInstance, {
                x: 0,
                y: 0,
                scale: 1,
                interactive: false
            })
            card.updateCardVisuals()
            this.handContainer!.add(card)
            this.handCards.push(card)
        })
    }

    private layoutHand(): void {
        const cards = this.handCards
        if (cards.length === 0) return

        const screenW = this.scene.scale.width
        const centerX = screenW / 2
        const baseY = this.scene.scale.height - COMBAT_UI_CONFIG.layout.handBaseY
        const spacing = COMBAT_UI_CONFIG.layout.cardSpacing

        cards.forEach((card, i) => {
            const x = centerX + (i - cards.length / 2) * spacing
            const y = baseY - Math.sin(i / cards.length * Math.PI) * COMBAT_UI_CONFIG.layout.handCurveHeight
            const rotation = (i - cards.length / 2) * COMBAT_UI_CONFIG.layout.handRotationFactor
            const depth = COMBAT_UI_CONFIG.depths.hand + i

            card.setPosition(x, y)
            card.setRotation(rotation)
            card.setDepth(depth)
            card.setScale(1)

            // Store base position for hover animations
            card.setData('baseX', x)
            card.setData('baseY', y)
            card.setData('baseRot', rotation)
            card.setData('baseDepth', depth)
        })
    }

    private setupHandInput(): void {
        this.createHandInputArea()
        this.setupInputHandlers()
    }

    private createHandInputArea(): void {
        if (this.handInputArea) {
            this.handInputArea.destroy()
        }

        const screenW = this.scene.scale.width
        const screenH = this.scene.scale.height
        const centerX = screenW / 2
        const baseY = screenH - COMBAT_UI_CONFIG.layout.handBaseY

        this.handInputArea = this.scene.add.rectangle(
            centerX,
            baseY,
            screenW,
            200,
            0x000000,
            0 // Completely transparent
        )
        this.handInputArea.setDepth(100) // Below cards but above background
        this.handInputArea.setInteractive()
    }

    private setupInputHandlers(): void {
        if (!this.handInputArea) return

        this.handInputArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            this.handlePointerMove(pointer)
        })

        this.handInputArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.handlePointerDown(pointer)
        })
    }

    private handlePointerMove(pointer: Phaser.Input.Pointer): void {
        const cardsAtPoint = Card.getCardsAtPoint(pointer.worldX, pointer.worldY)
        const topCard = cardsAtPoint[0]

        if (topCard) {
            const topIndex = this.handCards.indexOf(topCard)
            if (topIndex !== this.currentHoverIndex) {
                this.currentHoverIndex = topIndex
                this.applyHoverState(topIndex)
            }
        } else if (this.currentHoverIndex !== null) {
            this.currentHoverIndex = null
            this.applyHoverState(null)
        }
    }

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        const topCard = Card.getTopCardAtPoint(pointer.worldX, pointer.worldY)
        if (topCard) {
            const cardIndex = this.handCards.indexOf(topCard)
            if (cardIndex !== -1) {
                // Always use drag system - no more click-to-play
                this.onCardDrag?.(topCard, cardIndex, pointer)
            }
        }
    }


    private applyHoverState(hoverIndex: number | null): void {
        const cards = this.handCards
        const siblingShift = COMBAT_UI_CONFIG.layout.siblingShift

        cards.forEach((card, i) => {
            const baseX = card.getData('baseX') as number
            const baseY = card.getData('baseY') as number
            const baseRot = card.getData('baseRot') as number
            const baseDepth = card.getData('baseDepth') as number

            if (hoverIndex === i) {
                // Hovered card
                card.setDepth(COMBAT_UI_CONFIG.depths.handHover)
                this.scene.tweens.add({
                    targets: card,
                    x: baseX,
                    y: baseY - COMBAT_UI_CONFIG.layout.hoverLift,
                    rotation: 0,
                    scale: 1,
                    duration: COMBAT_UI_CONFIG.animations.hoverDuration,
                    ease: 'Sine.Out',
                })
            } else if (hoverIndex != null) {
                // Sibling cards
                const dir = Math.sign(i - hoverIndex)
                this.scene.tweens.add({
                    targets: card,
                    x: baseX + dir * siblingShift,
                    y: baseY,
                    rotation: baseRot,
                    scale: 0.9,
                    duration: COMBAT_UI_CONFIG.animations.hoverDuration,
                    ease: 'Sine.Out',
                })
            } else {
                // No hover - return to base position
                this.scene.tweens.add({
                    targets: card,
                    x: baseX,
                    y: baseY,
                    rotation: baseRot,
                    scale: 1,
                    duration: COMBAT_UI_CONFIG.animations.hoverDuration,
                    ease: 'Sine.Out',
                    onComplete: () => card.setDepth(baseDepth),
                })
            }
        })
    }

    getHandCards(): Card[] {
        return this.handCards
    }

    destroy(): void {
        this.clearHand()
        if (this.handInputArea) {
            this.handInputArea.destroy()
        }
    }
}
