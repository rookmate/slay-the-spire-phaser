import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'
import { applyNeowOption, getRandomNeowCommonCard, getRandomNeowRelic, rollNeowOptions, type NeowOption } from '../core/neow'
import { canUpgradeCard, createCardInstance } from '../core/cards'
import { RELIC_DEFS } from '../core/relics'
import { Card } from '../ui/Card'

export class NeowScene extends Phaser.Scene {
    private run!: RunState
    private selector!: DeckSelectionOverlay

    constructor() {
        super('Neow')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.selector = new DeckSelectionOverlay(this)
        const options = rollNeowOptions(this.run.neowSeed)
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }

        this.add.text(16, 16, 'Neow', { ...style, fontSize: '24px' })
        this.add.text(16, 46, 'Choose your blessing.', { ...style, fontSize: '14px', color: '#bbbbbb' })

        options.forEach((option, index) => this.renderOption(option, index))
    }

    private renderOption(option: NeowOption, index: number): void {
        const y = 92 + index * 82
        const button = this.add.text(16, y, option.label, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#2c2c2c',
            padding: { x: 10, y: 8 },
        }).setInteractive({ useHandCursor: true })

        this.add.text(16, y + 34, option.description, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#b0b0b0',
        })

        if (option.id === 'GAIN_COMMON_CARD') {
            const rewardCardId = getRandomNeowCommonCard(`${this.run.neowSeed}-${option.id}`)
            const preview = new Card(this, createCardInstance(rewardCardId), { x: 360, y: y - 8, scale: 0.85 })
            this.add.existing(preview)
            button.on('pointerdown', () => {
                applyNeowOption(this.run, option.id, { rewardCardId })
                this.leave()
            })
            return
        }

        if (option.id === 'GAIN_COMMON_RELIC') {
            const rewardRelicId = getRandomNeowRelic(`${this.run.neowSeed}-${option.id}`, this.run)
            this.add.text(360, y + 6, RELIC_DEFS[rewardRelicId].name, {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#f0f0f0',
                backgroundColor: '#2c2c2c',
                padding: { x: 8, y: 6 },
            })
            button.on('pointerdown', () => {
                applyNeowOption(this.run, option.id, { rewardRelicId })
                this.leave()
            })
            return
        }

        if (option.id === 'REMOVE_CARD') {
            button.on('pointerdown', () => {
                this.selector.open({
                    title: 'Choose a card to remove',
                    cards: this.run.deck,
                    onSelect: (_card, removeIndex) => {
                        applyNeowOption(this.run, option.id, { removeIndex })
                        this.leave()
                    },
                })
            })
            return
        }

        if (option.id === 'UPGRADE_CARD') {
            button.on('pointerdown', () => {
                this.selector.open({
                    title: 'Choose a card to upgrade',
                    cards: this.run.deck,
                    filter: (card) => canUpgradeCard(card),
                    onSelect: (_card, upgradeIndex) => {
                        applyNeowOption(this.run, option.id, { upgradeIndex })
                        this.leave()
                    },
                })
            })
            return
        }

        button.on('pointerdown', () => {
            applyNeowOption(this.run, option.id)
            this.leave()
        })
    }

    private leave(): void {
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
