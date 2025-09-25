import Phaser from 'phaser'
import { Engine, createDummyEnemy, createPlayerFromDeck } from '../core/engine'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CombatUI } from '../ui/CombatUI'

export class CombatScene extends Phaser.Scene {
    private engine!: Engine
    private ui!: CombatUI
    private run!: RunState

    constructor() {
        super('Combat')
    }

    create(data: { run: RunState }): void {
        this.run = data.run
        const seed = this.run.seed
        const player = createPlayerFromDeck(seed, this.run.deck, this.run.player.hp, this.run.player.maxHp)
        const enemies = [createDummyEnemy('e1'), createDummyEnemy('e2')]
        this.engine = new Engine(seed, player, enemies)
        // opening draw
        this.engine.enqueue({ kind: 'DrawCards', count: 5 })
        this.engine.runUntilIdle()

        this.ui = new CombatUI(this, this.engine)
        this.ui.onPlayCard((card, targets) => {
            const evStart = this.engine.playCard(card, targets)
            this.ui.apply(evStart)
            const evts = this.engine.runUntilIdle()
            this.ui.apply(evts)
        })
        this.ui.onEndTurn(() => {
            this.engine.enqueue({ kind: 'EndTurn' })
            const evts = this.engine.runUntilIdle()
            this.ui.apply(evts)
            if (this.engine.state.victory) {
                // Burning Blood: heal 6 after combat if owned
                if (this.run.relics.includes('BURNING_BLOOD')) {
                    this.run.player.hp = Math.min(this.run.player.maxHp, this.engine.state.player.hp + 6)
                } else {
                    this.run.player.hp = this.engine.state.player.hp
                }
                saveRun(this.run)
                this.scene.start('Rewards', { run: this.run })
            } else if (this.engine.state.defeat) {
                saveRun(this.run)
                this.scene.start('Map', { run: this.run })
            }
        })
    }
}


