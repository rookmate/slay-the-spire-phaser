import Phaser from 'phaser'
import { canUpgradeCard, createCardInstance, resolveCard } from '../core/cards'
import { loadMeta, type MetaState } from '../core/meta'
import {
    applyNeowOption,
    getNeowOptionById,
    getNeowRareCardChoices,
    getRandomNeowRelic,
    rollNeowOptions,
    type NeowOption,
} from '../core/neow'
import { RELIC_DEFS } from '../core/relics'
import { saveRun, type RunState } from '../core/run'
import { Card } from '../ui/Card'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class NeowScene extends Phaser.Scene {
    private run!: RunState
    private meta!: MetaState
    private selector!: DeckSelectionOverlay
    private options: NeowOption[] = []
    private rareChoiceOverlay?: Phaser.GameObjects.Container

    constructor() {
        super('Neow')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.meta = loadMeta()
        this.selector = new DeckSelectionOverlay(this)
        this.options = rollNeowOptions(this.run.neowSeed)
        this.render()
    }

    private render(): void {
        const titleStyle = { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }
        const bodyStyle = { fontFamily: 'monospace', fontSize: '15px', color: '#bcbcbc' }

        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x151515, 1).setOrigin(0, 0)
        this.add.text(20, 18, 'Neow', titleStyle)
        this.add.text(20, 52, 'Choose one blessing. Two are clean. Two cost you later.', bodyStyle)

        this.options.forEach((option, index) => this.renderOption(option, index))
    }

    private renderOption(option: NeowOption, index: number): void {
        const x = 20 + (index % 2) * 390
        const y = 96 + Math.floor(index / 2) * 210
        const panel = this.add.container(x, y)
        const bgColor = option.category === 'tradeoff' ? 0x2f2028 : 0x1f1f1f
        const borderColor = option.category === 'tradeoff' ? 0x8f5a76 : 0x4d4d4d
        const panelBg = this.add.rectangle(0, 0, 360, 178, bgColor, 1).setOrigin(0, 0).setStrokeStyle(1, borderColor)
        const title = this.add.text(14, 12, option.label, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        })
        const description = this.add.text(14, 42, option.description, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#c4c4c4',
            wordWrap: { width: 220 },
        })
        const footer = this.add.text(14, 146, option.category === 'tradeoff' ? 'Tradeoff' : 'Benefit', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: option.category === 'tradeoff' ? '#d9bdd9' : '#b2d1b2',
        })
        panel.add([panelBg, title, description, footer])

        this.renderOptionPreview(option, panel)
        panelBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.chooseOption(option))
        title.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.chooseOption(option))
        description.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.chooseOption(option))
    }

    private renderOptionPreview(option: NeowOption, panel: Phaser.GameObjects.Container): void {
        if (option.id === 'GAIN_COMMON_RELIC_REGRET') {
            const relicId = getRandomNeowRelic(`${this.run.neowSeed}-${option.id}`, this.run, this.meta)
            const relicText = this.add.text(240, 18, RELIC_DEFS[relicId].name, {
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#2f2f2f',
                padding: { x: 6, y: 4 },
            })
            const curseText = this.add.text(240, 52, 'Regret: lose HP equal to cards in hand at end of turn.', {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#f0c9e8',
                wordWrap: { width: 105 },
            })
            panel.add([relicText, curseText])
            return
        }
        if (option.id === 'GAIN_RARE_CARD_PAIN') {
            const curseText = this.add.text(240, 18, 'Pain', {
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#ffffff',
                backgroundColor: '#4b173c',
                padding: { x: 6, y: 4 },
            })
            const body = this.add.text(240, 52, 'Whenever you play a card, lose 1 HP.', {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#f0c9e8',
                wordWrap: { width: 105 },
            })
            panel.add([curseText, body])
            return
        }
        if (option.preview?.curseId) {
            const curse = resolveCard(createCardInstance(option.preview.curseId))
            const card = new Card(this, createCardInstance(option.preview.curseId), { x: 234, y: 16, scale: 0.75 })
            panel.add(card)
            const note = this.add.text(240, 150, curse.name, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#f0c9e8',
            })
            panel.add(note)
        }
    }

    private chooseOption(option: NeowOption): void {
        if (option.requiresSelection === 'remove') {
            this.selector.open({
                title: 'Choose a card to remove',
                cards: this.run.deck,
                onSelect: (card) => {
                    applyNeowOption(this.run, option.id, { removeInstanceId: card.instanceId })
                    this.leave()
                },
            })
            return
        }

        if (option.requiresSelection === 'upgrade') {
            this.selector.open({
                title: 'Choose a card to upgrade',
                cards: this.run.deck,
                filter: (card) => canUpgradeCard(card),
                onSelect: (card) => {
                    applyNeowOption(this.run, option.id, { upgradeInstanceId: card.instanceId })
                    this.leave()
                },
            })
            return
        }

        if (option.requiresSelection === 'rare_card') {
            this.openRareChoice(option)
            return
        }

        if (option.id === 'GAIN_COMMON_RELIC_REGRET') {
            const rewardRelicId = getRandomNeowRelic(`${this.run.neowSeed}-${option.id}`, this.run, this.meta)
            applyNeowOption(this.run, option.id, { rewardRelicId })
            this.leave()
            return
        }

        applyNeowOption(this.run, option.id)
        this.leave()
    }

    private openRareChoice(option: NeowOption): void {
        this.rareChoiceOverlay?.destroy(true)
        const overlay = this.add.container(0, 0).setDepth(5000)
        this.rareChoiceOverlay = overlay

        const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.84).setOrigin(0, 0)
        overlay.add(bg)
        overlay.add(this.add.text(24, 20, `${getNeowOptionById(option.id).label}: pick a rare card`, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffffff',
        }))

        const choices = getNeowRareCardChoices(`${this.run.neowSeed}-${option.id}`, this.meta)
        const startX = this.scale.width / 2 - ((choices.length - 1) * 140) / 2
        choices.forEach((cardId, index) => {
            const view = new Card(this, createCardInstance(cardId), {
                x: startX + index * 140,
                y: 110,
                interactive: true,
            })
            view.on('pointerdown', () => {
                applyNeowOption(this.run, option.id, { rewardCardId: cardId })
                this.rareChoiceOverlay?.destroy(true)
                this.rareChoiceOverlay = undefined
                this.leave()
            })
            overlay.add(view)
        })
    }

    private leave(): void {
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
