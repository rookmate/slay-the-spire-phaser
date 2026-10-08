import type { Engine } from '../engine'
import type { RNG } from '../rng'
import type { CardType, CombatState, EnemyIntent, EnemyState } from '../state'

export interface EnemySpec {
    id: string
    name: string
    hp: number | readonly [number, number]
    highHp?: number | readonly [number, number]
    tags?: string[]
    initialize?: (enemy: EnemyState, rng: RNG) => void
    nextIntent: (rng: RNG, enemy: EnemyState, combat: CombatState) => EnemyIntent
    onAttackDamage?: (engine: Engine, enemy: EnemyState, damage: number, hpLoss: number) => void
    onDamageTaken?: (engine: Engine, enemy: EnemyState, damage: number) => void
    onHitByPlayerAttack?: (engine: Engine, enemy: EnemyState, damage: number) => void
    onPlayerCardPlayed?: (engine: Engine, enemy: EnemyState, type: CardType) => void
    onCardEffectsResolved?: (engine: Engine, enemy: EnemyState) => void
    onIntentResolved?: (engine: Engine, enemy: EnemyState, intent: EnemyIntent | undefined) => void
}
