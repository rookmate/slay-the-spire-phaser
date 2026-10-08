import { finishCombat } from '../core/rooms'
import { getRunDestination } from '../core/progression'
import Phaser from 'phaser'
import { createCombatEngine } from '../core/combat'
import type { Engine } from '../core/engine'
import { loadMeta } from '../core/meta'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CombatUI } from '../ui/CombatUI'
import type { RoomKind } from '../core/map'

export class CombatScene extends Phaser.Scene {
    private engine!: Engine
    private ui!: CombatUI
    private run!: RunState
    private roomKind: RoomKind = 'monster'
    private meta = loadMeta()

    constructor() {
        super('Combat')
    }

    create(data: { run: RunState; roomKind?: RoomKind }): void {
        this.run = data.run
        this.roomKind = data.roomKind ?? 'monster'
        this.meta = loadMeta()
        this.engine = createCombatEngine(this.run, this.roomKind)

        if (this.engine.state.victory) {
            this.handleOutcome()
            return
        }
        if (this.engine.state.defeat) {
            this.handleOutcome()
            return
        }

        this.ui = new CombatUI(this, this.engine, this.run)
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.ui?.destroy())
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this.ui?.destroy())

        this.ui.onPlayCard((card, targets) => {
            this.ui.apply(this.engine.playCard(card, targets))
            this.ui.apply(this.engine.runUntilIdle())
            this.checkOutcome()
        })

        this.ui.onSubmitPendingChoice((instanceIds) => {
            this.ui.apply(this.engine.submitPendingChoice(instanceIds))
            this.ui.apply(this.engine.runUntilIdle())
            this.checkOutcome()
        })

        this.ui.onCancelPendingChoice(() => {
            this.ui.apply(this.engine.cancelPendingChoice())
            this.ui.apply(this.engine.runUntilIdle())
            this.checkOutcome()
        })

        this.ui.onUsePotion((potionIndex, targets) => {
            const potionId = this.run.potions[potionIndex]
            if (!potionId) return
            const events = this.engine.usePotionAtIndex(potionIndex, targets)
            this.ui.apply(events)
            this.ui.refreshRunData(this.run)
            this.checkOutcome()
        })

        this.ui.onEndTurn(() => {
            this.engine.enqueue({ kind: 'EndTurn' })
            this.ui.apply(this.engine.runUntilIdle())
            this.checkOutcome()
        })
    }

    private checkOutcome(): void {
        if (this.engine.state.victory) this.handleOutcome()
        else if (this.engine.state.defeat) this.handleOutcome()
    }

    private handleOutcome(): void {
        const result = finishCombat(this.run, this.engine, this.roomKind, this.meta)
        saveRun(this.run)
        if (result) this.scene.start('RunSummary', { run: this.run, result })
        else { const next = getRunDestination(this.run); this.scene.start(next.scene, next.data) }
    }
}
