import { access, bindAction, actionButton } from './accessibility'
import { UI_FONT } from './theme'
import type Phaser from 'phaser'
import type { CardInstance } from '../core/state'
import { Card } from './Card'
import { CARD_SIZE, cardGridLayout } from './layout'

/** A bounded page of cards; the parent overlay owns its lifetime. */
export class CardGrid {
    private page = 0
    private container: Phaser.GameObjects.Container

    private scene: Phaser.Scene
    private cards: CardInstance[]
    private top: number
    private onSelect?: (card: CardInstance) => void
    private eligible: (card: CardInstance) => boolean
    private selected: (card: CardInstance) => boolean

    constructor(
        scene: Phaser.Scene,
        parent: Phaser.GameObjects.Container,
        cards: CardInstance[],
        top: number,
        onSelect?: (card: CardInstance) => void,
        eligible: (card: CardInstance) => boolean = () => true,
        selected: (card: CardInstance) => boolean = () => false,
    ) {
        this.scene = scene
        this.cards = cards
        this.top = top
        this.onSelect = onSelect
        this.eligible = eligible
        this.selected = selected
        this.container = scene.add.container(0, 0)
        parent.add(this.container)
        this.refresh()
    }

    dismissInspection(): boolean {
        const inspected = this.container.list.filter((view): view is Card => view instanceof Card && view.isShowingDetails())
        inspected.forEach(view => view.showDetails(false))
        return inspected.length > 0
    }

    refresh(): void {
        this.container.removeAll(true)
        const layout = cardGridLayout(this.scene.scale.width, this.scene.scale.height, this.top)
        const pages = Math.max(1, Math.ceil(this.cards.length / layout.pageSize))
        this.page = Math.min(this.page, pages - 1)
        const start = this.page * layout.pageSize
        this.cards.slice(start, start + layout.pageSize).forEach((card, index) => {
            const eligible = this.eligible(card)
            const view = new Card(this.scene, card, {
                x: layout.x + (index % layout.columns) * (CARD_SIZE.width + 12),
                y: layout.y + Math.floor(index / layout.columns) * (CARD_SIZE.height + 12),
                interactive: eligible,
            })
            view.setAlpha(eligible ? 1 : 0.4)
            view.setSelected(this.selected(card))
            if (this.onSelect) view.on('pointerdown', () => this.onSelect?.(card))
            this.container.add(view)
            if (this.onSelect) bindAction(view, () => this.onSelect?.(card), { label: () => `Select ${view.accessLabel()}`, id: `select:${card.instanceId}`, enabled: () => this.eligible(card), pressed: () => this.selected(card) })
        })

        const style = { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: '#fff', padding: { x: 10, y: 7 } }
        this.container.add(this.scene.add.text(120, layout.footerY, `${this.page + 1} / ${pages}`, style))
        for (const [label, x, delta] of [['Previous', 20, -1], ['Next', 220, 1]] as const) {
            const enabled = this.page + delta >= 0 && this.page + delta < pages
            const button = this.scene.add.text(x, layout.footerY, label, { ...style, backgroundColor: '#353126' }).setAlpha(enabled ? 1 : 0.35)
            actionButton(button, label, () => {
                this.page += delta
                this.refresh()
            }, enabled)
            this.container.add(button)
        }
        access(this.scene).refresh()
    }
}
