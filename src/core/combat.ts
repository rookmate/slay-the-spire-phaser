import { resolveCard } from './cards'
import { getRunBoss } from './campaign'
import { getEncounterActSeed, getEnemyActSeed } from './acts'
import { affectsRoomTier } from './ascension'
import { createEnemyState, rollEngineIntentForEnemy } from './enemies'
import { bossEncounter, generateEncounter } from './encounters'
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
    const keys = run.eventCombat?.enemies ?? (roomKind === 'boss' ? bossEncounter(getRunBoss(run)) : generateEncounter(new RNG(getEncounterActSeed(seed, act, tier, roomKind === 'monster' ? (run.hallwayCount ?? 0) : combatIndex)), act, tier, roomKind === 'monster' ? (run.hallwayCount ?? 0) : combatIndex))
    const hpMultiplier = getEncounterEliteHpMultiplier(run, roomKind)
    const enemies = keys.map((key, index) => {
        const enemy = createEnemyState(key, `e${index + 1}`, run.asc, new RNG(getEnemyActSeed(seed, act, combatIndex, index)))
        enemy.maxHp = Math.max(1, Math.round(enemy.maxHp * hpMultiplier))
        enemy.hp = enemy.maxHp
        return enemy
    })
    if (run.burningEliteActive) {
        const buff = new RNG(`${seed}-burning-${act}`).int(0, 3)
        for (const enemy of enemies) {
            if (buff === 0) { enemy.maxHp = Math.round(enemy.maxHp * 1.25); enemy.hp = enemy.maxHp }
            else enemy.powers.push({ id: buff === 1 ? 'STRENGTH' : buff === 2 ? 'METALLICIZE' : 'REGENERATE', stacks: buff === 1 ? act + 1 : buff === 2 ? act * 2 + 2 : 1 + 2 * act })
        }
    }
    const lament = run.relicState?.NEOWS_LAMENT
    if (run.relics.includes('NEOWS_LAMENT') && (lament?.charges ?? 0) > 0) {
        enemies.forEach(enemy => { enemy.hp = 1; enemy.maxHp = 1 }); lament!.charges!--
    }
    const engine = new Engine(seed, player, enemies, { asc: run.asc, run })
    enemies.forEach((enemy, index) => {
        const intentSeed = `${getEnemyActSeed(seed, act, combatIndex, index)}-intent`
        if (enemy.specId === 'SENTRY') enemy.aiState = { ...enemy.aiState, turn: index % 2 }
        if (act === 3 && enemy.specId === 'JAW_WORM') { enemy.block = 6; enemy.powers.push({ id: 'STRENGTH', stacks: run.asc >= 17 ? 5 : 3 }) }
        if (keys.includes('AWAKENED_ONE') && enemy.specId === 'CULTIST') enemy.tags = ['minion']
        if (keys.includes('GREMLIN_LEADER') && enemy.specId !== 'GREMLIN_LEADER') enemy.tags = ['minion']
        enemy.intent = rollEngineIntentForEnemy(new RNG(intentSeed), enemy, engine.state)
    })
    engine.configurePlayerCombatBonuses({ baseEnergyPerTurn: 3 + getRelicEnergyBonus(run) })
    engine.initializeCombat()
    engine.enqueue({ kind: 'DrawCards', count: Math.max(5, player.deck.filter(card => resolveCard(card).innate).length) })
    engine.runUntilIdle()
    return engine
}

export function applyCombatVictory(run: RunState, player: Pick<PlayerState, 'hp' | 'maxHp'>): void {
    run.player.maxHp = player.maxHp
    run.player.hp = Math.min(player.maxHp, player.hp + getPostCombatHeal(run))
    run.combatCount = (run.combatCount ?? 0) + 1
}
