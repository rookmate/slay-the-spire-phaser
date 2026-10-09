import { access, bindAction } from './accessibility'
import { UI_FONT } from './theme'
import { cardDescription } from '../core/cardText'
import type { Engine } from '../core/engine'
import Phaser from 'phaser'
import { resolveCard } from '../core/cards'
import type { CardInstance } from '../core/state'
import { CARD_SIZE } from './layout'

export interface CardOptions { engine?: Engine; x: number; y: number; scale?: number; interactive?: boolean; locked?: boolean }
const colors = { ironclad: 0x693c30, silent: 0x37452b, defect: 0x345354, watcher: 0x4c3b55, colorless: 0x59513e }

function cardColor(def: ReturnType<typeof resolveCard>): number {
    return def.type === 'curse' ? 0x655068 : def.type === 'status' ? 0x646466 : colors[def.color ?? 'colorless']
}
function artFrame(card: CardInstance, def: ReturnType<typeof resolveCard>): number {
    return /DEFEND|SURVIVOR|VIGILANCE|SHRUG|ARMAMENTS|IMPERVIOUS|ENTRENCH|METALLICIZE/.test(card.defId) ? 1
        : def.color === 'silent' ? 2 : def.color === 'defect' ? 4 : def.color === 'watcher' ? 5
            : def.type === 'attack' ? 0 : def.type === 'power' ? 3 : 1
}

export class Card extends Phaser.GameObjects.Container {
    private card: CardInstance
    private engine?: Engine
    private border: Phaser.GameObjects.Rectangle
    private borderColor: number
    private title: Phaser.GameObjects.Text
    private costText: Phaser.GameObjects.Text
    private typeText: Phaser.GameObjects.Text
    private header: Phaser.GameObjects.Rectangle
    private art?: Phaser.GameObjects.Image
    private description: Phaser.GameObjects.Text
    private fullDescription = ''
    private inspectHint: Phaser.GameObjects.Text
    private detail?: Phaser.GameObjects.Container
    private shade: Phaser.GameObjects.Rectangle
    private locked: boolean
    public static readonly CARD_WIDTH = CARD_SIZE.width
    public static readonly CARD_HEIGHT = CARD_SIZE.height

    constructor(scene: Phaser.Scene, card: CardInstance, opts: CardOptions) {
        super(scene, opts.x, opts.y)
        this.card = card; this.engine = opts.engine
        this.setData('accessCard', true)
        this.locked = !!opts.locked
        const def = resolveCard(card), w = Card.CARD_WIDTH, h = Card.CARD_HEIGHT
        const color = cardColor(def)
        const bg = scene.add.rectangle(0, 0, w, h, 0x211e18).setOrigin(0)
        this.add(bg)
        if (scene.textures.exists('art:cards')) {
            this.art = scene.add.image(w / 2, 67, 'art:cards', artFrame(card, def)).setDisplaySize(w - 8, w - 8)
            this.add(this.art)
        }
        const header = this.header = scene.add.rectangle(0, 0, w, 36, color).setOrigin(0)
        const paper = scene.add.rectangle(4, 96, w - 8, h - 100, 0xe5d8b9).setOrigin(0)
        const rarityColor = def.rarity === 'rare' ? 0xd3b36a : def.rarity === 'uncommon' ? 0x9dbaae : 0x8c7958
        this.borderColor = rarityColor
        this.border = scene.add.rectangle(0, 0, w, h, 0, 0).setOrigin(0).setStrokeStyle(1, rarityColor)
        const title = this.title = scene.add.text(8, 5, def.name, { resolution: 2, fontFamily: UI_FONT, fontSize: '13px', fontStyle: 'bold', color: card.upgradeLevel ? '#e2edb6' : '#fff0d5', wordWrap: { width: w - 38, useAdvancedWrap: true }, lineSpacing: 0 }).setResolution(2)
        const costDisc = scene.add.circle(w - 17, 17, 12, 0x201d16).setStrokeStyle(1, 0xc6a66b)
        const cost = this.costText = scene.add.text(w - 17, 16, def.xCost ? 'X' : String(opts.engine?.getCardCost(card) ?? def.cost), { resolution: 2, fontFamily: UI_FONT, fontSize: '17px', fontStyle: 'bold', color: '#f5d78a' }).setOrigin(0.5).setResolution(2)
        const type = this.typeText = scene.add.text(w / 2, 100, `${def.type}${def.rarity && def.rarity !== 'basic' ? ` · ${def.rarity}` : ''}`, { resolution: 2, fontFamily: UI_FONT, fontSize: '9px', color: '#6b5033' }).setOrigin(0.5, 0).setResolution(2)
        this.description = scene.add.text(10, 115, '', { resolution: 2, fontFamily: UI_FONT, fontSize: '12px', color: '#2d281f', wordWrap: { width: w - 20 }, lineSpacing: 1 }).setResolution(2)
        this.inspectHint = scene.add.text(9, h - 14, opts.locked ? 'Locked' : '', { resolution: 2, fontFamily: UI_FONT, fontSize: '9px', color: '#705531' }).setResolution(2)
        this.add([header, paper, title, costDisc, cost, type, this.description, this.inspectHint, this.border])
        const inspect = scene.add.text(w - 23, h - 21, '?', { resolution: 2, fontFamily: UI_FONT, fontSize: '14px', fontStyle: 'bold', color: '#644923', padding: { x: 5, y: 1 } }).setResolution(2).setInteractive({ useHandCursor: true })
        inspect.on('pointerdown', (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => { event?.stopPropagation(); this.showDetails(!this.detail) })
        this.add(inspect)
        bindAction(inspect, () => this.showDetails(true, true), { id: `inspect:${card.instanceId}`, label: () => `Inspect ${this.accessLabel()}` })
        this.shade = scene.add.rectangle(0, 0, w, h, 0x151512, 0.3).setOrigin(0).setVisible(false)
        this.add(this.shade)
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
    /** Rendered values can change even when the engine mutates the same instance. */
    refresh(card: CardInstance): void {
        this.card = card
        const def = resolveCard(card)
        this.title.setText(def.name)
        const titleColor = card.upgradeLevel ? '#e2edb6' : '#fff0d5'
        if (this.title.style.color !== titleColor) this.title.setColor(titleColor)
        this.costText.setText(def.xCost ? 'X' : String(this.engine?.getCardCost(card) ?? def.cost))
        this.typeText.setText(`${def.type}${def.rarity && def.rarity !== 'basic' ? ` · ${def.rarity}` : ''}`)
        const color = cardColor(def)
        if (this.header.fillColor !== color) this.header.setFillStyle(color)
        const frame = artFrame(card, def)
        if (this.art && String(this.art.frame.name) !== String(frame)) this.art.setFrame(frame)
        this.borderColor = def.rarity === 'rare' ? 0xd3b36a : def.rarity === 'uncommon' ? 0x9dbaae : 0x8c7958
        this.setDescription(cardDescription(card, this.engine))
    }
    containsPoint(x: number, y: number): boolean {
        const local = this.getLocalPoint(x, y)
        return local.x >= 0 && local.x <= Card.CARD_WIDTH && local.y >= 0 && local.y <= Card.CARD_HEIGHT
    }
    setSelected(selected: boolean): void { this.border.setStrokeStyle(selected ? 3 : 1, selected ? 0xf4d58a : this.borderColor) }
    setDimmed(dimmed: boolean): void { this.shade.setVisible(dimmed) }
    setCombatPreview(engine: Engine, targetId?: string): void { this.setDescription(cardDescription(this.card, engine, targetId)) }
    private setDescription(text: string): void {
        if (text === this.fullDescription) return
        this.showDetails(false)
        this.fullDescription = text
        this.inspectHint.setText(this.locked ? 'Locked' : '')
        this.description.setText(text)
        const maxHeight = Card.CARD_HEIGHT - 134
        if (this.description.height <= maxHeight) return
        let shortened = text
        while (this.description.height > maxHeight && shortened.length) {
            shortened = shortened.replace(/\s*\S+\s*$/, '')
            this.description.setText(`${shortened}…`)
        }
        this.inspectHint.setText(this.locked ? 'Locked' : 'Full rules →')
    }
    isShowingDetails(): boolean { return !!this.detail }

    accessLabel(): string {
        const def = resolveCard(this.card)
        return `${def.name}. ${def.type}. ${def.xCost ? 'X' : this.engine?.getCardCost(this.card) ?? def.cost} energy. ${cardDescription(this.card, this.engine)}`
    }

    showDetails(show: boolean, modal = false): void {
        if (show === !!this.detail) { if (show && modal && this.detail) access(this.scene).modal(this.detail, () => this.showDetails(false)); return }
        this.detail?.destroy(true); this.detail = undefined
        if (!show || !this.scene) return
        const def = resolveCard(this.card), width = 224
        const bounds = this.getBounds()
        const x = this.engine ? (bounds.x < 240 ? this.scene.scale.width - width - 12 : 12) : Phaser.Math.Clamp(bounds.centerX - width / 2, 12, this.scene.scale.width - width - 12)
        const title = this.scene.add.text(12, 12, def.name, { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', fontStyle: 'bold', color: this.card.upgradeLevel ? '#dbefb3' : '#f6e9cf', wordWrap: { width: width - 24 } })
        const body = this.scene.add.text(12, title.height + 25, this.fullDescription, { resolution: 2, fontFamily: UI_FONT, fontSize: '15px', color: '#f1e8d7', wordWrap: { width: width - 24 }, lineSpacing: 3 })
        const height = body.y + body.height + 12
        const y = this.engine ? 64 : Math.max(12, Math.min(bounds.y - height - 8, this.scene.scale.height - height - 12))
        let depth = 5900
        for (let parent = this.parentContainer; parent; parent = parent.parentContainer) depth = Math.max(depth, parent.depth + 1)
        this.detail = this.scene.add.container(x, y).setDepth(depth)
        this.detail.add([this.scene.add.rectangle(0, 0, width, height, 0x24231e).setOrigin(0).setStrokeStyle(1, 0xc3a771), title, body])
        const close = this.scene.add.text(width - 19, 2, '×', { fontSize: '16px', color: '#f5d78a' }).setInteractive({ useHandCursor: true })
        close.on('pointerdown', () => this.showDetails(false)); this.detail.add(close)
        bindAction(close, () => this.showDetails(false), { label: `Close ${def.name} details` })
        if (modal) access(this.scene).modal(this.detail, () => this.showDetails(false))
    }
    inspectAtPoint(x: number, y: number): boolean {
        const local = this.getLocalPoint(x, y)
        if (local.x < Card.CARD_WIDTH - 24 || local.y < Card.CARD_HEIGHT - 24) return false
        this.showDetails(true); return true
    }
    getCardInstance(): CardInstance { return this.card }
    destroy(fromScene?: boolean): void { this.detail?.destroy(true); this.detail = undefined; super.destroy(fromScene) }
}
