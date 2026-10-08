import { cardDescription } from '../core/cardText'
import type { Engine } from '../core/engine'
import Phaser from 'phaser'
import { resolveCard } from '../core/cards'
import type { CardInstance } from '../core/state'
import { CARD_SIZE } from './layout'

export interface CardOptions {
    engine?: Engine
    x: number
    y: number
    scale?: number
    interactive?: boolean
    locked?: boolean
}

export class Card extends Phaser.GameObjects.Container {
    private card: CardInstance
    private bg: Phaser.GameObjects.Rectangle
    private selectionArea: Phaser.GameObjects.Rectangle
    private title: Phaser.GameObjects.Text
    private cost: Phaser.GameObjects.Text
    private subtype: Phaser.GameObjects.Text
    private stats: Phaser.GameObjects.Text
    private stateBadge?: Phaser.GameObjects.Text

    // Dimensions shared by hand and selection layouts.
    public static readonly CARD_WIDTH = CARD_SIZE.width
    public static readonly CARD_HEIGHT = CARD_SIZE.height

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardOptions) {
        super(scene, opts.x, opts.y)
        this.card = card
        const def = resolveCard(card)
        const w = Card.CARD_WIDTH
        const h = Card.CARD_HEIGHT
        const scale = opts.scale ?? 1
        const locked = opts.locked ?? false

        // Create card background with color based on card type
        const bgColor = this.getBackgroundColor(def.type)
        this.bg = scene.add.rectangle(0, 0, w, h, bgColor, 1)
        this.bg.setOrigin(0, 0)
        if (locked) this.bg.setFillStyle(bgColor, 0.35)

        // Create transparent selection area rectangle
        this.selectionArea = scene.add.rectangle(0, 0, w, h, 0x000000, 0).setStrokeStyle(2, 0xffffff)
        this.selectionArea.setOrigin(0, 0)

        // Text elements sized for smaller cards
        this.title = scene.add.text(8, 8, def.name, {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#fff',
            wordWrap: { width: w - 44 }
        })

        this.cost = scene.add.text(w - 28, 8, def.xCost ? 'X' : String(def.cost ?? 0), {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#ffeb3b',
            backgroundColor: '#333',
            padding: { x: 6, y: 3 }
        })

        const typeLabel = [def.type.toUpperCase(), def.unplayable ? 'UNPLAYABLE' : undefined].filter(Boolean).join('  ')
        this.subtype = scene.add.text(8, 60, typeLabel, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: def.type === 'curse' ? '#f3c6f3' : '#ddd',
            wordWrap: { width: w - 16 },
        })

        this.stats = scene.add.text(8, 80, cardDescription(card, opts.engine), {
            fontFamily: 'monospace', fontSize: '10px', color: '#ddd', wordWrap: { width: w - 16 },
        })
        this.fitDescription()

        if (locked) {
            this.stateBadge = scene.add.text(8, h - 44, 'LOCKED', {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#ffcc80',
            })
        }

        // Add in correct z-order: background -> texts -> selectionArea
        this.add(this.bg)
        this.add([this.title, this.cost, this.subtype, this.stats, this.selectionArea])
        if (this.stateBadge) this.add(this.stateBadge)

        // Set Container bounds
        this.setSize(w, h)
        this.setDisplaySize(w, h)
        this.setScale(scale)

        if (opts.interactive) {
            // Use a more precise hit area that matches the visual card exactly
            this.setInteractive({
                hitArea: new Phaser.Geom.Rectangle(this.displayOriginX, this.displayOriginY, w, h),
                hitAreaCallback: Phaser.Geom.Rectangle.Contains,
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
            case 'status':
                return 0x4a4a4a
            case 'curse':
                return 0x4b173c
            default:
                return 0x8B4513 // Default brown
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

    setSelected(selected: boolean): void {
        this.selectionArea.setStrokeStyle(selected ? 4 : 2, selected ? 0xffeb3b : 0xffffff)
    }

    setCombatPreview(engine: Engine, targetId?: string): void {
        this.stats.setText(cardDescription(this.card, engine, targetId))
        this.fitDescription()
    }

    private fitDescription(): void {
        this.stats.setFontSize(10)
        if (this.stats.height > 92) this.stats.setFontSize(9)
    }

    getCardInstance(): CardInstance {
        return this.card
    }

}
