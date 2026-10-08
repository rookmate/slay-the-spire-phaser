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

        if (this.roomKind === 'boss') {
            this.run.actsCleared = [...(this.run.actsCleared ?? []), this.run.act]
            if (this.run.act === 2) {
                this.scene.start('RunSummary', { run: this.run, result: 'victory' as const })
                return
            }
            const sourceBossId = this.engine.state.enemies[0]?.specId ?? 'BOSS'
            const bossRewards = generateRewardBundle(`${this.run.seed}-boss-relics-act-${this.run.act}-floor-${this.run.floor}`, 'boss', this.run, this.meta, { roomKind: 'boss' })
            const bossRelicChoices = bossRewards.items.find(item => item.kind === 'boss_relics')
            this.run.bossRelicChoicePending = {
                sourceBossId,
                choices: bossRelicChoices && bossRelicChoices.kind === 'boss_relics' ? bossRelicChoices.choices : [],
            }
            saveRun(this.run)
            this.scene.start('BossRelic', { run: this.run })
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
