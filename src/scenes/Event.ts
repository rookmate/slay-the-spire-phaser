import Phaser from 'phaser'
import { canUpgradeCard, createCardInstance } from '../core/cards'
import { EVENT_DEFS, eventSeed, getEventChoices, initializeEvent, resolveEventChoice, type EventChoiceDef, type EventId } from '../core/events'
import { loadMeta, type MetaState } from '../core/meta'
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
        const event = EVENT_DEFS[this.eventId]
        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x171717).setOrigin(0)
        this.add.text(24, 18, event.title, { fontFamily: 'monospace', fontSize: '26px', color: '#fff' })
        this.add.text(24, 57, event.body, { fontFamily: 'monospace', fontSize: '17px', color: '#ccc', wordWrap: { width: 750 } })
        this.add.text(24, 92, `${this.run.player.hp}/${this.run.player.maxHp} HP    ${this.run.gold} Gold`, { fontFamily: 'monospace', fontSize: '16px', color: '#aaa' })
        getEventChoices(this.run).forEach((choice, i) => {
            const disabled = choice.disabled?.(this.run) ?? false
            const y = 132 + i * 65
            const text = this.add.text(24, y, choice.label, { fontFamily: 'monospace', fontSize: '19px', color: disabled ? '#777' : '#fff', backgroundColor: '#2d2d2d', padding: { x: 10, y: 8 } })
            if (!disabled) text.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleChoice(choice))
            this.add.text(24, y + 40, choice.description ?? '', { fontFamily: 'monospace', fontSize: '14px', color: '#bbb', wordWrap: { width: 744 } })
        })
        this.add.text(24, 345, this.run.eventState?.notes?.join(' ') ?? '', { fontFamily: 'monospace', fontSize: '15px', color: '#dbc5a3', wordWrap: { width: 750 } })
        if (this.run.eventState?.resolved) this.add.text(24, 399, 'Continue', { fontFamily: 'monospace', fontSize: '18px', color: '#fff', backgroundColor: '#333', padding: { x: 12, y: 8 } })
            .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leave())
    }
    private handleChoice(choice: EventChoiceDef): void {
        if (choice.disabled?.(this.run)) return
        if (choice.requiresSelection === 'reward') {
            this.selector.open({ title: 'Choose a card', cards: (this.run.eventState?.cards ?? []).map(id => createCardInstance(id)), onSelect: card => this.applyChoice(choice.id, { cardId: card.defId }) })
        } else if (choice.requiresSelection) {
            this.selector.open({ title: choice.label, cards: this.run.deck, filter: card => choice.requiresSelection === 'upgrade' ? canUpgradeCard(card) : choice.requiresSelection === 'copy' || card.defId !== 'ASCENDERS_BANE', onSelect: card => this.applyChoice(choice.id, { cardInstanceId: card.instanceId }) })
        } else this.applyChoice(choice.id)
    }
    private applyChoice(choiceId: string, selection?: { cardInstanceId?: string; cardId?: string }): void {
        const result = resolveEventChoice(this.run, this.meta, this.eventId, choiceId, eventSeed(this.run), selection)
        saveRun(this.run)
        if (result.nextScene === 'RunSummary') this.scene.start('RunSummary', { run: this.run, result: 'defeat' })
        else if (result.nextScene === 'Combat' && this.run.pendingRoom?.scene === 'Combat') this.scene.start('Combat', { run: this.run, roomKind: this.run.pendingRoom.roomKind })
        else if (result.nextScene === 'Rewards' && this.run.pendingRoom?.scene === 'Rewards') this.scene.start('Rewards', { run: this.run, rewards: this.run.pendingRoom.rewards })
        else this.render()
    }
    private leave(): void {
        if (!this.run.eventState?.resolved) return
        completeRoom(this.run); saveRun(this.run); this.scene.start('Map', { run: this.run })
    }
}
