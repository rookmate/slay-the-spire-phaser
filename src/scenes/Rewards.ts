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
        const pool = Object.entries(CARD_DEFS)
            .filter(([_, def]) => def.rarity && def.rarity !== 'basic')
            .map(([id]) => id)
        const rng = new Phaser.Math.RandomDataGenerator([this.run.seed + ':' + this.run.floor])
        const choices = [] as string[]
        const copy = [...pool]
        for (let i = 0; i < 3 && copy.length > 0; i++) {
            const idx = Math.floor(rng.frac() * copy.length)
            const [id] = copy.splice(idx, 1)
            choices.push(id)
        }
        choices.forEach((id, i) => {
            const def = CARD_DEFS[id]
            this.add.text(16, 60 + i * 40, `Add ${def.name}`, { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.run.deck.push({ defId: id, upgraded: false })
                    this.run.gold += 20
                    this.run.floor += 1
                    saveRun(this.run)
                    this.scene.start('Map', { run: this.run })
                })
        })
        this.add.text(16, 60 + choices.length * 40, 'Skip', { ...style, backgroundColor: '#333', padding: { x: 6, y: 4 } })
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.run.gold += 20
                this.run.floor += 1
                saveRun(this.run)
                this.scene.start('Map', { run: this.run })
            })
    }
}


