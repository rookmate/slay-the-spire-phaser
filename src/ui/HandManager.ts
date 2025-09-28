import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance, CardDef } from '../core/state'
import { Card } from './Card'
import { CARD_DEFS } from '../core/cards'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class HandManager {
    private scene: Phaser.Scene
    private engine: Engine
    private handCards: Card[] = []
    private handContainer?: Phaser.GameObjects.Container
    private handInputArea?: Phaser.GameObjects.Rectangle
    private currentHoverIndex: number | null = null

    private onCardDrag?: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void
    private onCardPlay?: (card: CardInstance, targets: string[]) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.setupHandInput()
    }

    setOnCardDrag(callback: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void): void {
        this.onCardDrag = callback
    }

    setOnCardPlay(callback: (card: CardInstance, targets: string[]) => void): void {
        this.onCardPlay = callback
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
                const cardInstance = this.engine.state.player.hand[cardIndex]
                const cardDef = CARD_DEFS[cardInstance.defId]

                // Check if card can be auto-played
                if (this.canAutoPlay(cardDef)) {
                    this.autoPlayCard(cardInstance, cardIndex)
                } else {
                    // Use drag system for targeting cards
                    this.onCardDrag?.(topCard, cardIndex, pointer)
                }
            }
        }
    }

    private canAutoPlay(cardDef: CardDef): boolean {
        return cardDef.targeting?.type === 'none' ||
            (cardDef.targeting?.type === 'all_enemies' && this.engine.state.enemies.some(e => e.hp > 0))
    }

    private autoPlayCard(cardInstance: CardInstance, _cardIndex: number): void {
        const cardDef = CARD_DEFS[cardInstance.defId]
        const targets = this.getAutoPlayTargets(cardDef)

        // Play the card immediately
        this.onCardPlay?.(cardInstance, targets)
    }

    private getAutoPlayTargets(cardDef: CardDef): string[] {
        switch (cardDef.targeting?.type) {
            case 'none':
                return ['player']
            case 'all_enemies':
                return this.engine.state.enemies
                    .filter(enemy => enemy.hp > 0)
                    .map(enemy => enemy.id)
            default:
                return []
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
