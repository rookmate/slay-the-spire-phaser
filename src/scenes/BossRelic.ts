import Phaser from 'phaser'
import type { RunState, RelicId } from '../core/run'
import { saveRun } from '../core/run'
import { RELIC_DEFS, applyRelicAcquisition } from '../core/relics'

export class BossRelicScene extends Phaser.Scene {
    private run!: RunState

    constructor() {
        super('BossRelic')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        const pending = this.run.bossRelicChoicePending
        const choices = pending?.choices ?? []

        this.add.text(16, 16, 'Boss Relic', { ...style, fontSize: '24px' })
        this.add.text(16, 46, 'Choose one relic and continue to the next act.', { ...style, fontSize: '14px', color: '#bbbbbb' })

        choices.forEach((relicId, index) => this.renderChoice(relicId, index))
    }

    private renderChoice(relicId: RelicId, index: number): void {
        const def = RELIC_DEFS[relicId]
        const x = 32 + index * 244
        const y = 108
        const bg = this.add.rectangle(x, y, 220, 160, 0x252525, 1).setOrigin(0, 0).setStrokeStyle(1, 0x555555)
        const title = this.add.text(x + 12, y + 12, def.name, {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#ffffff',
        })
        const description = this.add.text(x + 12, y + 44, def.description, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#c7c7c7',
            wordWrap: { width: 196 },
        })
        const select = this.add.text(x + 12, y + 122, 'Take Relic', {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 8, y: 6 },
        }).setInteractive({ useHandCursor: true })

        select.on('pointerdown', () => {
            applyRelicAcquisition(this.run, relicId)
            this.run.bossRelicChoicePending = undefined
            this.run.act = 2
            this.run.floor = 1
            this.run.mapProgress = {}
            this.run.combatCount = 0
            saveRun(this.run)
            this.scene.start('Map', { run: this.run })
        })

        this.children.bringToTop(bg)
        this.children.bringToTop(title)
        this.children.bringToTop(description)
        this.children.bringToTop(select)
    }
}
