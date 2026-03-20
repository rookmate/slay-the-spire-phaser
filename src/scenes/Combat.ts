import Phaser from 'phaser'
import { Engine, createPlayerFromDeck } from '../core/engine'
import { RNG } from '../core/rng'
import { createEnemyFromSpec } from '../core/enemies'
import { generateEncounter } from '../core/encounters'
import type { RunState } from '../core/run'
import { saveRun } from '../core/run'
import { CombatUI } from '../ui/CombatUI'
import type { RoomKind } from '../core/map'
import { getEncounterEliteHpMultiplier, getPostCombatHeal, getRelicEnergyBonus } from '../core/relics'
import { generateRewardBundle, type EncounterTier } from '../core/rewards'
import { getEncounterActSeed, getEnemyActSeed } from '../core/acts'

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
        const act = this.run.act
        const player = createPlayerFromDeck(seed, this.run.deck, this.run.player.hp, this.run.player.maxHp)
        const combatIndex = this.run.combatCount ?? 0
        const tier = this.getEncounterTier()
        const encounterRng = new RNG(getEncounterActSeed(seed, act, tier, combatIndex))
        const keys = generateEncounter(encounterRng, act, tier, combatIndex)
        const enemies = keys.map((key, index) => createEnemyFromSpec(new RNG(getEnemyActSeed(seed, act, combatIndex, index)), key as any, `e${index + 1}`))
        const eliteHpMultiplier = getEncounterEliteHpMultiplier(this.run, this.roomKind)

        if (eliteHpMultiplier !== 1) {
            for (const enemy of enemies) {
                enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * eliteHpMultiplier))
                enemy.hp = Math.min(enemy.hp, enemy.maxHp)
            }
        }

        this.engine = new Engine(seed, player, enemies, { asc: this.run.asc ?? 0, run: this.run })
        this.engine.configurePlayerCombatBonuses({
            baseEnergyPerTurn: 3 + getRelicEnergyBonus(this.run),
        })
        this.engine.initializeCombat()
        this.engine.enqueue({ kind: 'DrawCards', count: 5 })
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
        this.run.player.hp = Math.min(this.run.player.maxHp, this.engine.state.player.hp + getPostCombatHeal(this.run))
        this.run.combatCount = (this.run.combatCount ?? 0) + 1

        if (this.roomKind === 'boss') {
            if (this.run.act === 2) {
                this.scene.start('RunSummary', { run: this.run, result: 'victory' as const })
                return
            }
            const sourceBossId = this.engine.state.enemies[0]?.specId ?? 'BOSS'
            const bossRewards = generateRewardBundle(`${this.run.seed}-boss-relics-act-${this.run.act}-floor-${this.run.floor}`, 'boss', this.run)
            const bossRelicChoices = bossRewards.items.find(item => item.kind === 'boss_relics')
            this.run.bossRelicChoicePending = {
                sourceBossId,
                choices: bossRelicChoices && bossRelicChoices.kind === 'boss_relics' ? bossRelicChoices.choices : [],
            }
            this.run.actsCleared = [...(this.run.actsCleared ?? []), this.run.act]
            saveRun(this.run)
            this.scene.start('BossRelic', { run: this.run })
            return
        }

        saveRun(this.run)
        const nodeId = this.run.mapProgress?.currentNodeId ?? `floor-${this.run.floor}`
        const rewards = generateRewardBundle(`${this.run.seed}-reward-${nodeId}-${this.roomKind}`, this.getEncounterTier(), this.run)
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
