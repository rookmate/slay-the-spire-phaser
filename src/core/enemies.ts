import type { CardType, CombatState, EnemyState } from './state'
import type { Engine } from './engine'
import { RNG } from './rng'
import { ACT_ONE_ENEMIES } from './enemies/actOne'
import { ACT_TWO_ENEMIES } from './enemies/actTwo'
import { ACT_THREE_ENEMIES } from './enemies/actThree'
import { ACT_FOUR_ENEMIES } from './enemies/actFour'
import type { EnemySpec } from './enemies/model'
export type { EnemySpec } from './enemies/model'
export type { EnemyIntent as Intent } from './state'

export const ENEMIES: Record<string, EnemySpec> = { ...ACT_ONE_ENEMIES, ...ACT_TWO_ENEMIES, ...ACT_THREE_ENEMIES, ...ACT_FOUR_ENEMIES }

export function createEnemyState(key: string, id: string, asc = 0, rng = new RNG(`${key}-${id}`)): EnemyState {
    const spec = ENEMIES[key]
    if (!spec) throw new Error(`Unknown enemy: ${key}`)
    const threshold = spec.tags?.includes('boss') ? 9 : spec.tags?.includes('elite') ? 8 : 7
    const range = asc >= threshold ? spec.highHp ?? spec.hp : spec.hp
    const hp = typeof range === 'number' ? range : rng.int(range[0], range[1])
    const enemy: EnemyState = { id, name: spec.name, maxHp: hp, hp, block: 0, powers: [], specId: key, aiState: {}, tags: [...(spec.tags ?? [])], asc }
    spec.initialize?.(enemy, rng)
    return enemy
}

export function createEnemyFromSpec(rng: RNG, key: string, id: string): EnemyState {
    const enemy = createEnemyState(key, id, 0, rng)
    enemy.intent = rollEngineIntentForEnemy(rng, enemy, {
        player: { id: 'player', hp: 80, maxHp: 80, block: 0, energy: 3, powers: [], hand: [], deck: [], drawPile: [], discardPile: [], exhaustPile: [] },
        enemies: [enemy], turn: 'player', victory: false, defeat: false, limbo: [], cardRuntime: {},
    })
    return enemy
}

export function rollEngineIntentForEnemy(rng: RNG, enemy: EnemyState, combat: CombatState): EnemyState['intent'] {
    return enemy.specId ? ENEMIES[enemy.specId]?.nextIntent(rng, enemy, combat) : enemy.intent
}
export function onEnemyAttackDamage(engine: Engine, enemy: EnemyState, damage: number, hpLoss: number): void {
    if (enemy.specId) ENEMIES[enemy.specId]?.onAttackDamage?.(engine, enemy, damage, hpLoss)
}
export function onEnemyDamaged(engine: Engine, enemy: EnemyState, damage: number): void {
    if (enemy.specId) ENEMIES[enemy.specId]?.onDamageTaken?.(engine, enemy, damage)
}
export function onEnemyHitByPlayerAttack(engine: Engine, enemy: EnemyState, damage: number): void {
    if (enemy.specId) ENEMIES[enemy.specId]?.onHitByPlayerAttack?.(engine, enemy, damage)
}
export function onPlayerCardPlayed(engine: Engine, enemy: EnemyState, cardType: CardType): void {
    if (enemy.specId && enemy.hp > 0) ENEMIES[enemy.specId]?.onPlayerCardPlayed?.(engine, enemy, cardType)
}
export function onCardEffectsResolved(engine: Engine, enemy: EnemyState): void {
    if (enemy.specId && enemy.hp > 0) ENEMIES[enemy.specId]?.onCardEffectsResolved?.(engine, enemy)
}
export function onEnemyIntentResolved(engine: Engine, enemy: EnemyState): void {
    if (enemy.specId) ENEMIES[enemy.specId]?.onIntentResolved?.(engine, enemy, enemy.intent)
}
