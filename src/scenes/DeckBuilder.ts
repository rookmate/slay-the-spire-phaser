import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { CARD_DEFS, createCardInstance, canUpgradeCard } from '../core/cards'
import { getEffectiveUnlockedCardIds, loadMeta } from '../core/meta'
import type { RunState } from '../core/run'
import type { CardColor } from '../core/state'
import { CardGrid } from '../ui/CardGrid'
import { menuButton, menuText } from '../ui/menu'
export class DeckBuilderScene extends Phaser.Scene {
    run!: RunState
    private color: CardColor | 'status' | 'curse' = 'ironclad'
    private upgraded = false
    constructor() { super('DeckBuilder') }
    create(data: { run: RunState }): void { this.run = data.run; this.render() }
    private render(): void {
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        this.add.text(24, 18, 'Card Library', { ...menuText, fontSize: '24px' })
        ;(['ironclad', 'silent', 'defect', 'watcher', 'colorless', 'curse', 'status'] as const).forEach((color, i) => menuButton(this, 16 + i * 111, 56, color[0].toUpperCase() + color.slice(1), () => { this.color = color; this.render() }))
        const unlocked = getEffectiveUnlockedCardIds(loadMeta())
        const cards = Object.values(CARD_DEFS).filter(card => card.color === this.color || card.type === this.color).sort((a, b) => a.name.localeCompare(b.name)).map(card => createCardInstance(card.id, this.upgraded && canUpgradeCard(createCardInstance(card.id)) ? 1 : 0))
        new CardGrid(this, this.add.container(0, 0), cards, 105, undefined, card => unlocked.has(card.defId) || !CARD_DEFS[card.defId].poolEnabled)
        menuButton(this, 405, 399, this.upgraded ? 'Show base' : 'Show upgrades', () => { this.upgraded = !this.upgraded; this.render() })
        menuButton(this, 650, 399, 'Back', () => this.scene.start('MainMenu'))
    }
}
