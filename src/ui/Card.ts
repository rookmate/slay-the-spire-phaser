import { cardDescription } from '../core/cardText'
import type { Engine } from '../core/engine'
import Phaser from 'phaser'
import { resolveCard } from '../core/cards'
import type { CardInstance } from '../core/state'
import { CARD_SIZE } from './layout'

export interface CardOptions { engine?: Engine; x: number; y: number; scale?: number; interactive?: boolean; locked?: boolean }
const colors = { ironclad: 0x954b40, silent: 0x617b48, defect: 0x4e7f88, watcher: 0x7c628e, colorless: 0x8a806a }

export class Card extends Phaser.GameObjects.Container {
    private card: CardInstance
    private engine?: Engine
    private border: Phaser.GameObjects.Rectangle
    private description: Phaser.GameObjects.Text
    private fullDescription = ''
    private inspectHint: Phaser.GameObjects.Text
    private detail?: Phaser.GameObjects.Container
    private locked: boolean
    public static readonly CARD_WIDTH = CARD_SIZE.width
    public static readonly CARD_HEIGHT = CARD_SIZE.height

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardOptions) {
        super(scene, opts.x, opts.y)
        this.card = card; this.engine = opts.engine
        this.locked = !!opts.locked
        const def = resolveCard(card), w = Card.CARD_WIDTH, h = Card.CARD_HEIGHT
        const color = def.type === 'curse' ? 0x655068 : def.type === 'status' ? 0x646466 : colors[def.color ?? 'colorless']
        const bg = scene.add.rectangle(0, 0, w, h, 0x29262b).setOrigin(0)
        const header = scene.add.rectangle(0, 0, w, 46, color).setOrigin(0)
        this.border = scene.add.rectangle(0, 0, w, h, 0, 0).setOrigin(0).setStrokeStyle(1, 0xb7a78a)
        const title = scene.add.text(8, 7, def.name, { fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold', color: card.upgradeLevel ? '#dbefb3' : '#fff4dc', wordWrap: { width: w - 40, useAdvancedWrap: true }, lineSpacing: 1 })
        const cost = scene.add.text(w - 25, 7, def.xCost ? 'X' : String(opts.engine?.getCardCost(card) ?? def.cost), { fontFamily: 'monospace', fontSize: '15px', color: '#f5d78a', backgroundColor: '#211e24', padding: { x: 4, y: 2 } })
        const type = scene.add.text(8, 50, `${def.type}${def.rarity && def.rarity !== 'basic' ? ` · ${def.rarity}` : ''}`, { fontFamily: 'monospace', fontSize: '10px', color: '#c5bba8' })
        this.description = scene.add.text(8, 68, '', { fontFamily: 'monospace', fontSize: '11px', color: '#f1e8d7', wordWrap: { width: w - 16 }, lineSpacing: 1 })
        this.inspectHint = scene.add.text(8, h - 15, opts.locked ? 'Locked' : '', { fontFamily: 'monospace', fontSize: '9px', color: '#dac395' })
        this.add([bg, header, title, cost, type, this.description, this.inspectHint, this.border])
        const inspect = scene.add.text(w - 20, h - 19, '?', { fontFamily: 'monospace', fontSize: '14px', color: '#f5d78a', backgroundColor: '#211e24', padding: { x: 3, y: 1 } }).setInteractive({ useHandCursor: true })
        inspect.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.showDetails(!this.detail) })
        this.add(inspect)
        this.setDescription(cardDescription(card, opts.engine))
        this.setSize(w, h); this.setScale(opts.scale ?? 1)
        if (opts.locked) this.setAlpha(0.5)
        if (opts.interactive) {
            this.setInteractive({ hitArea: new Phaser.Geom.Rectangle(this.displayOriginX, this.displayOriginY, w, h), hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true })
            this.on('pointerover', () => this.showDetails(true))
            this.on('pointerout', () => this.showDetails(false))
            this.on('pointerdown', () => this.showDetails(false))
        }
    }
    containsPoint(x: number, y: number): boolean {
        const local = this.getLocalPoint(x, y)
        return local.x >= 0 && local.x <= Card.CARD_WIDTH && local.y >= 0 && local.y <= Card.CARD_HEIGHT
    }
    setSelected(selected: boolean): void { this.border.setStrokeStyle(selected ? 3 : 1, selected ? 0xf4d58a : 0xb7a78a) }
    setCombatPreview(engine: Engine, targetId?: string): void { this.setDescription(cardDescription(this.card, engine, targetId)) }
    private setDescription(text: string): void {
        this.fullDescription = text
        this.inspectHint.setText(this.locked ? 'Locked' : '')
        this.description.setText(text)
        const maxHeight = Card.CARD_HEIGHT - 90
        if (this.description.height <= maxHeight) return
        let shortened = text
        while (this.description.height > maxHeight && shortened.length) {
            shortened = shortened.replace(/\s*\S+\s*$/, '')
            this.description.setText(`${shortened}…`)
        }
        this.inspectHint.setText(this.locked ? 'Locked' : 'Full rules →')
    }
    showDetails(show: boolean): void {
        this.detail?.destroy(true); this.detail = undefined
        if (!show || !this.scene) return
        const def = resolveCard(this.card), width = 224
        const bounds = this.getBounds()
        const x = this.engine ? (bounds.x < 240 ? this.scene.scale.width - width - 12 : 12) : Phaser.Math.Clamp(bounds.centerX - width / 2, 12, this.scene.scale.width - width - 12)
        const title = this.scene.add.text(12, 12, def.name, { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', color: this.card.upgradeLevel ? '#dbefb3' : '#f6e9cf', wordWrap: { width: width - 24 } })
        const body = this.scene.add.text(12, title.height + 25, this.fullDescription, { fontFamily: 'monospace', fontSize: '14px', color: '#f1e8d7', wordWrap: { width: width - 24 }, lineSpacing: 3 })
        const height = body.y + body.height + 12
        const y = this.engine ? 64 : Math.max(12, Math.min(bounds.y - height - 8, this.scene.scale.height - height - 12))
        let depth = 5900
        for (let parent = this.parentContainer; parent; parent = parent.parentContainer) depth = Math.max(depth, parent.depth + 1)
        this.detail = this.scene.add.container(x, y).setDepth(depth)
        this.detail.add([this.scene.add.rectangle(0, 0, width, height, 0x252228).setOrigin(0).setStrokeStyle(1, 0xb7a78a), title, body])
        const close = this.scene.add.text(width - 19, 2, '×', { fontSize: '16px', color: '#f5d78a' }).setInteractive({ useHandCursor: true })
        close.on('pointerdown', () => this.showDetails(false)); this.detail.add(close)
    }
    inspectAtPoint(x: number, y: number): boolean {
        const local = this.getLocalPoint(x, y)
        if (local.x < Card.CARD_WIDTH - 24 || local.y < Card.CARD_HEIGHT - 24) return false
        this.showDetails(true); return true
    }
    getCardInstance(): CardInstance { return this.card }
    destroy(fromScene?: boolean): void { this.detail?.destroy(true); this.detail = undefined; super.destroy(fromScene) }
}
