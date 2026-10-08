import { UI_FONT, roomBackdrop } from '../ui/theme'
import { addRunMenu } from '../ui/runMenu'
import { flipEventCard } from '../core/events/additionalResolution'
import { CARD_DEFS } from '../core/cards'
import Phaser from 'phaser'
import { canRemoveCard, canUpgradeCard, createCardInstance } from '../core/cards'
import { EVENT_DEFS, eventSeed, getEventChoices, initializeEvent, resolveEventChoice, type EventChoiceDef, type EventId } from '../core/events'
import { loadMeta, saveMeta, type MetaState } from '../core/meta'
import { completeRoom } from '../core/progression'
import { saveRun, type RunState } from '../core/run'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class EventScene extends Phaser.Scene {
    run!: RunState
    private meta!: MetaState
    private selector!: DeckSelectionOverlay
    private eventId!: EventId
    constructor() { super('Event') }
    create(data: { run: RunState }): void {
        this.run = data.run; this.meta = loadMeta(); this.selector = new DeckSelectionOverlay(this)
        initializeEvent(this.run, this.meta)
        this.eventId = this.run.eventState!.id
        saveRun(this.run)
        this.render()
        this.events.once('shutdown', () => this.selector.destroy())
    }
    private render(): void {
        this.children.removeAll(true)
        roomBackdrop(this)
        addRunMenu(this, this.run)
        const event = EVENT_DEFS[this.eventId]
        this.add.text(24, 18, event.title, { resolution: 2, fontFamily: UI_FONT, fontSize: '26px', color: '#fff' })
        this.add.text(24, 57, event.body, { resolution: 2, fontFamily: UI_FONT, fontSize: '17px', color: '#d0c5ae', wordWrap: { width: 750 } })
        this.add.text(24, 92, `${this.run.player.hp}/${this.run.player.maxHp} HP    ${this.run.gold} Gold`, { resolution: 2, fontFamily: UI_FONT, fontSize: '16px', color: '#b4aa94' })
        if (this.run.eventState?.matching) this.renderMatchingGame()
        getEventChoices(this.run).forEach((choice, i) => {
            const disabled = choice.disabled?.(this.run) ?? false
            const y = 132 + i * 65
            const text = this.add.text(24, y, choice.label, { resolution: 2, fontFamily: UI_FONT, fontSize: '19px', color: disabled ? '#777' : '#fff', backgroundColor: '#353126', padding: { x: 10, y: 8 } })
            if (!disabled) text.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleChoice(choice))
            this.add.text(24, y + 40, choice.description ?? '', { resolution: 2, fontFamily: UI_FONT, fontSize: '14px', color: '#bdb29d', wordWrap: { width: 744 } })
        })
        this.add.text(24, 345, this.run.eventState?.notes?.join(' ') ?? '', { resolution: 2, fontFamily: UI_FONT, fontSize: '15px', color: '#dbc5a3', wordWrap: { width: 750 } })
        if (this.run.eventState?.resolved) this.add.text(24, 399, 'Continue', { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#fff', backgroundColor: '#353126', padding: { x: 12, y: 8 } })
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leave())
    }
    private renderMatchingGame(): void {
        const board = this.run.eventState!.matching!
        this.add.text(24, 119, `${board.attempts} attempts left`, { resolution: 2, fontFamily: UI_FONT, fontSize: '14px', color: '#d0c5ae' })
        board.cards.forEach((id, index) => {
            const shown = board.matched.includes(index) || board.revealed.includes(index)
            const x = 24 + index % 6 * 125, y = 148 + Math.floor(index / 6) * 89
            const tile = this.add.text(x, y, shown ? CARD_DEFS[id].name : '?', { resolution: 2, fontFamily: UI_FONT, fontSize: '13px', color: '#fff', backgroundColor: board.matched.includes(index) ? '#385132' : '#343434', fixedWidth: 115, fixedHeight: 77, padding: { x: 8, y: 8 }, wordWrap: { width: 99 } })
            if (!this.run.eventState!.resolved && !board.matched.includes(index)) tile.setInteractive({ useHandCursor: true }).on('pointerdown', () => { if (flipEventCard(this.run, index)) { saveRun(this.run); this.render() } })
        })
    }
    private handleChoice(choice: EventChoiceDef): void {
        if (choice.disabled?.(this.run)) return
        if (choice.requiresSelection === 'reward') {
            this.selector.open({ title: 'Choose a card', cards: (this.run.eventState?.cards ?? []).map(id => createCardInstance(id)), onSelect: card => this.applyChoice(choice.id, { cardId: card.defId }) })
        } else if (choice.requiresSelection) {
            this.selector.open({ title: choice.label, cards: this.run.deck, filter: card => choice.requiresSelection === 'upgrade' ? canUpgradeCard(card) : choice.requiresSelection === 'copy' || (canRemoveCard(card) && (choice.requiresSelection !== 'transform' || !this.run.eventState?.transformEligibleIds || this.run.eventState.transformEligibleIds.includes(card.instanceId))), onSelect: card => this.applyChoice(choice.id, { cardInstanceId: card.instanceId }) })
        } else this.applyChoice(choice.id)
    }
    private applyChoice(choiceId: string, selection?: { cardInstanceId?: string; cardId?: string }): void {
        const result = resolveEventChoice(this.run, this.meta, this.eventId, choiceId, eventSeed(this.run), selection)
        saveRun(this.run); saveMeta(this.meta)
        if (result.nextScene === 'RunSummary') this.scene.start('RunSummary', { run: this.run, result: 'defeat' })
        else if (result.nextScene === 'Combat' && this.run.pendingRoom?.scene === 'Combat') this.scene.start('Combat', { run: this.run, roomKind: this.run.pendingRoom.roomKind })
        else if (result.nextScene === 'Rewards' && this.run.pendingRoom?.scene === 'Rewards') this.scene.start('Rewards', { run: this.run, rewards: this.run.pendingRoom.rewards })
        else if (this.run.pendingAcquisitions?.length) this.scene.start('RelicAcquisition', { run: this.run })
        else this.render()
    }
    private leave(): void {
        if (!this.run.eventState?.resolved) return
        completeRoom(this.run); saveRun(this.run); this.scene.start('Map', { run: this.run })
    }
}
