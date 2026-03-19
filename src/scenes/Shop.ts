import Phaser from 'phaser'
import type { RunState, RelicId } from '../core/run'
import { saveRun } from '../core/run'
import { RNG } from '../core/rng'
import { CARD_DEFS } from '../core/cards'
import { MVP_RELIC_POOL, RELIC_DEFS, applyRelicAcquisition } from '../core/relics'
import { POTION_DEFS, type PotionId } from '../core/potions'
import { Card } from '../ui/Card'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

interface ShopInventory {
    cards: string[]
    relic: RelicId
    potions: PotionId[]
}

export class ShopScene extends Phaser.Scene {
    run!: RunState
    private inventory!: ShopInventory
    private selector!: DeckSelectionOverlay

    constructor() {
        super('Shop')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.selector = new DeckSelectionOverlay(this)
        this.inventory = this.generateInventory()
        this.render()
    }

    private render(): void {
        this.children.removeAll()
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, `Shop (gold ${this.run.gold})`, style)
        this.add.text(16, this.scale.height - 44, 'Leave', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.run.floor += 1
                saveRun(this.run)
                this.scene.start('Map', { run: this.run })
            })

        this.renderCards()
        this.renderConsumables(style)
        this.renderRemove(style)
    }

    private renderCards(): void {
        const startX = 20
        const y = 70
        const spacing = 130
        this.inventory.cards.forEach((cardId, index) => {
            const rarity = CARD_DEFS[cardId].rarity
            const cost = rarity === 'common' ? 50 : rarity === 'uncommon' ? 75 : 150
            const view = new Card(this, { defId: cardId, upgraded: false }, {
                x: startX + index * spacing,
                y,
                interactive: false,
            })
            this.add.existing(view)
            const buy = this.add.text(startX + index * spacing, y + 188, `Buy (${cost})`, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#ffffff',
                backgroundColor: this.run.gold >= cost ? '#333' : '#666',
                padding: { x: 6, y: 4 },
            }).setInteractive({ useHandCursor: true })
            buy.on('pointerdown', () => {
                if (this.run.gold < cost) return
                this.run.gold -= cost
                this.run.deck.push({ defId: cardId, upgraded: false })
                this.inventory.cards.splice(index, 1)
                saveRun(this.run)
                this.render()
            })
        })
    }

    private renderConsumables(style: Phaser.Types.GameObjects.Text.TextStyle): void {
        const leftX = 20
        const baseY = 300
        this.add.text(leftX, baseY, `Relic: ${RELIC_DEFS[this.inventory.relic].name} (150)`, style)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.run.gold < 150) return
                this.run.gold -= 150
                applyRelicAcquisition(this.run, this.inventory.relic)
                this.inventory.relic = MVP_RELIC_POOL.find(id => !this.run.relics.includes(id)) ?? this.inventory.relic
                saveRun(this.run)
                this.render()
            })

        this.inventory.potions.forEach((potion, index) => {
            this.add.text(leftX, baseY + 40 + index * 32, `${POTION_DEFS[potion].name} (50)`, style)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.run.gold < 50 || this.run.potions.length >= this.run.maxPotionSlots) return
                    this.run.gold -= 50
                    this.run.potions.push(potion)
                    this.inventory.potions.splice(index, 1)
                    saveRun(this.run)
                    this.render()
                })
        })
    }

    private renderRemove(style: Phaser.Types.GameObjects.Text.TextStyle): void {
        this.add.text(420, 300, `Remove a card (${this.run.merchantRemoveCost})`, {
            ...style,
            backgroundColor: '#333',
            padding: { x: 8, y: 6 },
        }).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (this.run.gold < this.run.merchantRemoveCost || this.run.deck.length === 0) return
                this.selector.open({
                    title: 'Choose a card to remove',
                    cards: this.run.deck,
                    onSelect: (_card, index) => {
                        this.run.gold -= this.run.merchantRemoveCost
                        this.run.merchantRemoveCost += 25
                        this.run.deck.splice(index, 1)
                        saveRun(this.run)
                        this.render()
                    },
                })
            })
    }

    private generateInventory(): ShopInventory {
        const nodeId = this.run.mapProgress?.currentNodeId ?? `floor-${this.run.floor}`
        const rng = new RNG(`${this.run.seed}-shop-${nodeId}`)
        const cards = [
            ...this.pickCards(rng, 'common', 3),
            ...this.pickCards(rng, 'uncommon', 1),
            ...this.pickCards(rng, 'rare', 1),
        ]
        const relicPool = MVP_RELIC_POOL.filter(id => !this.run.relics.includes(id))
        const relic = relicPool.length > 0 ? relicPool[rng.int(0, relicPool.length - 1)] : MVP_RELIC_POOL[rng.int(0, MVP_RELIC_POOL.length - 1)]
        const potions = [this.pickPotion(rng), this.pickPotion(rng)]
        return { cards, relic, potions }
    }

    private pickCards(rng: RNG, rarity: 'common' | 'uncommon' | 'rare', count: number): string[] {
        const pool = Object.values(CARD_DEFS).filter(card => card.poolEnabled && card.rarity === rarity).map(card => card.id)
        const picked = new Set<string>()
        while (picked.size < Math.min(count, pool.length)) {
            picked.add(pool[rng.int(0, pool.length - 1)])
        }
        return [...picked]
    }

    private pickPotion(rng: RNG): PotionId {
        const ids = Object.keys(POTION_DEFS) as PotionId[]
        return ids[rng.int(0, ids.length - 1)]
    }
}
