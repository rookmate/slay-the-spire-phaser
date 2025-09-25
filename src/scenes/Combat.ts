import Phaser from 'phaser'
import { Engine, createDummyEnemy, createSimplePlayer } from '../core/engine'
import { CombatUI } from '../ui/CombatUI'

export class CombatScene extends Phaser.Scene {
    private engine!: Engine
    private ui!: CombatUI

    constructor() {
        super('Combat')
    }

    create(): void {
        const seed = 'm1-seed'
        const player = createSimplePlayer(seed)
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
        })
    }
}


