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
        this.title = scene.add.text(6, 6, def.name, { fontFamily: 'monospace', fontSize: '12px', color: '#fff' })
        this.cost = scene.add.text(w - 18, 6, String(def.cost ?? 0), { fontFamily: 'monospace', fontSize: '12px', color: '#ffeb3b' })
        this.subtype = scene.add.text(6, 24, def.type.toUpperCase(), { fontFamily: 'monospace', fontSize: '10px', color: '#aaa' })
        const stats: string[] = []
        if (def.baseDamage) stats.push(`DMG ${def.baseDamage}`)
        if (def.baseBlock) stats.push(`BLK ${def.baseBlock}`)
        this.stats = scene.add.text(6, h - 18, stats.join('  '), { fontFamily: 'monospace', fontSize: '10px', color: '#ddd' })
        this.add([this.bg, this.title, this.cost, this.subtype, this.stats])
        this.setSize(w, h)
        this.setScale(scale)
        if (opts.interactive) {
            this.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains)
        }
    }
}


