import type { BlockSource, DamageType } from './actions'
import type { EnemyState, PlayerState, PowerId } from './state'

type Combatant = PlayerState | EnemyState
export const HAND_LIMIT = 10
export function powerAmount(entity: Combatant, id: PowerId): number {
    return entity.powers.find(power => power.id === id)?.stacks ?? 0
}

/** Amount already contains Strength and card/relic bonuses. Round only after multipliers. */
export function damageAmount(base: number, source: Combatant | undefined, target: Combatant | undefined,
    type: DamageType = 'attack', vulnerableMultiplier = 1.5): number {
    let amount = base
    if (type === 'attack') {
        if (source && powerAmount(source, 'WEAK') > 0) amount *= 0.75
        if (target && powerAmount(target, 'VULNERABLE') > 0) amount *= vulnerableMultiplier
        if (target && 'specId' in target && target.specId === 'BYRD' && target.aiState?.flying) amount *= 0.5
    }
    return Math.max(0, Math.floor(amount))
}

export function blockAmount(base: number, target: Combatant, source: BlockSource = 'effect'): number {
    let amount = base
    if (source === 'card') {
        amount += powerAmount(target, 'DEXTERITY')
        if (powerAmount(target, 'FRAIL') > 0) amount *= 0.75
    }
    return Math.max(0, Math.floor(amount))
}

export function isDebuff(id: PowerId, stacks: number): boolean {
    return stacks < 0 || ['WEAK', 'VULNERABLE', 'FRAIL', 'NO_DRAW', 'STRENGTH_DOWN_NEXT_TURN'].includes(id)
}
