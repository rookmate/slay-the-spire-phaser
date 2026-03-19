import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { EVENT_DEFS, generateEvent } from '../core/events'
import { canUpgradeCard } from '../core/cards'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class EventScene extends Phaser.Scene {
    run!: RunState
    private selector!: DeckSelectionOverlay

    constructor() {
        super('Event')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.selector = new DeckSelectionOverlay(this)
        const eventId = generateEvent(`${this.run.seed}-event-${this.run.mapProgress?.currentNodeId ?? this.run.floor}`)
        const event = EVENT_DEFS[eventId]
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }

        this.add.text(16, 16, event.title, { ...style, fontSize: '24px' })
        this.add.text(16, 56, event.body, style)

        if (eventId === 'WORLD_OF_GOOP') this.renderWorldOfGoop(style)
        if (eventId === 'CLERIC') this.renderCleric(style)
        if (eventId === 'UPGRADE_SHRINE') this.renderUpgradeShrine(style)
    }

    private renderWorldOfGoop(style: Phaser.Types.GameObjects.Text.TextStyle): void {
        this.makeChoice(16, 110, 'Reach in (-11 HP, +75 gold)', style, () => {
            this.run.player.hp = Math.max(1, this.run.player.hp - 11)
            this.run.gold += 75
            this.leave()
        })
        this.makeChoice(16, 160, 'Leave', style, () => this.leave())
    }

    private renderCleric(style: Phaser.Types.GameObjects.Text.TextStyle): void {
        this.makeChoice(16, 110, 'Heal (35 gold)', style, () => {
            if (this.run.gold < 35) return
            this.run.gold -= 35
            this.run.player.hp = Math.min(this.run.player.maxHp, this.run.player.hp + Math.round(this.run.player.maxHp * 0.25))
            this.leave()
        })
        this.makeChoice(16, 160, 'Purge (50 gold)', style, () => {
            if (this.run.gold < 50) return
            this.selector.open({
                title: 'Choose a card to remove',
                cards: this.run.deck,
                onSelect: (_card, index) => {
                    this.run.gold -= 50
                    this.run.deck.splice(index, 1)
                    this.leave()
                },
            })
        })
        this.makeChoice(16, 210, 'Leave', style, () => this.leave())
    }

    private renderUpgradeShrine(style: Phaser.Types.GameObjects.Text.TextStyle): void {
        this.makeChoice(16, 110, 'Upgrade a card', style, () => {
            this.selector.open({
                title: 'Choose a card to upgrade',
                cards: this.run.deck,
                filter: (card) => canUpgradeCard(card),
                onSelect: (card, index) => {
                    this.run.deck[index] = {
                        ...card,
                        upgradeLevel: card.defId === 'SEARING_BLOW' ? card.upgradeLevel + 1 : 1,
                    }
                    this.leave()
                },
            })
        })
        this.makeChoice(16, 160, 'Gain 15 max HP', style, () => {
            this.run.player.maxHp += 15
            this.run.player.hp += 15
            this.leave()
        })
    }

    private makeChoice(x: number, y: number, label: string, style: Phaser.Types.GameObjects.Text.TextStyle, onClick: () => void): void {
        this.add.text(x, y, label, { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', onClick)
    }

    private leave(): void {
        this.run.floor += 1
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
