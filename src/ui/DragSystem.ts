import { relicAllowsUnplayable } from '../core/combat/relicRules'
import Phaser from 'phaser'
import type { Engine } from '../core/engine'
import type { CardInstance, CardDef } from '../core/state'
import { Card } from './Card'
import { resolveCard } from '../core/cards'
import { COMBAT_UI_CONFIG } from './CombatUIConfig'

export class DragSystem {
    private scene: Phaser.Scene
    private engine: Engine
    private isDragging = false
    private dragCard?: Card
    private dragCardId?: string
    private validTargets: Phaser.GameObjects.GameObject[] = []
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

    startDrag(card: Card, _cardIndex: number, pointer: Phaser.Input.Pointer): void {
        if (this.isDragging || !this.engine.canAcceptInput()) return

        const cardInstance = this.engine.state.player.hand.find(c => c.instanceId === card.getCardInstance().instanceId)
        if (!cardInstance) return
        const cardDef = resolveCard(cardInstance)
        if (!cardDef || (cardDef.unplayable && !relicAllowsUnplayable(this.engine, cardInstance))) return

        // Mirror engine cost modifiers so drag availability matches actual playability.
        const effectiveCost = this.engine.getCardCost(cardInstance)
        if (this.engine.state.player.energy < effectiveCost) {
            return // Can't afford, don't start drag
        }
        if (cardDef.canPlay) {
            const canPlay = cardDef.canPlay({
                engine: this.engine,
                source: this.engine.state.player.id,
                targets: [],
                card: cardInstance,
            })
            if (!canPlay) return
        }

        this.isDragging = true
        this.dragCard = card
        this.dragCardId = cardInstance.instanceId

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

        // Highlight legal drop targets.
        this.highlightValidTargets(cardDef)

        // Move original card to follow cursor
        card.setDepth(COMBAT_UI_CONFIG.depths.dragCard)
    }

    updateDrag(pointer: Phaser.Input.Pointer): void {
        const target = this.getEnemyAtPoint?.(pointer.worldX, pointer.worldY) ?? -1
        this.dragCard?.setCombatPreview(this.engine, this.engine.state.enemies[target]?.id)
        if (!this.isDragging || !this.dragCard) return

        // Update original card position to follow cursor
        this.dragCard.setPosition(pointer.worldX - Card.CARD_WIDTH / 2, pointer.worldY - 30)
        this.dragCard.setRotation(0)
    }

    endDrag(pointer: Phaser.Input.Pointer): boolean {
        if (!this.isDragging) return false

        const cardInstance = this.engine.state.player.hand.find(c => c.instanceId === this.dragCardId)
        if (!cardInstance) {
            this.cleanupDrag()
            return false
        }
        const cardDef = resolveCard(cardInstance)
        let targets: string[] | undefined
        if (this.isUpwardDrag(pointer) && this.canAutoPlay(cardDef)) {
            targets = this.getAutoPlayTargets(cardInstance)
        } else if (cardDef.targeting?.type === 'single_enemy' || cardDef.targeting?.type === 'any') {
            const targetEnemy = this.getEnemyAtPoint?.(pointer.worldX, pointer.worldY) ?? -1
            if (targetEnemy !== -1) targets = [this.engine.state.enemies[targetEnemy].id]
        }

        // Playing can rebuild the hand or end combat, destroying this card.
        this.cleanupDrag()
        if (targets) this.onCardPlay?.(cardInstance, targets)
        return targets !== undefined
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
        const cardDef = resolveCard(cardInstance)

        switch (cardDef.targeting?.type) {
            case 'none':
                return []
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
                this.validTargets.push(highlight)
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
            this.validTargets.push(highlight)
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

        this.validTargets.push(highlight)
        this.validTargets.push(text)
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

        // Clear target highlights
        this.clearTargetHighlights()

        // Reset drag state
        this.dragCard = undefined
        this.dragCardId = undefined
        this.originalCardPosition = undefined
    }

    cancelDrag(): void { if (this.isDragging) this.cleanupDrag() }

    isCurrentlyDragging(): boolean {
        return this.isDragging
    }

    destroy(): void {
        this.cleanupDrag()
    }
}
