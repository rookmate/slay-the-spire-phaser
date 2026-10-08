import { UI_FONT, roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { canUpgradeCard } from '../core/cards'
import { loadMeta } from '../core/meta'
import { applyNeowOption, rollNeowOptions, type NeowOption } from '../core/neow'
import { getRunDestination } from '../core/progression'
import { saveRun, type RunState } from '../core/run'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class NeowScene extends Phaser.Scene {
    run!: RunState
    private selector!: DeckSelectionOverlay
    options: NeowOption[] = []
    constructor() { super('Neow') }
    create(data: { run: RunState }): void {
        roomBackdrop(this)
        this.run = data.run; this.selector = new DeckSelectionOverlay(this)
        this.options = rollNeowOptions(this.run.neowSeed, this.run.neowFull ?? true)
        this.add.text(24, 24, 'Neow', { resolution: 2, fontFamily: UI_FONT, fontSize: '28px', color: '#fff' })
        this.add.text(24, 72, 'Choose a blessing for your climb.', { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#bdb29d' })
        this.options.forEach((option, i) => {
            const y = 108 + i * 80
            this.add.text(24, y, option.label, { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#fff', backgroundColor: '#353126', padding: { x: 12, y: 10 } })
                .setInteractive({ useHandCursor: true }).on('pointerdown', () => this.chooseOption(option))
            this.add.text(24, y + 44, option.description, { resolution: 2, fontFamily: UI_FONT, fontSize: '14px', color: '#bdb29d', wordWrap: { width: 744 } })
        })
        this.events.once('shutdown', () => this.selector.destroy())
    }
    private chooseOption(option: NeowOption, selected: string[] = []): void {
        if (option.requiresSelection && selected.length < (option.selectionCount ?? 1)) {
            this.selector.open({ title: `${option.label} (${selected.length + 1}/${option.selectionCount})`, cards: this.run.deck,
                filter: card => !selected.includes(card.instanceId) && card.defId !== 'ASCENDERS_BANE' && (option.requiresSelection !== 'upgrade' || canUpgradeCard(card)),
                onSelect: card => this.chooseOption(option, [...selected, card.instanceId]),
            }); return
        }
        if (!applyNeowOption(this.run, loadMeta(), option, selected)) return
        saveRun(this.run); const destination = getRunDestination(this.run); this.scene.start(destination.scene, destination.data)
    }
}
