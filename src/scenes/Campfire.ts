import { healRun } from '../core/health'
import Phaser from 'phaser'
import { getAscensionRestHealFraction } from '../core/ascension'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { canUpgradeCard } from '../core/cards'
import { canRestAtCampfire } from '../core/relics'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'
import { completeRoom } from '../core/progression'

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
        const canRest = canRestAtCampfire(this.run)
        this.add.text(16, 16, 'Campfire', style)

        const restLabel = canRest ? `Rest (heal ${healPercent}% max HP)` : 'Rest (Blocked by Coffee Dripper)'
        const restButton = this.add.text(16, 60, restLabel, {
            ...style,
            backgroundColor: canRest ? '#333' : '#555',
            color: canRest ? '#ffffff' : '#bbbbbb',
            padding: { x: 8, y: 6 },
        })
        if (canRest) {
            restButton.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    const heal = Math.max(1, Math.floor(this.run.player.maxHp * healFraction))
                    healRun(this.run, heal)
                    this.leave()
                })
        }

        const canSmith = this.run.deck.some(canUpgradeCard)
        const smith = this.add.text(16, 110, canSmith ? 'Smith (upgrade a card)' : 'Smith (no upgrades available)', {
            ...style, backgroundColor: canSmith ? '#333' : '#555', color: canSmith ? '#fff' : '#bbb', padding: { x: 8, y: 6 },
        })
        if (canSmith) smith.setInteractive({ useHandCursor: true })
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
        if (!this.run.keys.ruby) this.add.text(16, 160, 'Recall (obtain Ruby Key)', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => { this.run.keys.ruby = true; this.leave() })
        this.add.text(16, 210, 'Skip', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.leave())
        this.events.once('shutdown', () => this.selector.destroy())
    }

    private leave(): void {
        completeRoom(this.run)
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
