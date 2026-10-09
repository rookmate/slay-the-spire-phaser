import { roomBackdrop } from '../ui/theme'
import Phaser from 'phaser'
import { chooseStartingCard } from '../core/modes/setup'
import { saveRun, type RunState } from '../core/run'
import { getRunDestination } from '../core/progression'
import { CardGrid } from '../ui/CardGrid'
import { menuText } from '../ui/menu'
export class StartingDeckScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('StartingDeck') }
    create(data: { run: RunState }): void { this.run = data.run; this.render() }
    private render(): void {
        const draft = this.run.startingDraft
        if (!draft) { const next = getRunDestination(this.run); this.scene.start(next.scene, next.data); return }
        for (const child of [...this.children.list]) child.destroy()
        roomBackdrop(this)
        this.add.text(24, 20, draft.kind === 'sealed' ? 'Sealed Deck' : 'Draft', { ...menuText, fontSize: '26px' })
        this.add.text(24, 64, `Choose ${draft.remaining} more cards. Deck: ${this.run.deck.length}`, menuText)
        new CardGrid(this, this.add.container(0, 0), draft.choices, 108, card => {
            if (chooseStartingCard(this.run, card.instanceId)) { saveRun(this.run); this.render() }
        })
    }
}
