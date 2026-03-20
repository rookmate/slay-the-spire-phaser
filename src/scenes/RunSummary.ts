import Phaser from 'phaser'
import { loadMeta, saveMeta } from '../core/meta'
import { clearSavedRun, type RunState } from '../core/run'

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
        this.add.text(16, 110, `Relics: ${data.run.relics.join(', ') || 'None'}`, {
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
        this.add.text(16, 170, 'Back to Main Menu', { ...style, backgroundColor: '#333', padding: { x: 8, y: 6 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('MainMenu'))
    }
}

