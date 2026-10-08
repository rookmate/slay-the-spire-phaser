import type { BlockSource, DamageType } from './actions'
import type { EnemyState, PlayerState, PowerId } from './state'

type Combatant = PlayerState | EnemyState
export const HAND_LIMIT = 10
export function powerAmount(entity: Combatant, id: PowerId): number {
    return entity.powers.find(power => power.id === id)?.stacks ?? 0
}

/** Amount already contains Strength and card/relic bonuses. Round only after multipliers. */
export function damageAmount(base: number, source: Combatant | undefined, target: Combatant | undefined,
    type: DamageType = 'attack', vulnerableMultiplier = 1.5, attackMultiplier = 1, weakMultiplier = 0.75): number {
    let amount = base
    if (type === 'attack') {
        amount *= attackMultiplier
        if (source && 'stance' in source) amount *= source.stance === 'wrath' ? 2 : source.stance === 'divinity' ? 3 : 1
        if (target && 'stance' in target && target.stance === 'wrath') amount *= 2
        if (source && powerAmount(source, 'DOUBLE_DAMAGE') > 0) amount *= 2
        if (source && powerAmount(source, 'WEAK') > 0) amount *= weakMultiplier
        if (target && powerAmount(target, 'VULNERABLE') > 0) amount *= vulnerableMultiplier
        if (target && 'specId' in target && (target.specId === 'GIANT_HEAD' || powerAmount(target, 'SLOW') > 0)) amount *= 1 + Number(target.aiState?.slow ?? 0) * 0.1
        if (target && 'specId' in target && target.specId === 'BYRD' && target.aiState?.flying) amount *= 0.5
    }
    if (target && powerAmount(target, 'INTANGIBLE') > 0) amount = Math.min(1, amount)
    return Math.max(0, Math.floor(amount))
}

export function blockAmount(base: number, target: Combatant, source: BlockSource = 'effect'): number {
    let amount = base
    if (source === 'card') {
        if (powerAmount(target, 'NO_BLOCK') > 0) return 0
        amount += powerAmount(target, 'DEXTERITY')
        if (powerAmount(target, 'FRAIL') > 0) amount *= 0.75
    }
    return Math.max(0, Math.floor(amount))
}

export function isDebuff(id: PowerId, stacks: number): boolean {
    return stacks < 0 || ['SLOW', 'WEAK', 'VULNERABLE', 'FRAIL', 'NO_DRAW', 'STRENGTH_DOWN_NEXT_TURN', 'CONFUSION', 'HEX', 'ENTANGLED', 'DRAW_REDUCTION', 'CONSTRICTED', 'POISON', 'CORPSE_EXPLOSION', 'CHOKE', 'WRAITH_FORM', 'DEXTERITY_DOWN', 'LOCK_ON', 'BIASED_COGNITION', 'TALK_TO_THE_HAND', 'MARK', 'FASTING', 'NO_BLOCK'].includes(id)
}
