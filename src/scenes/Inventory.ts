import Phaser from 'phaser'
import { POTION_DEFS, potionMultiplier, usePotionOutsideCombat } from '../core/potions'
import { getRunDestination } from '../core/progression'
import { getRelicDisplayName, RELIC_DEFS } from '../core/relics'
import { saveRun, type RunState } from '../core/run'
import { CardGrid } from '../ui/CardGrid'
import { menuButton, menuText } from '../ui/menu'
export class InventoryScene extends Phaser.Scene {
    run!: RunState
    private tab: 'deck' | 'relics' | 'potions' = 'deck'
    private page = 0
    constructor() { super('Inventory') }
    create(data: { run: RunState }): void { this.run = data.run; this.page = 0; this.render() }
    private render(): void {
        this.children.removeAll(true)
        this.add.text(24, 16, `${this.run.player.hp}/${this.run.player.maxHp} HP · ${this.run.gold} Gold`, menuText)
        ;(['deck', 'relics', 'potions'] as const).forEach((tab, i) => menuButton(this, 24 + i * 175, 50, tab[0].toUpperCase() + tab.slice(1), () => { this.tab = tab; this.page = 0; this.render() }))
        if (this.tab === 'deck') new CardGrid(this, this.add.container(0, 0), this.run.deck, 104, () => {})
        if (this.tab === 'relics') {
            this.run.relics.slice(this.page * 5, this.page * 5 + 5).forEach((id, i) => {
                this.add.text(24, 108 + i * 53, getRelicDisplayName(this.run, id), { ...menuText, color: '#dbc5a3' })
                this.add.text(24, 130 + i * 53, RELIC_DEFS[id].description, { ...menuText, fontSize: '12px', wordWrap: { width: 740 } })
            })
            menuButton(this, 24, 399, 'Previous', () => { this.page--; this.render() }, this.page > 0)
            menuButton(this, 164, 399, 'Next', () => { this.page++; this.render() }, (this.page + 1) * 5 < this.run.relics.length)
        }
        if (this.tab === 'potions') {
            if (!this.run.potions.length) this.add.text(24, 112, 'No potions.', menuText)
            this.run.potions.forEach((id, i) => {
                const y = 104 + i * 56, def = POTION_DEFS[id]
                this.add.text(24, y, `${def.name}${potionMultiplier(this.run, id) === 2 ? ' ×2' : ''}`, menuText)
                this.add.text(24, y + 22, def.description, { ...menuText, fontSize: '12px', wordWrap: { width: 510 } })
                menuButton(this, 560, y, 'Use', () => { if (usePotionOutsideCombat(this.run, i)) { saveRun(this.run); this.render() } }, !!def.useOutsideCombat)
                menuButton(this, 650, y, 'Discard', () => { this.run.potions.splice(i, 1); saveRun(this.run); this.render() })
            })
        }
        menuButton(this, 650, 399, 'Back', () => { const next = getRunDestination(this.run); this.scene.start(next.scene, next.data) })
    }
}
