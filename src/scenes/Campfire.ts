import { UI_FONT, roomBackdrop } from '../ui/theme'
import { addRunMenu } from '../ui/runMenu'
import Phaser from 'phaser'
import { canUseCampfire, useCampfire, type CampfireAction } from '../core/campfire'
import { canUpgradeCard } from '../core/cards'
import { getRunDestination } from '../core/progression'
import { saveRun, type RunState } from '../core/run'
import { DeckSelectionOverlay } from '../ui/DeckSelectionOverlay'

export class CampfireScene extends Phaser.Scene {
    run!: RunState
    private selector!: DeckSelectionOverlay
    constructor() { super('Campfire') }
    create(data: { run: RunState }): void {
        roomBackdrop(this)
        this.run = data.run
        addRunMenu(this, this.run)
        this.selector = new DeckSelectionOverlay(this)
        const style = { resolution: 2, fontFamily: UI_FONT, fontSize: '18px', color: '#fff' }
        this.add.text(24, 20, `Campfire    ${this.run.player.hp}/${this.run.player.maxHp} HP`, { ...style, fontSize: '24px' })
        const actions: [CampfireAction, string][] = [
            ['rest', `Rest · heal 30% max HP${this.run.relics.includes('REGAL_PILLOW') ? ' + 15 HP' : ''}`],
            ['smith', 'Smith · upgrade a card'], ['recall', 'Recall · obtain Ruby Key'],
        ]
        if (this.run.relics.includes('PEACE_PIPE')) actions.push(['toke', 'Toke · remove a card'])
        if (this.run.relics.includes('SHOVEL')) actions.push(['dig', 'Dig · obtain a relic'])
        if (this.run.relics.includes('GIRYA')) actions.push(['lift', `Lift · +1 starting Strength (${this.run.relicState?.GIRYA?.counter ?? 0}/3)`])
        actions.push(['skip', 'Skip'])
        actions.forEach(([action, label], i) => {
            const enabled = canUseCampfire(this.run, action)
            const button = this.add.text(24, 70 + i * 49, label, { ...style, color: enabled ? '#fff' : '#888', backgroundColor: '#353126', padding: { x: 10, y: 8 } })
            if (enabled) button.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
                if (action === 'smith') this.selector.open({ title: 'Choose a card to upgrade', cards: this.run.deck, filter: canUpgradeCard, onSelect: card => this.choose(action, card.instanceId) })
                else this.choose(action)
            })
        })
        this.events.once('shutdown', () => this.selector.destroy())
    }
    private choose(action: CampfireAction, cardId?: string): void {
        if (!useCampfire(this.run, action, cardId)) return
        saveRun(this.run)
        const next = getRunDestination(this.run); this.scene.start(next.scene, next.data)
    }
}
