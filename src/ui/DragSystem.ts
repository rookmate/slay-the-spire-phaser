import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance, CardDef } from '../core/state'
import { Card } from './Card'
import { CARD_DEFS } from '../core/cards'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class DragSystem {
    private scene: Phaser.Scene
    private engine: Engine
    private isDragging = false
    private dragCard?: Card
    private dragCardIndex = -1
    private dragPreview?: Card
    private validTargets: Phaser.GameObjects.Image[] = []
    private originalCardPosition?: { x: number, y: number, rotation: number, depth: number }

    private onCardPlay?: (card: CardInstance, targets: string[]) => void
    private getEnemyAtPoint?: (x: number, y: number) => number

    constructor(scene: Phaser.Scene, engine: Engine) {
        this.scene = scene
        this.engine = engine
    }

    setOnCardPlay(callback: (card: CardInstance, targets: string[]) => void): void {
        this.onCardPlay = callback
    }

    setGetEnemyAtPoint(callback: (x: number, y: number) => number): void {
        this.getEnemyAtPoint = callback
    }

    startDrag(card: Card, cardIndex: number, pointer: Phaser.Input.Pointer): void {
        if (this.isDragging) return

        const cardInstance = this.engine.state.player.hand[cardIndex]
        const cardDef = CARD_DEFS[cardInstance.defId]

        // Check if player can afford the card
        if (this.engine.state.player.energy < (cardDef.cost ?? 0)) {
            return // Can't afford, don't start drag
        }

        // Check if card requires targeting
        if (cardDef.targeting?.type === 'none') {
            // Auto-play cards that don't require targeting
            this.autoPlayCard(cardInstance, cardIndex)
            return
        }

        this.isDragging = true
        this.dragCard = card
        this.dragCardIndex = cardIndex

        // Store original position
        this.originalCardPosition = {
            x: card.x,
            y: card.y,
            rotation: card.rotation,
            depth: card.depth
        }

        // Create drag preview and highlight targets
        this.createDragPreview(pointer)
        this.highlightValidTargets(cardDef)

        // Move original card to follow cursor
        card.setDepth(COMBAT_UI_CONFIG.depths.dragCard)
    }

    updateDrag(pointer: Phaser.Input.Pointer): void {
        if (!this.isDragging || !this.dragCard || !this.dragPreview) return

        // Update drag preview position
        this.dragPreview.setPosition(pointer.worldX, pointer.worldY)

        // Update original card position to follow cursor
        this.dragCard.setPosition(pointer.worldX, pointer.worldY)
        this.dragCard.setRotation(0)
    }

    endDrag(pointer: Phaser.Input.Pointer): boolean {
        if (!this.isDragging) return false

        let targetFound = false

        // Check if dropped on a valid target
        if (this.getEnemyAtPoint) {
            const targetEnemy = this.getEnemyAtPoint(pointer.worldX, pointer.worldY)
            if (targetEnemy !== -1) {
                // Play the card on the target
                const cardInstance = this.engine.state.player.hand[this.dragCardIndex]
                this.onCardPlay?.(cardInstance, [this.engine.state.enemies[targetEnemy].id])
                targetFound = true
            }
        }

        // Clean up drag state
        this.cleanupDrag()

        return targetFound
    }

    private createDragPreview(pointer: Phaser.Input.Pointer): void {
        const cardInstance = this.engine.state.player.hand[this.dragCardIndex]

        // Create a semi-transparent copy of the card
        this.dragPreview = new Card(this.scene, cardInstance, {
            x: pointer.worldX,
            y: pointer.worldY,
            scale: 1.1,
            interactive: false
        })

        // Make it semi-transparent and set depth
        this.dragPreview.setAlpha(0.7)
        this.dragPreview.setDepth(COMBAT_UI_CONFIG.depths.dragPreview)
    }

    private autoPlayCard(cardInstance: CardInstance, _cardIndex: number): void {
        // Auto-play cards that don't require targeting
        const targets = this.getAutoPlayTargets(cardInstance)
        this.onCardPlay?.(cardInstance, targets)
    }

    private getAutoPlayTargets(cardInstance: CardInstance): string[] {
        const cardDef = CARD_DEFS[cardInstance.defId]

        switch (cardDef.targeting?.type) {
            case 'none':
                return ['player'] // Default to player for self-targeting cards
            case 'all_enemies':
                return this.engine.state.enemies
                    .filter(enemy => enemy.hp > 0)
                    .map(enemy => enemy.id)
            default:
                return []
        }
    }

    private highlightValidTargets(cardDef: CardDef): void {
        // Clear existing highlights
        this.clearTargetHighlights()

        switch (cardDef.targeting?.type) {
            case 'single_enemy':
                this.highlightEnemies()
                break
            case 'all_enemies':
                this.highlightAllEnemies()
                break
            case 'player':
                this.highlightPlayer()
                break
            case 'any':
                this.highlightAllTargets()
                break
        }
    }

    private highlightEnemies(): void {
        // Highlight individual enemies for single targeting
        this.engine.state.enemies.forEach((enemy, index) => {
            if (enemy.hp > 0) {
                const highlight = this.scene.add.rectangle(
                    600, 160 + index * 80, // Approximate enemy positions
                    100, 100, // Approximate enemy size
                    COMBAT_UI_CONFIG.colors.targetHighlight,
                    COMBAT_UI_CONFIG.colors.targetHighlightAlpha
                )
                highlight.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight)
                this.validTargets.push(highlight as any)
            }
        })
    }

    private highlightAllEnemies(): void {
        // Highlight all enemies for multi-targeting
        this.highlightEnemies() // Same as single enemy for now
    }

    private highlightPlayer(): void {
        // Highlight player for self-targeting
        const highlight = this.scene.add.rectangle(
            200, 400, // Approximate player position
            100, 100, // Approximate player size
            COMBAT_UI_CONFIG.colors.targetHighlight,
            COMBAT_UI_CONFIG.colors.targetHighlightAlpha
        )
        highlight.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight)
        this.validTargets.push(highlight as any)
    }

    private highlightAllTargets(): void {
        // Highlight all possible targets
        this.highlightEnemies()
        this.highlightPlayer()
    }

    private clearTargetHighlights(): void {
        this.validTargets.forEach(target => target.destroy())
        this.validTargets = []
    }

    private cleanupDrag(): void {
        this.isDragging = false

        // Restore original card position
        if (this.dragCard && this.originalCardPosition) {
            this.dragCard.setPosition(this.originalCardPosition.x, this.originalCardPosition.y)
            this.dragCard.setRotation(this.originalCardPosition.rotation)
            this.dragCard.setDepth(this.originalCardPosition.depth)
        }

        // Clean up drag preview
        if (this.dragPreview) {
            this.dragPreview.destroy()
            this.dragPreview = undefined
        }

        // Clear target highlights
        this.clearTargetHighlights()

        // Reset drag state
        this.dragCard = undefined
        this.dragCardIndex = -1
        this.originalCardPosition = undefined
    }

    isCurrentlyDragging(): boolean {
        return this.isDragging
    }

    destroy(): void {
        this.cleanupDrag()
    }
}
