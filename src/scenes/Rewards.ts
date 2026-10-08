import { addRunMenu } from '../ui/runMenu'
import Phaser from 'phaser'
import { finishRewards } from '../core/campaign'
import { createCardInstance } from '../core/cards'
import { changeMaxHp, gainGold } from '../core/health'
import { POTION_DEFS } from '../core/potions'
import { applyRelicAcquisition, blocksPotionGain, getRelicDisplayName } from '../core/relics'
import type { RewardBundle, RewardItem } from '../core/rewards'
import { obtainCardInstance, saveRun, type RunState } from '../core/run'
import { Card } from '../ui/Card'

/** Resolve one saved reward at a time, including repeated card/potion rewards. */
export class RewardsScene extends Phaser.Scene {
    run!: RunState
    private rewards!: RewardBundle
    pendingCardReward = false
    pendingPotionReward?: string
    private choiceCards: Card[] = []
    private message = ''
    constructor() { super('Rewards') }
    create(data: { run: RunState; rewards: RewardBundle }): void {
        this.run = data.run; this.rewards = data.rewards; this.message = ''; this.render()
    }
    private button(x: number, y: number, label: string, action: () => void): void {
        this.add.text(x, y, label, { fontFamily: 'monospace', fontSize: '17px', color: '#fff', backgroundColor: '#333', padding: { x: 10, y: 8 } })
            .setInteractive({ useHandCursor: true }).on('pointerdown', action)
    }
    private claim(index: number): void {
        this.rewards.claimed ??= []
        if (!this.rewards.claimed.includes(index)) this.rewards.claimed.push(index)
        this.run.pendingRoom = { scene: 'Rewards', rewards: this.rewards }; saveRun(this.run)
    }
    private render(): void {
        if (this.run.pendingAcquisitions?.length) { this.scene.start('RelicAcquisition', { run: this.run }); return }
        this.children.removeAll(true)
        addRunMenu(this, this.run); this.choiceCards = []; this.pendingCardReward = false; this.pendingPotionReward = undefined
        this.add.text(24, 24, `Rewards    ${this.run.gold} Gold`, { fontFamily: 'monospace', fontSize: '24px', color: '#fff' })
        for (const [i, item] of this.rewards.items.entries()) {
            if (this.rewards.claimed?.includes(i)) continue
            if (item.kind === 'gold') { gainGold(this.run, item.amount); this.claim(i); this.message += `Gold +${item.amount}. `; continue }
            if (item.kind === 'boss_relics') continue
            if (item.kind === 'relic' && !(this.rewards.tier === 'chest' && this.run.keysEnabled !== false && !this.run.keys.sapphire && i === this.rewards.items.findIndex(reward => reward.kind === 'relic'))) {
                applyRelicAcquisition(this.run, item.relicId); this.claim(i); this.message += `Obtained ${getRelicDisplayName(this.run, item.relicId)}. `
                if (this.run.pendingAcquisitions?.length) { this.scene.start('RelicAcquisition', { run: this.run }); return }
                continue
            }
            if (item.kind === 'potion' && (blocksPotionGain(this.run) || this.run.potions.length < this.run.maxPotionSlots)) {
                if (!blocksPotionGain(this.run)) { this.run.potions.push(item.potionId); this.message += `Obtained ${POTION_DEFS[item.potionId].name}. ` }
                this.claim(i); continue
            }
        }
        this.add.text(24, 70, this.message, { fontFamily: 'monospace', fontSize: '15px', color: '#bcb', wordWrap: { width: 752 } })
        const index = this.rewards.items.findIndex((item, i) => item.kind !== 'boss_relics' && !this.rewards.claimed?.includes(i))
        const item = this.rewards.items[index]
        if (!item) {
            this.button(332, 398, 'Continue', () => { const scene = finishRewards(this.run); saveRun(this.run); this.scene.start(scene, { run: this.run }) }); return
        }
        const complete = () => { this.claim(index); this.render() }
        if (item.kind === 'cards') this.renderCards(item, index)
        if (item.kind === 'potion') {
            this.pendingPotionReward = item.potionId
            this.add.text(24, 158, `${POTION_DEFS[item.potionId].name}: ${POTION_DEFS[item.potionId].description}`, { fontFamily: 'monospace', fontSize: '18px', color: '#fff' })
            this.add.text(24, 210, 'Replace a potion:', { fontFamily: 'monospace', fontSize: '17px', color: '#ccc' })
            this.run.potions.forEach((id, slot) => this.button(24 + slot % 3 * 252, 250 + Math.floor(slot / 3) * 54, POTION_DEFS[id].name, () => { this.run.potions[slot] = item.potionId; complete() }))
            this.button(635, 365, 'Skip Potion', complete)
        }
        if (item.kind === 'relic') {
            this.pendingCardReward = true
            this.button(24, 180, `Take ${getRelicDisplayName(this.run, item.relicId)}`, () => { applyRelicAcquisition(this.run, item.relicId); complete() })
            this.button(24, 250, 'Take Sapphire Key (leave relic)', () => { this.run.keys.sapphire = true; complete() })
        }
    }
    private renderCards(item: Extract<RewardItem, { kind: 'cards' }>, index: number): void {
        this.pendingCardReward = true
        const remaining = this.rewards.items.filter((reward, i) => reward.kind === 'cards' && !this.rewards.claimed?.includes(i)).length
        this.add.text(24, 115, `Choose a card or skip${remaining > 1 ? ` · ${remaining} rewards left` : ''}`, { fontFamily: 'monospace', fontSize: '18px', color: '#fff' })
        const spacing = 150
        const start = (this.scale.width - Card.CARD_WIDTH - (item.choices.length - 1) * spacing) / 2
        item.choices.forEach((id, i) => {
            const view = new Card(this, createCardInstance(id, item.upgrades?.[i] ?? 0), { x: start + i * spacing, y: 147, interactive: true })
            view.on('pointerdown', () => {
                if (this.rewards.claimed?.includes(index)) return
                obtainCardInstance(this.run, view.getCardInstance()); this.run.cardsSeen = (this.run.cardsSeen ?? 0) + item.choices.length
                this.claim(index); this.render()
            })
            this.add.existing(view); this.choiceCards.push(view)
        })
        if (this.run.relics.includes('SINGING_BOWL')) this.button(445, 365, '+2 max HP', () => { changeMaxHp(this.run, 2); this.claim(index); this.render() })
        this.button(680, 365, 'Skip', () => { this.claim(index); this.render() })
    }
}
