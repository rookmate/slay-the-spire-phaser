import type { EnemyState } from './state'
import type { RoomKind } from './map'
import type { EncounterTier } from './rewards'

export const MAX_ASCENSION = 10

export function clampAscension(level: number): number {
    return Math.max(0, Math.min(MAX_ASCENSION, Math.floor(level)))
}

export function getAscensionEnemyDamageMultiplier(asc: number, enemy?: Pick<EnemyState, 'tags' | 'specId'>): number {
    let multiplier = 1
    if (asc >= 2) multiplier *= 1.1
    if (asc >= 10 && (enemy?.tags?.includes('boss') || enemy?.specId === 'THE_CHAMP' || enemy?.specId === 'THE_COLLECTOR')) multiplier *= 1.15
    return multiplier
}

export function getAscensionEnemyHpMultiplier(asc: number, tier: EncounterTier): number {
    let multiplier = 1
    if (asc >= 3) multiplier *= 1.1
    if (asc >= 1 && tier === 'elite') multiplier *= 1.15
    return multiplier
}

export function getAscensionHallwayGoldMultiplier(asc: number): number {
    return asc >= 4 ? 0.8 : 1
}

export function getAscensionStartingMaxHp(asc: number, baseMaxHp: number): number {
    return asc >= 5 ? baseMaxHp - 5 : baseMaxHp
}

export function getAscensionEliteTargetCount(asc: number, defaultCount: number): number {
    return asc >= 6 ? Math.max(3, defaultCount) : defaultCount
}

export function shouldUpgradeHallwayOpeningIntent(asc: number): boolean {
    return asc >= 7
}

export function getAscensionShopPriceMultiplier(asc: number): number {
    return asc >= 8 ? 1.1 : 1
}

export function getAscensionMerchantRemoveBaseCost(asc: number): number {
    return asc >= 8 ? 100 : 75
}

export function getAscensionRestHealFraction(asc: number): number {
    return asc >= 9 ? 0.25 : 0.3
}

export function getBossBuffBonus(asc: number, enemy?: Pick<EnemyState, 'tags' | 'specId'>): number {
    if (asc < 10) return 0
    return enemy?.tags?.includes('boss') || enemy?.specId === 'THE_CHAMP' || enemy?.specId === 'THE_COLLECTOR' ? 1 : 0
}

function intentRank(intent: EnemyState['intent'] | undefined): number {
    if (!intent) return 0
    if (intent.kind === 'multi_attack') return 6
    if (intent.kind === 'attack') return 5
    if (intent.kind === 'debuff') return 4
    if (intent.kind === 'status') return 3
    if (intent.kind === 'summon') return 3
    if (intent.kind === 'buff') return 2
    if (intent.kind === 'block') return 1
    return 0
}

export function pickMoreAggressiveIntent(first: EnemyState['intent'], second: EnemyState['intent']): EnemyState['intent'] {
    const firstRank = intentRank(first)
    const secondRank = intentRank(second)
    if (secondRank > firstRank) return second
    if (firstRank > secondRank) return first
    if (second?.kind === 'multi_attack' && first?.kind === 'multi_attack') {
        const firstDamage = first.amount * first.hits
        const secondDamage = second.amount * second.hits
        return secondDamage > firstDamage ? second : first
    }
    if (second?.kind === 'attack' && first?.kind === 'attack') return second.amount > first.amount ? second : first
    return first
}

export function getAscensionLabel(asc: number): string {
    return `A${clampAscension(asc)}`
}

export function affectsRoomTier(kind: RoomKind): EncounterTier {
    if (kind === 'elite') return 'elite'
    if (kind === 'boss') return 'boss'
    return 'hallway'
}
