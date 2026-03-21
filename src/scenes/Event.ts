import Phaser from 'phaser'
import { canUpgradeCard, resolveCard } from '../core/cards'
import { EVENT_DEFS, generateEvent, resolveEventChoice, type EventChoiceDef, type EventId } from '../core/events'
import { loadMeta, type MetaState } from '../core/meta'
import { getRelicDisplayName } from '../core/relics'
import { saveRun, type RunState } from '../core/run'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class EventScene extends Phaser.Scene {
    run!: RunState
    private meta!: MetaState
    private selector!: DeckSelectionOverlay
    private eventId!: EventId
    private feedbackText?: Phaser.GameObjects.Text

    constructor() {
        super('Event')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        this.meta = loadMeta()
        this.selector = new DeckSelectionOverlay(this)
        this.eventId = generateEvent(this.run.act, `${this.run.seed}-event-${this.run.mapProgress?.currentNodeId ?? this.run.floor}`)
        this.render()
    }

    private render(): void {
        this.children.removeAll()
        const event = EVENT_DEFS[this.eventId]
        const titleStyle = { fontFamily: 'monospace', fontSize: '24px', color: '#ffffff' }
        const bodyStyle = { fontFamily: 'monospace', fontSize: '17px', color: '#d0d0d0', wordWrap: { width: 760 } }
        const noteStyle = { fontFamily: 'monospace', fontSize: '14px', color: '#d9bdd9', wordWrap: { width: 760 } }

        this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x171717, 1).setOrigin(0, 0)
        this.add.text(20, 18, event.title, titleStyle)
        this.add.text(20, 60, event.body, bodyStyle)
        if (event.note) {
            this.add.text(20, 104, event.note, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#d9bdd9',
                wordWrap: { width: 760 },
            })
        }

        let y = 178
        for (const choice of event.choices) {
            this.renderChoice(choice, y)
            y += 60
        }

        this.feedbackText = this.add.text(20, this.scale.height - 88, '', noteStyle)
        this.add.text(20, this.scale.height - 42, 'Leave', {
            fontFamily: 'monospace',
            fontSize: '17px',
            color: '#ffffff',
            backgroundColor: '#313131',
            padding: { x: 10, y: 7 },
        }).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.leave())
    }

    private renderChoice(choice: EventChoiceDef, y: number): void {
        const disabled = choice.disabled?.(this.run) ?? false
        const container = this.add.container(20, y)
        const bg = this.add.rectangle(0, 0, 560, 46, disabled ? 0x2a2a2a : 0x232323, 1).setOrigin(0, 0)
        const label = this.add.text(12, 7, choice.label, {
            fontFamily: 'monospace',
            fontSize: '17px',
            color: disabled ? '#777777' : '#ffffff',
        })
        const description = this.add.text(180, 9, choice.description ?? '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: disabled ? '#6a6a6a' : '#bfbfbf',
        })
        container.add([bg, label, description])

        if (disabled) return

        bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleChoice(choice))
        label.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleChoice(choice))
        description.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.handleChoice(choice))
    }

    private handleChoice(choice: EventChoiceDef): void {
        if (choice.requiresSelection === 'remove') {
            this.selector.open({
                title: 'Choose a card to remove',
                cards: this.run.deck,
                onSelect: (card) => this.applyChoice(choice.id, { cardInstanceId: card.instanceId }),
            })
            return
        }
        if (choice.requiresSelection === 'upgrade') {
            this.selector.open({
                title: 'Choose a card to upgrade',
                cards: this.run.deck,
                filter: (card) => canUpgradeCard(card),
                onSelect: (card) => this.applyChoice(choice.id, { cardInstanceId: card.instanceId }),
            })
            return
        }
        if (choice.requiresSelection === 'transform') {
            this.selector.open({
                title: 'Choose a card to transform',
                cards: this.run.deck,
                onSelect: (card) => this.applyChoice(choice.id, { cardInstanceId: card.instanceId }),
            })
            return
        }
        this.applyChoice(choice.id)
    }

    private applyChoice(choiceId: EventChoiceDef['id'], selection?: { cardInstanceId?: string }): void {
        const result = resolveEventChoice(
            this.run,
            this.meta,
            this.eventId,
            choiceId,
            `${this.run.seed}-event-resolution-${this.run.mapProgress?.currentNodeId ?? this.run.floor}-${choiceId}`,
            selection,
        )
        const notes = [...(result.notes ?? [])]
        if (result.grantedRelicId) notes.push(`Relic: ${getRelicDisplayName(this.run, result.grantedRelicId)}`)
        if (result.transformedCard) notes.push(`New card: ${resolveCard(result.transformedCard).name}`)
        if (selection?.cardInstanceId) {
            const card = this.run.deck.find(entry => entry.instanceId === selection.cardInstanceId)
            if (card) notes.push(`Card: ${resolveCard(card).name}`)
        }
        if (this.feedbackText) this.feedbackText.setText(notes.join(' '))
        this.leave()
    }

    private leave(): void {
        this.run.floor += 1
        saveRun(this.run)
        this.scene.start('Map', { run: this.run })
    }
}
