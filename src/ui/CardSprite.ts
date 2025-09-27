import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { CardInstance } from '../core/state'

export interface CardSpriteOptions {
    x: number
    y: number
    scale?: number
    interactive?: boolean
}

export class CardSprite extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Rectangle
    private art?: Phaser.GameObjects.Image
    private title: Phaser.GameObjects.Text
    private cost: Phaser.GameObjects.Text
    private subtype: Phaser.GameObjects.Text
    private stats: Phaser.GameObjects.Text

    // Card dimensions - optimized for fan layout
    public static readonly CARD_WIDTH = 120
    public static readonly CARD_HEIGHT = 180

    // Static registry of all card sprites for collision detection
    private static allCards: CardSprite[] = []

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardSpriteOptions) {
        super(scene, opts.x, opts.y)
        const def = CARD_DEFS[card.defId]
        const w = CardSprite.CARD_WIDTH
        const h = CardSprite.CARD_HEIGHT
        const scale = opts.scale ?? 1

        // Create card background with white border
        this.bg = scene.add.rectangle(0, 0, w, h, 0x8B4513, 1).setStrokeStyle(4, 0xffffff)
        this.bg.setOrigin(0, 0)

        // Attempt to use sprite matching card name or id
        const artKeyCandidates = [
            `card:${def.id}`,
            `card:${def.name}`,
            `card:${def.name.replace(/\s+/g, '_')}`,
            `card:${def.name.replace(/\s+/g, '-').toLowerCase()}`,
            `card:${def.name.replace(/\s+/g, '_').toLowerCase()}`,
            `card:${def.id.toLowerCase()}`,
        ]
        const foundKey = artKeyCandidates.find(k => scene.textures.exists(k))
        if (foundKey) {
            this.art = scene.add.image(0, 0, foundKey).setOrigin(0, 0)
            const pad = 8
            const innerW = w - pad * 2
            const innerH = 80
            this.art.setDisplaySize(innerW, innerH)
            this.art.setPosition(pad, 50)
        }

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
        this.stats = scene.add.text(8, h - 24, stats.join('  '), {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#ddd'
        })

        // Add in correct z-order: background -> art -> texts
        this.add(this.bg)
        if (this.art) this.add(this.art)
        this.add([this.title, this.cost, this.subtype, this.stats])

        // Set Container bounds
        this.setSize(w, h)
        this.setDisplaySize(w, h)
        this.setScale(scale)

        // Register this card for collision detection
        CardSprite.allCards.push(this)

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
        const w = CardSprite.CARD_WIDTH
        const h = CardSprite.CARD_HEIGHT
        return localPoint.x >= 0 && localPoint.x <= w && localPoint.y >= 0 && localPoint.y <= h
    }

    // Static method to find all cards at a given point, sorted by depth (topmost first)
    public static getCardsAtPoint(x: number, y: number): CardSprite[] {
        return CardSprite.allCards
            .filter(card => card.containsPoint(x, y))
            .sort((a, b) => b.depth - a.depth) // Sort by depth, highest first
    }

    // Static method to get the topmost card at a point
    public static getTopCardAtPoint(x: number, y: number): CardSprite | null {
        const cards = CardSprite.getCardsAtPoint(x, y)
        return cards.length > 0 ? cards[0] : null
    }

    // Clean up when card is destroyed
    public destroy(): void {
        const index = CardSprite.allCards.indexOf(this)
        if (index > -1) {
            CardSprite.allCards.splice(index, 1)
        }
        super.destroy()
    }

    // Static method to clear all registered cards (useful for scene cleanup)
    public static clearAllCards(): void {
        CardSprite.allCards = []
    }
}
