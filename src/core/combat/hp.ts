import type { Engine } from '../engine'
import type { EnemyState, PlayerState } from '../state'
import { powerAmount } from '../combatMath'

export function hpLossAmount(engine: Engine, target: PlayerState | EnemyState, incoming: number, attack = false, bypassIntangible = false): number {
    let amount = Math.max(0, incoming)
    if (!bypassIntangible && powerAmount(target, 'INTANGIBLE') > 0) amount = Math.min(1, amount)
    if (amount > 0 && powerAmount(target, 'BUFFER') > 0) {
        engine.setPowerStacks(target, 'BUFFER', powerAmount(target, 'BUFFER') - 1)
        return 0
    }
    if (target === engine.state.player) {
        const relics: readonly string[] = engine.run?.relics ?? []
        if (attack && amount > 0 && amount <= 5 && relics.includes('TORII')) amount = 1
        if (relics.includes('TUNGSTEN_ROD')) amount = Math.max(0, amount - 1)
    }
    if ('specId' in target && target.specId === 'CORRUPT_HEART')
        amount = Math.min(amount, Math.max(0, ((target.asc ?? 0) >= 19 ? 200 : 300) - Number(target.aiState?.damageThisTurn ?? 0)))
    return Math.min(target.hp, amount)
}
export function recordHeartDamage(target: PlayerState | EnemyState, amount: number): void {
    if ('specId' in target && target.specId === 'CORRUPT_HEART') target.aiState = { ...target.aiState, damageThisTurn: Number(target.aiState?.damageThisTurn ?? 0) + amount }
}
export function enemyDeathPowers(engine: Engine, enemy: EnemyState): void {
    if (enemy.hp > 0 || enemy.escaped || enemy.halfDead || enemy.aiState?.deathPowersResolved) return
    enemy.aiState = { ...enemy.aiState, deathPowersResolved: true }
    if (engine.run?.relics.includes('GREMLIN_HORN')) { engine.enqueue({ kind: 'GainEnergy', amount: 1 }); engine.enqueue({ kind: 'DrawCards', count: 1 }) }
    const poison = powerAmount(enemy, 'POISON'), living = engine.state.enemies.filter(e => e.hp > 0)
    if (poison > 0 && living.length && engine.run?.relics.includes('THE_SPECIMEN')) engine.enqueue({ kind: 'ApplyPower', target: living[engine.rng.int(0, living.length - 1)].id, powerId: 'POISON', stacks: poison })
    const explosion = powerAmount(enemy, 'CORPSE_EXPLOSION')
    if (explosion > 0) for (const other of engine.state.enemies.filter(e => e.hp > 0))
        engine.enqueue({ kind: 'DealDamage', source: engine.state.player.id, target: other.id, amount: explosion * enemy.maxHp, damageType: 'effect', origin: 'power' })
}
