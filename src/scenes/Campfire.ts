import Phaser from 'phaser'
import { getAscensionRestHealFraction } from '../core/ascension'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { canUpgradeCard } from '../core/cards'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class CampfireScene extends Phaser.Scene {
    run!: RunState
    private selector!: DeckSelectionOverlay

    constructor() {
        super('Campfire')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.selector = new DeckSelectionOverlay(this)
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        const healFraction = getAscensionRestHealFraction(this.run.asc)
        const healPercent = Math.round(healFraction * 100)
        this.add.text(16, 16, 'Campfire', style)

        this.add.text(16, 60, `Rest (heal ${healPercent}% max HP)`, { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                const heal = Math.max(1, Math.floor(this.run.player.maxHp * healFraction))
                this.run.player.hp = Math.min(this.run.player.maxHp, this.run.player.hp + heal)
                this.leave()
            })

        this.add.text(16, 110, 'Smith (upgrade a card)', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
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
    }

    private leave(): void {
        this.run.floor += 1
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
