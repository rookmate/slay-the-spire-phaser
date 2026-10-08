import { getEncounterActSeed, getEnemyActSeed } from './acts'
import { affectsRoomTier, getAscensionEnemyHpMultiplier, pickMoreAggressiveIntent, shouldUpgradeHallwayOpeningIntent } from './ascension'
import { createEnemyState, rollEngineIntentForEnemy } from './enemies'
import { generateEncounter } from './encounters'
import { Engine, createPlayerFromDeck } from './engine'
import type { RoomKind } from './map'
import { getEncounterEliteHpMultiplier, getPostCombatHeal, getRelicEnergyBonus } from './relics'
import { RNG } from './rng'
import type { RunState } from './run'
import type { PlayerState } from './state'

export function createCombatEngine(run: RunState, roomKind: RoomKind): Engine {
    const { seed, act } = run
    const combatIndex = run.combatCount ?? 0
    const tier = affectsRoomTier(roomKind)
    const player = createPlayerFromDeck(seed, run.deck, run.player.hp, run.player.maxHp)
    const keys = generateEncounter(new RNG(getEncounterActSeed(seed, act, tier, combatIndex)), act, tier, combatIndex)
    const hpMultiplier = getEncounterEliteHpMultiplier(run, roomKind) * getAscensionEnemyHpMultiplier(run.asc, tier)
    const enemies = keys.map((key, index) => {
        const enemy = createEnemyState(key, `e${index + 1}`)
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpMultiplier))
        enemy.hp = enemy.maxHp
        return enemy
    })
    const engine = new Engine(seed, player, enemies, { asc: run.asc, run })
    enemies.forEach((enemy, index) => {
        const intentSeed = `${getEnemyActSeed(seed, act, combatIndex, index)}-intent`
        // Sample each opening from the same fresh enemy, then commit the chosen AI state.
        const alternative = structuredClone(enemy)
        enemy.intent = rollEngineIntentForEnemy(new RNG(intentSeed), enemy, engine.state)
        if (roomKind === 'monster' && shouldUpgradeHallwayOpeningIntent(run.asc)) {
            alternative.intent = rollEngineIntentForEnemy(new RNG(`${intentSeed}-asc7`), alternative, engine.state)
            if (pickMoreAggressiveIntent(enemy.intent, alternative.intent) === alternative.intent) {
                Object.assign(enemy, alternative)
            }
        }
    })
    engine.configurePlayerCombatBonuses({ baseEnergyPerTurn: 3 + getRelicEnergyBonus(run) })
    engine.initializeCombat()
    engine.enqueue({ kind: 'DrawCards', count: 5 })
    engine.runUntilIdle()
    return engine
}

export function applyCombatVictory(run: RunState, player: Pick<PlayerState, 'hp' | 'maxHp'>): void {
    run.player.maxHp = player.maxHp
    run.player.hp = Math.min(player.maxHp, player.hp + getPostCombatHeal(run))
    run.combatCount = (run.combatCount ?? 0) + 1
}
