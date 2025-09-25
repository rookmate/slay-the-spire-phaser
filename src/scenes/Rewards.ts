import Phaser from 'phaser'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CARD_DEFS } from '../core/cards'

export class RewardsScene extends Phaser.Scene {
    run!: RunState
    constructor() { super('Rewards') }

    create(data: { run: RunState }): void {
        this.run = data.run
        const style = { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' }
        this.add.text(16, 16, 'Victory! Choose a card:', style)
        const choices = ['CLEAVE', 'SHRUG_IT_OFF', 'ANGER']
        choices.forEach((id, i) => {
            const def = CARD_DEFS[id]
            this.add.text(16, 60 + i * 40, `Add ${def.name}`, { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.run.deck.push({ defId: id, upgraded: false })
                    this.run.gold += 20
                    this.run.floor += 1
                    saveRun(this.run)
                    this.scene.start('RunSummary', { run: this.run, result: 'victory' })
                })
        })
        this.add.text(16, 60 + choices.length * 40, 'Skip', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.run.gold += 20
                this.run.floor += 1
                saveRun(this.run)
                this.scene.start('RunSummary', { run: this.run, result: 'victory' })
            })
    }
}


