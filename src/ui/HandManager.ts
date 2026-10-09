import { loadSettings } from '../core/settings'
import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import { Card } from './Card'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'
import { combatLayout, handPositions, HAND_HOVER_LIFT } from './layout'

export class HandManager {
    private scene: Phaser.Scene
    private engine: Engine
    private handCards: Card[] = []
    private handContainer: Phaser.GameObjects.Container
    private handInputArea: Phaser.GameObjects.Rectangle
    private currentHoverIndex: number | null = null
    private selectedCard?: Card
    private onCardDrag?: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
        this.handContainer = scene.add.container(0, 0).setDepth(COMBAT_UI_CONFIG.depths.hand)
        this.handInputArea = scene.add.rectangle(0, 0, 1, 1, 0, 0).setOrigin(0, 0).setInteractive()
        this.handInputArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (pointer.isDown || this.selectedCard || !engine.canAcceptInput()) return
            const card = this.cardAtPoint(pointer.worldX, pointer.worldY)
            const index = card ? this.handCards.indexOf(card) : null
            if (index !== this.currentHoverIndex) this.layoutHand(index)
        })
        this.handInputArea.on('pointerout', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown && !this.selectedCard) this.layoutHand(null)
        })
        this.handInputArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const card = this.cardAtPoint(pointer.worldX, pointer.worldY)
            if (!card) return
            if (card.inspectAtPoint(pointer.worldX, pointer.worldY)) return
            this.handCards.forEach(view => { scene.tweens.killTweensOf(view); view.showDetails(false) })
            this.onCardDrag?.(card, this.handCards.indexOf(card), pointer)
        })
    }

    setOnCardDrag(callback: (card: Card, cardIndex: number, pointer: Phaser.Input.Pointer) => void): void {
        this.onCardDrag = callback
    }

    rebuildHand(): void {
        this.selectedCard = undefined
        this.handCards.forEach(card => this.scene.tweens.killTweensOf(card))
        this.handContainer.removeAll(true)
        this.handCards = this.engine.state.player.hand.map(instance => {
            const card = new Card(this.scene, instance, { x: 0, y: 0, engine: this.engine })
            this.handContainer.add(card)
            return card
        })
        const { hand } = combatLayout(this.scene.scale.width, this.scene.scale.height)
        this.handInputArea.setPosition(hand.x, hand.y - HAND_HOVER_LIFT)
            .setSize(hand.width, hand.height + HAND_HOVER_LIFT)
        this.handInputArea.input?.hitArea.setTo(0, 0, hand.width, hand.height + HAND_HOVER_LIFT)
        this.layoutHand(null, false)
    }

    private cardAtPoint(x: number, y: number): Card | undefined {
        return [...this.handCards].sort((a, b) => b.depth - a.depth).find(card => card.containsPoint(x, y))
    }

    private layoutHand(hovered: number | null, animate = true): void {
        this.currentHoverIndex = hovered
        const positions = handPositions(this.scene.scale.width, this.scene.scale.height, this.handCards.length, hovered)
        this.handCards.forEach((card, index) => {
            this.scene.tweens.killTweensOf(card)
            card.showDetails(!this.selectedCard && index === hovered)
            card.setSelected(card === this.selectedCard)
            card.setDimmed(!!this.selectedCard && card !== this.selectedCard)
            this.handContainer.bringToTop(card)
            card.setDepth(index === hovered ? COMBAT_UI_CONFIG.depths.handHover : index)
            if (animate && !loadSettings().reducedMotion) this.scene.tweens.add({ targets: card, ...positions[index], duration: 150, ease: 'Cubic.Out' })
            else card.setPosition(positions[index].x, positions[index].y)
        })
        if (hovered !== null) this.handContainer.bringToTop(this.handCards[hovered])
    }

    getHandCards(): Card[] {
        return this.handCards
    }

    focusCard(card?: Card): void {
        this.selectedCard = card
        this.layoutHand(card ? this.handCards.indexOf(card) : null)
    }

    detachCard(card: Card): void {
        this.scene.tweens.killTweensOf(card)
        this.handCards = this.handCards.filter(view => view !== card)
        this.handContainer.remove(card)
        this.scene.add.existing(card)
        card.showDetails(false)
        card.iterate((child: Phaser.GameObjects.GameObject) => child.disableInteractive())
    }

    inspectCard(index: number): void {
        this.handCards.forEach((card, i) => card.showDetails(i === index))
    }

    isInspecting(): boolean { return this.handCards.some(card => card.isShowingDetails()) }

    destroy(): void {
        this.handCards.forEach(card => this.scene.tweens.killTweensOf(card))
        this.handContainer.destroy(true)
        this.handCards = []
        this.handInputArea.destroy()
    }
}
