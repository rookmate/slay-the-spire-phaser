import Phaser from 'phaser'
import { CARD_DEFS } from '../core/cards'
import { loadMeta, saveMeta } from '../core/meta'
import { clearSavedRun, type RunState } from '../core/run'
import { RELIC_DEFS } from '../core/relics'

export class RunSummaryScene extends Phaser.Scene {
    constructor() { super('RunSummary') }

    create(data: { run: RunState; result: 'victory' | 'defeat' }): void {
        const style = { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' }
        this.add.text(16, 16, `Run ${data.result.toUpperCase()}!`, style)
        this.add.text(16, 54, `Acts cleared: ${(data.run.actsCleared ?? []).join(', ') || 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        this.add.text(16, 82, `Deck size: ${data.run.deck.length}`, {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
        })
        const curseCards = data.run.deck.filter(card => CARD_DEFS[card.defId]?.type === 'curse')
        this.add.text(16, 110, `Curses: ${curseCards.length > 0 ? curseCards.map(card => CARD_DEFS[card.defId].name).join(', ') : 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#d4b2d4',
            wordWrap: { width: 720 },
        })
        this.add.text(16, 142, `Relics: ${data.run.relics.map(id => RELIC_DEFS[id]?.name ?? id).join(', ') || 'None'}`, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#cccccc',
            wordWrap: { width: 720 },
        })
        const meta = loadMeta()
        meta.totalRuns += 1
        if (data.result === 'victory') meta.totalWins += 1
        saveMeta(meta)
        clearSavedRun()
        this.add.text(16, 202, 'Back to Main Menu', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
    }
}
