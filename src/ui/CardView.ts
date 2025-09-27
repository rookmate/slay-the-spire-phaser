import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import type { CardInstance } from '../core/state'

export interface CardViewOptions {
    x: number
    y: number
    scale?: number
    interactive?: boolean
}

export class CardView extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.Rectangle
    private art?: Phaser.GameObjects.Image
    private title: Phaser.GameObjects.Text
    private cost: Phaser.GameObjects.Text
    private subtype: Phaser.GameObjects.Text
    private stats: Phaser.GameObjects.Text

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardViewOptions) {
        super(scene, opts.x, opts.y)
        const def = CARD_DEFS[card.defId]
        const w = 90
        const h = 130
        const scale = opts.scale ?? 1
        this.bg = scene.add.rectangle(0, 0, w, h, 0x222222, 1).setStrokeStyle(2, 0xffffff)
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
            const innerH = 70
            this.art.setDisplaySize(innerW, innerH)
            this.art.setPosition(pad, 40)
        }
        this.title = scene.add.text(6, 6, def.name, { fontFamily: 'monospace', fontSize: '12px', color: '#fff' })
        this.cost = scene.add.text(w - 18, 6, String(def.cost ?? 0), { fontFamily: 'monospace', fontSize: '12px', color: '#ffeb3b' })
        this.subtype = scene.add.text(6, 24, def.type.toUpperCase(), { fontFamily: 'monospace', fontSize: '10px', color: '#aaa' })
        const stats: string[] = []
        if (def.baseDamage) stats.push(`DMG ${def.baseDamage}`)
        if (def.baseBlock) stats.push(`BLK ${def.baseBlock}`)
        this.stats = scene.add.text(6, h - 18, stats.join('  '), { fontFamily: 'monospace', fontSize: '10px', color: '#ddd' })
        // Add in correct z-order: background -> art -> texts
        this.add(this.bg)
        if (this.art) this.add(this.art)
        this.add([this.title, this.cost, this.subtype, this.stats])
        this.setSize(w, h)
        this.setScale(scale)
        if (opts.interactive) {
            this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
            this.setInteractive({ useHandCursor: true })
        }
    }
}


