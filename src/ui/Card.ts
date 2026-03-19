import Phaser from 'phaser'
import { CARD_DEFS, resolveCard } from '../core/cards'
import type { CardInstance } from '../core/state'

export interface CardOptions {
    x: number
    y: number
    scale?: number
    interactive?: boolean
}

export class Card extends Phaser.GameObjects.Container {
    private card: CardInstance
    private bg: Phaser.GameObjects.Rectangle
    private selectionArea: Phaser.GameObjects.Rectangle
    private title: Phaser.GameObjects.Text
    private cost: Phaser.GameObjects.Text
    private subtype: Phaser.GameObjects.Text
    private stats: Phaser.GameObjects.Text
    private implementedBadge?: Phaser.GameObjects.Text

    // Card dimensions - optimized for fan layout
    public static readonly CARD_WIDTH = 120
    public static readonly CARD_HEIGHT = 180

    // Static registry of all cards for collision detection
    private static allCards: Card[] = []

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardOptions) {
        super(scene, opts.x, opts.y)
        this.card = card
        const def = resolveCard(card)
        const w = Card.CARD_WIDTH
        const h = Card.CARD_HEIGHT
        const scale = opts.scale ?? 1

        // Create card background with color based on card type
        const bgColor = this.getBackgroundColor(def.type)
        this.bg = scene.add.rectangle(0, 0, w, h, bgColor, 1)
        this.bg.setOrigin(0, 0)
        if (!CARD_DEFS[card.defId].poolEnabled) this.bg.setFillStyle(bgColor, 0.4)

        // Create transparent selection area rectangle
        this.selectionArea = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setStrokeStyle(4, 0xffffff)
        this.selectionArea.setOrigin(0, 0)

        // Text elements sized for smaller cards
        this.title = scene.add.text(8, 8, def.name, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#fff',
            wordWrap: { width: w - 16 }
        })

        this.cost = scene.add.text(w - 24, 8, String(def.cost ?? 0), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffeb3b',
            backgroundColor: '#333',
            padding: { x: 6, y: 3 }
        })

        this.subtype = scene.add.text(8, 32, def.type.toUpperCase(), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#aaa'
        })

        const stats: string[] = []
        if (def.baseDamage) stats.push(`DMG ${def.baseDamage}`)
        if (def.baseBlock) stats.push(`BLK ${def.baseBlock}`)
        if (def.exhaust) stats.push('EXH')
        this.stats = scene.add.text(8, h - 24, stats.join('  '), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ddd'
        })

        if (!CARD_DEFS[card.defId].poolEnabled) {
            this.implementedBadge = scene.add.text(8, h - 44, 'COMING LATER', {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#ffcc80',
            })
        }

        // Add in correct z-order: background -> texts -> selectionArea
        this.add(this.bg)
        this.add([this.title, this.cost, this.subtype, this.stats, this.selectionArea])
        if (this.implementedBadge) this.add(this.implementedBadge)

        // Set Container bounds
        this.setSize(w, h)
        this.setDisplaySize(w, h)
        this.setScale(scale)

        // Register this card for collision detection
        Card.allCards.push(this)

        if (opts.interactive) {
            // Use a more precise hit area that matches the visual card exactly
            this.setInteractive({
                hitArea: new Phaser.Geom.Rectangle(0, 0, w, h),
                hitAreaCallback: (_hitArea: Phaser.Geom.Rectangle, x: number, y: number, _gameObject: Phaser.GameObjects.GameObject) => {
                    // Convert world coordinates to local coordinates
                    const localPoint = this.getLocalPoint(x, y)
                    // Check if the point is within the card bounds
                    return localPoint.x >= 0 && localPoint.x <= w && localPoint.y >= 0 && localPoint.y <= h
                },
                useHandCursor: true
            })
        }
    }

    // Get background color based on card type
    private getBackgroundColor(cardType: string): number {
        switch (cardType) {
            case 'attack':
                return 0x8B0000 // Dark red for attacks
            case 'skill':
                return 0x006400 // Dark green for skills
            case 'power':
                return 0x4B0082 // Indigo for powers
            default:
                return 0x8B4513 // Default brown
        }
    }

    // Store base position for hover animations
    public setBasePosition(x: number, y: number, rotation: number): void {
        this.setData('baseX', x)
        this.setData('baseY', y)
        this.setData('baseRot', rotation)
    }

    public getBasePosition(): { x: number, y: number, rotation: number } {
        return {
            x: this.getData('baseX') || 0,
            y: this.getData('baseY') || 0,
            rotation: this.getData('baseRot') || 0
        }
    }

    // Check if a point is within this card's bounds (simplified version)
    public containsPoint(x: number, y: number): boolean {
        // Convert world coordinates to local coordinates
        const localPoint = this.getLocalPoint(x, y)
        const w = Card.CARD_WIDTH
        const h = Card.CARD_HEIGHT
        return localPoint.x >= 0 && localPoint.x <= w && localPoint.y >= 0 && localPoint.y <= h
    }

    // Static method to find all cards at a given point, sorted by depth (topmost first)
    public static getCardsAtPoint(x: number, y: number): Card[] {
        return Card.allCards
            .filter(card => card.containsPoint(x, y))
            .sort((a, b) => b.depth - a.depth) // Sort by depth, highest first
    }

    // Static method to get the topmost card at a point
    public static getTopCardAtPoint(x: number, y: number): Card | null {
        const cards = Card.getCardsAtPoint(x, y)
        return cards.length > 0 ? cards[0] : null
    }

    updateCardVisuals(): void {
        const cardDef = resolveCard(this.card)

        // Add visual indicators for targeting type
        if (cardDef.targeting?.type === 'none') {
            // Add upward arrow indicator for drag-up-to-play
            this.addUpwardDragIndicator()
        } else if (cardDef.targeting?.type === 'all_enemies') {
            // Add upward arrow indicator for drag-up-to-play
            this.addUpwardDragIndicator()
        }
    }

    getCardInstance(): CardInstance {
        return this.card
    }

    private addUpwardDragIndicator(): void {
        // Add an upward arrow to indicate drag-up-to-play
        const indicator = this.scene.add.polygon(100, 20, [
            0, 12,   // Bottom left
            6, 0,    // Top center
            12, 12   // Bottom right
        ], 0x00ff00, 0.8)
        indicator.setDepth(1000)
        this.add(indicator)
    }

    // Clean up when card is destroyed
    public destroy(): void {
        const index = Card.allCards.indexOf(this)
        if (index > -1) {
            Card.allCards.splice(index, 1)
        }
        super.destroy()
    }

    // Static method to clear all registered cards (useful for scene cleanup)
    public static clearAllCards(): void {
        Card.allCards = []
    }
}
