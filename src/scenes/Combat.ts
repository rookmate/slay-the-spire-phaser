import Phaser from 'phaser'
import { Engine, createPlayerFromDeck } from '../core/engine'
import { RNG } from '../core/rng'
import { createEnemyFromSpec } from '../core/enemies'
import { generateEncounter } from '../core/encounters'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CombatUI } from '../ui/CombatUI'
import type { RoomKind } from '../core/map'
import { getCombatRelicBonuses, getPostCombatHeal } from '../core/relics'
import { generateRewardBundle, type EncounterTier } from '../core/rewards'

export class CombatScene extends Phaser.Scene {
    private engine!: Engine
    private ui!: CombatUI
    private run!: RunState
    private roomKind: RoomKind = 'monster'

    constructor() {
        super('Combat')
    }

    create(data: { run: RunState; roomKind?: RoomKind }): void {
        this.run = data.run
        this.roomKind = data.roomKind ?? 'monster'
        const seed = this.run.seed
        const player = createPlayerFromDeck(seed, this.run.deck, this.run.player.hp, this.run.player.maxHp)
        const combatIndex = this.run.combatCount ?? 0
        const tier = this.getEncounterTier()
        const encounterRng = new RNG(`${seed}-encounter-${combatIndex}-${tier}`)
        const keys = generateEncounter(encounterRng, tier, combatIndex)
        const enemies = keys.map((key, index) => createEnemyFromSpec(new RNG(`${seed}-enemy-${combatIndex}-${index}`), key as any, `e${index + 1}`))
        const relicBonuses = getCombatRelicBonuses(this.run.relics, this.roomKind)

        if (relicBonuses.eliteHpMultiplier !== 1) {
            for (const enemy of enemies) {
                enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * relicBonuses.eliteHpMultiplier))
                enemy.hp = Math.min(enemy.hp, enemy.maxHp)
            }
        }

        this.engine = new Engine(seed, player, enemies, { asc: this.run.asc ?? 0 })
        this.engine.configurePlayerCombatBonuses({ baseThorns: relicBonuses.startingThorns })
        if (relicBonuses.startingBlock > 0) this.engine.enqueue({ kind: 'GainBlock', target: player.id, amount: relicBonuses.startingBlock })
        if (relicBonuses.startingStrength > 0) this.engine.enqueue({ kind: 'ApplyPower', target: player.id, powerId: 'STRENGTH', stacks: relicBonuses.startingStrength })
        if (relicBonuses.energyBonus > 0) this.engine.enqueue({ kind: 'GainEnergy', amount: relicBonuses.energyBonus })
        this.engine.enqueue({ kind: 'DrawCards', count: 5 + relicBonuses.drawBonus })
        this.engine.runUntilIdle()

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
            saveRun(this.run)
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
        this.run.player.hp = Math.min(this.run.player.maxHp, this.engine.state.player.hp + getPostCombatHeal(this.run.relics))
        this.run.combatCount = (this.run.combatCount ?? 0) + 1

        if (this.roomKind === 'boss') {
            this.scene.start('RunSummary', { run: this.run, result: 'victory' as const })
            return
        }

        saveRun(this.run)
        const nodeId = this.run.mapProgress?.currentNodeId ?? `floor-${this.run.floor}`
        const rewards = generateRewardBundle(`${this.run.seed}-reward-${nodeId}-${this.roomKind}`, this.getEncounterTier(), this.run.relics)
        this.scene.start('Rewards', { run: this.run, rewards })
    }

    private handleDefeat(): void {
        this.run.player.hp = 0
        this.scene.start('RunSummary', { run: this.run, result: 'defeat' as const })
    }

    private getEncounterTier(): EncounterTier {
        if (this.roomKind === 'elite') return 'elite'
        if (this.roomKind === 'boss') return 'boss'
        return 'hallway'
    }
}
