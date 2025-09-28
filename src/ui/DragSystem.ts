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
    private dragStartPosition?: { x: number, y: number }

    private onCardPlay?: (card: CardInstance, targets: string[]) => void
    private getEnemyAtPoint?: (x: number, y: number) => number
    private getEnemySprites?: () => Phaser.GameObjects.Image[]
    private getPlayerSprite?: () => Phaser.GameObjects.Image | undefined

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

    setGetEnemySprites(callback: () => Phaser.GameObjects.Image[]): void {
        this.getEnemySprites = callback
    }

    setGetPlayerSprite(callback: () => Phaser.GameObjects.Image | undefined): void {
        this.getPlayerSprite = callback
    }

    startDrag(card: Card, cardIndex: number, pointer: Phaser.Input.Pointer): void {
        if (this.isDragging) return

        const cardInstance = this.engine.state.player.hand[cardIndex]
        const cardDef = CARD_DEFS[cardInstance.defId]

        // Check if player can afford the card
        if (this.engine.state.player.energy < (cardDef.cost ?? 0)) {
            return // Can't afford, don't start drag
        }

        this.isDragging = true
        this.dragCard = card
        this.dragCardIndex = cardIndex

        // Store original position and starting position for upward drag detection
        this.originalCardPosition = {
            x: card.x,
            y: card.y,
            rotation: card.rotation,
            depth: card.depth
        }

        // Store starting position for upward drag detection
        this.dragStartPosition = {
            x: pointer.worldX,
            y: pointer.worldY
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

        const cardInstance = this.engine.state.player.hand[this.dragCardIndex]
        const cardDef = CARD_DEFS[cardInstance.defId]
        let targetFound = false

        // Check if this is a non-targeting or all-enemies card dragged upward
        if (this.isUpwardDrag(pointer) && this.canAutoPlay(cardDef)) {
            // Auto-play the card
            const targets = this.getAutoPlayTargets(cardInstance)
            this.onCardPlay?.(cardInstance, targets)
            targetFound = true
        } else if (cardDef.targeting?.type === 'single_enemy' || cardDef.targeting?.type === 'any') {
            // Check if dropped on a valid target for targeting cards
            if (this.getEnemyAtPoint) {
                const targetEnemy = this.getEnemyAtPoint(pointer.worldX, pointer.worldY)
                if (targetEnemy !== -1) {
                    // Play the card on the target
                    this.onCardPlay?.(cardInstance, [this.engine.state.enemies[targetEnemy].id])
                    targetFound = true
                }
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

    private isUpwardDrag(pointer: Phaser.Input.Pointer): boolean {
        if (!this.dragStartPosition) return false

        // Check if dragged upward by at least 50 pixels
        const upwardDistance = this.dragStartPosition.y - pointer.worldY
        return upwardDistance >= 50
    }

    private canAutoPlay(cardDef: CardDef): boolean {
        return cardDef.targeting?.type === 'none' ||
            (cardDef.targeting?.type === 'all_enemies' && this.engine.state.enemies.some(e => e.hp > 0))
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
                this.highlightUpwardDragZone()
                break
            case 'none':
                this.highlightUpwardDragZone()
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
        // Highlight individual enemies for single targeting using actual enemy positions
        if (!this.getEnemySprites) return

        const enemySprites = this.getEnemySprites()
        this.engine.state.enemies.forEach((enemy, index) => {
            if (enemy.hp > 0 && enemySprites[index]) {
                const enemySprite = enemySprites[index]
                const bounds = enemySprite.getBounds()

                // Create highlight that matches the enemy sprite size and position
                const highlight = this.scene.add.rectangle(
                    enemySprite.x,
                    enemySprite.y,
                    bounds.width * 1.2, // Slightly larger than enemy
                    bounds.height * 1.2,
                    COMBAT_UI_CONFIG.colors.targetHighlight,
                    COMBAT_UI_CONFIG.colors.targetHighlightAlpha
                )
                highlight.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight)
                this.validTargets.push(highlight as any)
            }
        })
    }


    private highlightPlayer(): void {
        // Highlight player for self-targeting using actual player position
        if (!this.getPlayerSprite) return

        const playerSprite = this.getPlayerSprite()
        if (playerSprite) {
            const bounds = playerSprite.getBounds()

            // Create highlight that matches the player sprite size and position
            const highlight = this.scene.add.rectangle(
                playerSprite.x,
                playerSprite.y,
                bounds.width * 1.2, // Slightly larger than player
                bounds.height * 1.2,
                COMBAT_UI_CONFIG.colors.targetHighlight,
                COMBAT_UI_CONFIG.colors.targetHighlightAlpha
            )
            highlight.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight)
            this.validTargets.push(highlight as any)
        }
    }

    private highlightUpwardDragZone(): void {
        // Highlight the upward drag zone for auto-play cards
        const screenHeight = this.scene.cameras.main.height
        const highlight = this.scene.add.rectangle(
            this.scene.cameras.main.width / 2,
            screenHeight * 0.3, // Upper third of screen
            this.scene.cameras.main.width * 0.8,
            screenHeight * 0.4,
            COMBAT_UI_CONFIG.colors.targetHighlight,
            COMBAT_UI_CONFIG.colors.targetHighlightAlpha
        )
        highlight.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight)

        // Add text indicator
        const text = this.scene.add.text(
            this.scene.cameras.main.width / 2,
            screenHeight * 0.3,
            'Drag upward to play',
            {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#ffffff',
                align: 'center'
            }
        )
        text.setOrigin(0.5, 0.5)
        text.setDepth(COMBAT_UI_CONFIG.depths.targetHighlight + 1)

        this.validTargets.push(highlight as any)
        this.validTargets.push(text as any)
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
