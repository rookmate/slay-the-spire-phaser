import { UI_FONT, roomBackdrop } from '../ui/theme'
import { addRunMenu } from '../ui/runMenu'
import Phaser from 'phaser'
import { canRemoveCard, createCardInstance } from '../core/cards'
import { loadMeta, type MetaState } from '../core/meta'
import { POTION_DEFS } from '../core/potions'
import { completeRoom, type ShopInventory } from '../core/progression'
import { canObtainPotion, RELIC_DEFS } from '../core/relics'
import { saveRun, type RunState } from '../core/run'
import { generateShop, normalizeShop, purchaseRemoval, purchaseShopItem, removalPrice, shopPrice } from '../core/shop'
import { Card } from '../ui/Card'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class ShopScene extends Phaser.Scene {
    run!: RunState
    private inventory!: ShopInventory
    private selector!: DeckSelectionOverlay
    private meta!: MetaState
    constructor() { super('Shop') }
    create(data: { run: RunState }): void {
        this.run = data.run
        this.meta = loadMeta()
        this.selector = new DeckSelectionOverlay(this)
        this.inventory = normalizeShop(this.run, (this.run.pendingRoom?.scene === 'Shop' && this.run.pendingRoom.inventory) || generateShop(this.run, this.meta))
        this.run.pendingRoom = { scene: 'Shop', inventory: this.inventory }
        saveRun(this.run)
        this.render()
        this.events.once('shutdown', () => this.selector.destroy())
    }
    private button(x: number, y: number, label: string, enabled: boolean, action: () => void): void {
        const text = this.add.text(x, y, label, { resolution: 2, fontFamily: UI_FONT, fontSize: '14px', color: enabled ? '#fff' : '#888', backgroundColor: '#353126', padding: { x: 6, y: 6 } })
        if (enabled) text.setInteractive({ useHandCursor: true }).on('pointerdown', action)
    }
    private buy(kind: 'cards' | 'relics' | 'potions', index: number): void {
        if (!purchaseShopItem(this.run, this.meta, this.inventory, kind, index)) return
        saveRun(this.run)
        if (this.run.pendingAcquisitions?.length) this.scene.start('RelicAcquisition', { run: this.run })
        else if (this.run.pendingRoom?.scene === 'Rewards') this.scene.start('Rewards', { run: this.run, rewards: this.run.pendingRoom.rewards })
        else this.render()
    }
    private render(): void {
        this.children.removeAll(true)
        roomBackdrop(this)
        addRunMenu(this, this.run)
        this.add.text(18, 16, `Merchant    ${this.run.gold} Gold    A${this.run.asc}`, { resolution: 2, fontFamily: UI_FONT, fontSize: '22px', color: '#fff' })
        this.inventory.cards.forEach((id, i) => {
            const x = 18 + i * 109
            this.add.existing(new Card(this, createCardInstance(id), { x, y: 56, scale: 0.70 }))
            const price = shopPrice(this.run, this.inventory.cardPrices![i])
            this.button(x, 190, `${i === this.inventory.saleIndex ? 'Sale ' : ''}${price} G`, this.run.gold >= price, () => this.buy('cards', i))
        })
        this.inventory.relics!.forEach((id, i) => {
            const x = 18 + i * 256
            const def = RELIC_DEFS[id]
            const price = shopPrice(this.run, this.inventory.relicPrices![i])
            this.button(x, 235, `${def.name} · ${price} G`, this.run.gold >= price, () => this.buy('relics', i))
            this.add.text(x, 270, def.description, { resolution: 2, fontFamily: UI_FONT, fontSize: '12px', color: '#bdb29d', wordWrap: { width: 236 } })
        })
        this.inventory.potions.forEach((id, i) => {
            const price = shopPrice(this.run, this.inventory.potionPrices![i])
            this.button(18 + i * 256, 325, `${POTION_DEFS[id].name} · ${price} G`, this.run.gold >= price && canObtainPotion(this.run), () => this.buy('potions', i))
            this.add.text(18 + i * 256, 359, POTION_DEFS[id].description, { resolution: 2, fontFamily: UI_FONT, fontSize: '12px', color: '#bdb29d', wordWrap: { width: 236 } })
        })
        const cost = removalPrice(this.run)
        this.button(18, 401, this.inventory.removalUsed ? 'Card removal used' : `Remove a card · ${cost} G`, !this.inventory.removalUsed && this.run.gold >= cost && this.run.deck.some(canRemoveCard), () => this.selector.open({
            title: 'Choose a card to remove', cards: this.run.deck, filter: canRemoveCard, onSelect: card => {
                if (purchaseRemoval(this.run, this.inventory, card.instanceId)) { saveRun(this.run); this.render() }
            },
        }))
        this.button(680, 401, 'Leave', true, () => { completeRoom(this.run); saveRun(this.run); this.scene.start('Map', { run: this.run }) })
    }
}
