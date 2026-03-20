import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import type { RewardBundle, RewardItem } from '../core/rewards'
import { createCardInstance } from '../core/cards'
import { Card } from '../ui/Card'
import { applyRelicAcquisition, RELIC_DEFS } from '../core/relics'
import { POTION_DEFS } from '../core/potions'

export class RewardsScene extends Phaser.Scene {
    run!: RunState
    private rewards!: RewardBundle
    private pendingCardReward = false
    private pendingPotionReward?: string
    private continueButton?: Phaser.GameObjects.Text
    private infoTexts: Phaser.GameObjects.Text[] = []
    private choiceCards: Card[] = []
    private potionTexts: Phaser.GameObjects.Text[] = []

    constructor() {
        super('Rewards')
    }

    create(data: { run: RunState; rewards: RewardBundle }): void {
        this.run = data.run
        this.rewards = data.rewards
        this.infoTexts = []
        this.choiceCards = []
        this.potionTexts = []
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }

        this.add.text(this.scale.width / 2, 20, 'Rewards', { ...style, fontSize: '24px' }).setOrigin(0.5, 0)

        let y = 60
        for (const item of this.rewards.items) {
            if (item.kind === 'gold') {
                this.run.gold += item.amount
                this.infoTexts.push(this.add.text(24, y, `Gold +${item.amount}`, style))
                y += 28
            } else if (item.kind === 'relic') {
                applyRelicAcquisition(this.run, item.relicId)
                this.infoTexts.push(this.add.text(24, y, `Relic: ${RELIC_DEFS[item.relicId].name}`, style))
                y += 28
            } else if (item.kind === 'potion') {
                this.pendingPotionReward = item.potionId
            } else if (item.kind === 'cards') {
                this.pendingCardReward = true
                this.run.cardsSeen = (this.run.cardsSeen ?? 0) + item.choices.length
                this.renderCardChoices(item)
            } else if (item.kind === 'boss_relics') {
                this.infoTexts.push(this.add.text(24, y, 'Boss relic reward is handled in the next scene.', style))
                y += 28
            }
        }

        if (this.pendingPotionReward) this.renderPotionReward(this.pendingPotionReward)

        this.continueButton = this.add.text(this.scale.width / 2, this.scale.height - 36, 'Continue', {
            ...style,
            backgroundColor: '#666',
            padding: { x: 12, y: 8 },
        }).setOrigin(0.5, 0.5)
        this.continueButton.on('pointerdown', () => {
            if (!this.canContinue()) return
            this.run.floor += 1
            saveRun(this.run)
            this.scene.start('Map', { run: this.run })
        })
        this.updateContinueButton()
    }

    private renderCardChoices(item: Extract<RewardItem, { kind: 'cards' }>): void {
        const cardY = this.scale.height / 2 - 30
        const spacing = 140
        const startX = this.scale.width / 2 - ((item.choices.length - 1) * spacing) / 2

        this.add.text(this.scale.width / 2, cardY - 90, 'Choose a card or skip', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        }).setOrigin(0.5, 0)

        item.choices.forEach((id, index) => {
            const view = new Card(this, createCardInstance(id), {
                x: startX + index * spacing,
                y: cardY,
                interactive: true,
            })
            view.on('pointerdown', () => {
                if (!this.pendingCardReward) return
                this.run.deck.push(view.getCardInstance())
                this.pendingCardReward = false
                this.choiceCards.forEach(card => card.destroy())
                this.choiceCards = []
                this.updateContinueButton()
            })
            this.add.existing(view)
            this.choiceCards.push(view)
        })

        const skip = this.add.text(this.scale.width / 2, cardY + 170, 'Skip', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: '#333',
            padding: { x: 8, y: 6 },
        }).setOrigin(0.5, 0).setInteractive({ useHandCursor: true })
        skip.on('pointerdown', () => {
            this.pendingCardReward = false
            this.choiceCards.forEach(card => card.destroy())
            this.choiceCards = []
            skip.destroy()
            this.updateContinueButton()
        })
    }

    private renderPotionReward(potionId: string): void {
        const titleY = this.scale.height - 160
        this.add.text(24, titleY, `Potion: ${POTION_DEFS[potionId as keyof typeof POTION_DEFS].name}`, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        })

        if (this.run.potions.length < this.run.maxPotionSlots) {
            this.run.potions.push(potionId as keyof typeof POTION_DEFS)
            this.pendingPotionReward = undefined
            this.add.text(24, titleY + 26, 'Added to inventory.', {
                fontFamily: 'monospace',
                fontSize: '16px',
                color: '#9ccc65',
            })
            return
        }

        this.add.text(24, titleY + 26, 'Replace a potion or skip:', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#ffffff',
        })

        this.run.potions.forEach((ownedPotion, index) => {
            const text = this.add.text(24 + index * 180, titleY + 56, POTION_DEFS[ownedPotion].name, {
                fontFamily: 'monospace',
                fontSize: '15px',
                color: '#ffffff',
                backgroundColor: '#444',
                padding: { x: 8, y: 6 },
            }).setInteractive({ useHandCursor: true })
            text.on('pointerdown', () => {
                if (!this.pendingPotionReward) return
                this.run.potions[index] = this.pendingPotionReward as keyof typeof POTION_DEFS
                this.pendingPotionReward = undefined
                this.potionTexts.forEach(entry => entry.destroy())
                this.potionTexts = []
                this.updateContinueButton()
            })
            this.potionTexts.push(text)
        })

        const skip = this.add.text(24, titleY + 92, 'Skip Potion', {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#ffffff',
            backgroundColor: '#333',
            padding: { x: 8, y: 6 },
        }).setInteractive({ useHandCursor: true })
        skip.on('pointerdown', () => {
            this.pendingPotionReward = undefined
            this.potionTexts.forEach(entry => entry.destroy())
            this.potionTexts = []
            skip.destroy()
            this.updateContinueButton()
        })
        this.potionTexts.push(skip)
    }

    private canContinue(): boolean {
        return !this.pendingCardReward && !this.pendingPotionReward
    }

    private updateContinueButton(): void {
        if (!this.continueButton) return
        const enabled = this.canContinue()
        this.continueButton.setStyle({ backgroundColor: enabled ? '#333' : '#666' })
        if (enabled) this.continueButton.setInteractive({ useHandCursor: true })
        else this.continueButton.disableInteractive()
    }
}
