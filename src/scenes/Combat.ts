import { finishBossCombat } from '../core/campaign'
import { getRunDestination } from '../core/progression'
import Phaser from 'phaser'
import { affectsRoomTier } from '../core/ascension'
import { applyCombatVictory, createCombatEngine } from '../core/combat'
import type { Engine } from '../core/engine'
import { loadMeta } from '../core/meta'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CombatUI } from '../ui/CombatUI'
import type { RoomKind } from '../core/map'
import { generateRewardBundle } from '../core/rewards'

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
        if (this.run.act === 1 && this.roomKind === 'boss') {
            this.run.runFlags ??= {}
            this.run.runFlags.reachedFirstBoss = true
            saveRun(this.run)
        }
        this.meta = loadMeta()
        this.engine = createCombatEngine(this.run, this.roomKind)

        if (this.engine.state.victory) {
            this.handleVictory()
            return
        }
        if (this.engine.state.defeat) {
            this.handleDefeat()
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
            const events = this.engine.usePotion(potionId, targets)
            this.run.potions.splice(potionIndex, 1)
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
        if (this.engine.state.victory) this.handleVictory()
        else if (this.engine.state.defeat) this.handleDefeat()
    }

    private handleVictory(): void {
        applyCombatVictory(this.run, this.engine.state.player)
        this.run.pendingRoom = undefined
        if (this.run.eventCombat) {
            const rewards = this.run.eventCombat.rewards
            this.run.eventCombat = undefined; this.run.eventState = undefined
            this.run.pendingRoom = { scene: 'Rewards', rewards }; saveRun(this.run)
            this.scene.start('Rewards', { run: this.run, rewards }); return
        }

        if (this.roomKind === 'elite' && this.run.burningEliteActive) this.run.keys.emerald = true
        this.run.burningEliteActive = false
        if (this.roomKind === 'monster') this.run.hallwayCount = (this.run.hallwayCount ?? 0) + 1
        if (this.roomKind === 'boss') {
            const scene = finishBossCombat(this.run, this.meta)
            saveRun(this.run)
            if (scene === 'RunSummary') this.scene.start(scene, { run: this.run, result: 'victory' })
            else { const next = getRunDestination(this.run); this.scene.start(next.scene, next.data) }
            return
        }

        const nodeId = this.run.mapProgress?.currentNodeId ?? `floor-${this.run.floor}`
        const rewards = generateRewardBundle(`${this.run.seed}-reward-${nodeId}-${this.roomKind}`, affectsRoomTier(this.roomKind), this.run, this.meta, { roomKind: this.roomKind, asc: this.run.asc })
        this.run.pendingRoom = { scene: 'Rewards', rewards }
        saveRun(this.run)
        this.scene.start('Rewards', { run: this.run, rewards })
    }

    private handleDefeat(): void {
        this.run.player.hp = 0
        this.scene.start('RunSummary', { run: this.run, result: 'defeat' as const })
    }
}
